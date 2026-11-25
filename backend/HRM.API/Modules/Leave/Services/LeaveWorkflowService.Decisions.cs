using HRM.API.Common;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Attendance.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Leave.Services;
public sealed partial class LeaveWorkflowService
{
    public Task<WorkflowReceipt> Cancel(string actor, string kind, long id, WorkflowActionRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var screen = kind == "LEAVE" ? Leave : kind == "OVERTIME" ? Overtime : Adjustments;
        var employee = await Own(actor, screen, "UPDATE", ct);
        var approval = await db.Set<ApprovalRequest>().SingleOrDefaultAsync(a => a.RequestType == kind && a.ReferenceID == id && a.RequestedByUserID == actor && a.EmployeeId == employee.Id, ct)
            ?? throw BusinessException.Missing();
        await db.Set<ApprovalRequest>().Where(a => a.ID == approval.ID).ExecuteUpdateAsync(s => s.SetProperty(a => a.Version, a => a.Version), ct);
        string status; long version;
        if (kind == "LEAVE")
        {
            var leave = await db.Set<LeaveRequest>().SingleAsync(r => r.ID == id && r.EmployeeID == employee.Id, ct);
            if (leave.Version != request.Version) throw BusinessException.Conflict("Leave changed; reload.");
            if (leave.Status == "APPROVED")
            {
                if (leave.FromDate <= VietnamBusinessDate.Today(clock)) throw BusinessException.Conflict("Started leave cannot be cancelled through this workflow.");
                leave.Status = "CANCELLATION_PENDING"; leave.Version++;
                var cancellation = await Start(actor, employee, "LEAVE_CANCELLATION", id, ct);
                Audit(actor, cancellation.ID, "LEAVE_CANCELLATION_REQUESTED", null, new { leave.ID, reason = request.Reason });
                return new WorkflowReceipt(id, cancellation.ID, leave.Status, leave.Version);
            }
            if (leave.Status != "PENDING") throw BusinessException.Conflict("Leave cannot be cancelled in its current state.");
            await accounting.ApplyAsync(leave, "RELEASE", actor, ct); leave.Status = "CANCELLED"; leave.Version++; status = leave.Status; version = leave.Version;
        }
        else if (kind == "OVERTIME")
        {
            await db.Set<OvertimeRequest>().Where(x=>x.ID==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
            var overtime = await db.Set<OvertimeRequest>().SingleAsync(r => r.ID == id && r.EmployeeID == employee.Id, ct);
            if (overtime.Version != request.Version || overtime.Status != "PENDING") throw BusinessException.Conflict("Only pending overtime can be cancelled; reload.");
            await db.Set<HRM.API.Modules.Attendance.Entities.UnscheduledAttendance>().Where(x=>x.OvertimeRequestId==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,"CANCELLED").SetProperty(x=>x.Version,x=>x.Version+1),ct);
            overtime.Status = "CANCELLED"; overtime.Version++; status = overtime.Status; version = overtime.Version;
        }
        else
        {
            var adjustment = await db.Set<AttendanceAdjustment>().SingleAsync(r => r.ID == id && r.EmployeeID == employee.Id, ct);
            if (adjustment.Version != request.Version || adjustment.Status != "PENDING") throw BusinessException.Conflict("Only pending adjustments can be cancelled; reload.");
            adjustment.Status = "CANCELLED"; adjustment.Version++; status = adjustment.Status; version = adjustment.Version;
        }
        await approvals.CancelPendingAsync(actor, approval, request.Reason.Trim(), ct);
        return new WorkflowReceipt(id, approval.ID, status, version);
    }, ct);
}
