using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
namespace HRM.API.Modules.Approvals.Modules.Attendance;
public sealed class AttendanceAdjustmentApprovalModule(AppDbContext db, TimeProvider clock) : IApprovalModule
{
    public string Code => "ATTENDANCE";
    public IReadOnlyCollection<string> RequestTypes => ["ATTENDANCE_ADJUSTMENT"];
    public async Task<object?> GetDetailsAsync(ApprovalRequest approval, CancellationToken ct) => await db.Set<AttendanceAdjustment>().AsNoTracking()
        .SingleOrDefaultAsync(a => a.ID == approval.ReferenceID && a.EmployeeID == approval.EmployeeId, ct);
    public async Task CompleteAsync(ApprovalRequest approval, bool approved, string actor, CancellationToken ct)
    {
        var adjustment = await db.Set<AttendanceAdjustment>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
        if (adjustment.EmployeeID != approval.EmployeeId || adjustment.Status != "PENDING") throw BusinessException.Conflict("Adjustment is no longer pending.");
        if (approved)
        {
            var attendance = await db.Set<AttendanceEntity>().SingleAsync(a => a.ID == adjustment.AttendanceID, ct);
            await db.Set<WorkSchedule>().Where(s => s.ID == attendance.ScheduleID).ExecuteUpdateAsync(s => s.SetProperty(r => r.Version, r => r.Version), ct);
            var schedule = await db.Set<WorkSchedule>().SingleAsync(s => s.ID == attendance.ScheduleID && s.EmployeeID == adjustment.EmployeeID, ct);
            await HRM.API.Modules.Payroll.Services.TimesheetLocks.RequireOpen(db, schedule.WorkDate, ct);
            if (adjustment.OriginalAttendanceJson != AttendanceCorrectionRules.Snapshot(attendance) || adjustment.ExpectedScheduleVersion != schedule.Version)
                throw BusinessException.Conflict("Attendance or schedule changed after submission; reject and resubmit correction.");
            var rules = AttendanceCorrectionRules.Validate(schedule, adjustment.ProposedCheckIn, adjustment.ProposedCheckOut, clock);
            var before = AttendanceCorrectionRules.Snapshot(attendance);
            attendance.CheckInAt = adjustment.ProposedCheckIn; attendance.CheckOutAt = adjustment.ProposedCheckOut;
            attendance.CheckInQRID = null; attendance.CheckOutQRID = null;
            attendance.LateMinutes = attendance.CheckInAt.HasValue ? AttendanceRules.Late(rules, attendance.CheckInAt.Value) : 0;
            attendance.EarlyMinutes = attendance.CheckOutAt.HasValue ? AttendanceRules.Early(rules, attendance.CheckOutAt.Value) : 0;
            attendance.Status = attendance.CheckInAt.HasValue ? attendance.CheckOutAt.HasValue ? "COMPLETE" : "MISSING_CHECK_OUT" : "MISSING_CHECK_IN";
            schedule.Version++;
            ApprovalAudit.Record(db, clock, actor, approval.ID, "ATTENDANCE_ADJUSTED", JsonSerializer.Deserialize<object>(before), JsonSerializer.Deserialize<object>(AttendanceCorrectionRules.Snapshot(attendance)));
        }
        adjustment.Status = approved ? "APPROVED" : "REJECTED"; adjustment.Version++;
    }
}
