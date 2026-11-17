using HRM.API.Common;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
namespace HRM.API.Modules.Leave.Services;
public sealed partial class LeaveWorkflowService
{
    private async Task AdjustBalance(LeaveRequest leave, string operation, CancellationToken ct)
    {
        if (leave.BalanceAllocationJson is null) throw BusinessException.Conflict("Legacy leave has no balance snapshot; operator review required.");
        foreach (var allocation in Read<BalanceAllocation[]>(leave.BalanceAllocationJson))
        {
            var balance = await db.Set<LeaveBalance>().FindAsync([allocation.BalanceId], ct) ?? throw BusinessException.Conflict("Balance no longer exists.");
            if (balance.EmployeeID != leave.EmployeeID || balance.LeaveTypeID != leave.LeaveTypeID) throw BusinessException.Conflict("Balance snapshot mismatch.");
            if (operation == "REFUND")
            {
                if (balance.UsedDays < allocation.Days) throw BusinessException.Conflict("Insufficient used days to refund.");
                balance.UsedDays -= allocation.Days;
            }
            else
            {
                if (balance.ReservedDays < allocation.Days) throw BusinessException.Conflict("Reserved balance changed; operator review required.");
                balance.ReservedDays -= allocation.Days;
                if (operation == "USE") balance.UsedDays += allocation.Days;
            }
            balance.Version++;
        }
    }
    public Task<ApprovalReceipt> Decide(string actor, long id, WorkflowActionRequest request, bool approve, CancellationToken ct) => Transaction(async () =>
    {
        var access = await scopes.GetAsync(actor, Approvals, "APPROVE", ct);
        var employees = access.Apply(db.Employees);
        var row = await db.Set<ApprovalRequest>().SingleOrDefaultAsync(a => a.ID == id && employees.Any(e => e.Id == a.EmployeeId), ct) ?? throw BusinessException.Missing();
        await db.Set<ApprovalRequest>().Where(a => a.ID == id).ExecuteUpdateAsync(s => s.SetProperty(a => a.Version, a => a.Version), ct);
        if (row.Version != request.Version || row.Status != "PENDING") throw BusinessException.Conflict("Approval changed or is already complete.");
        var steps = await db.Set<ApprovalStep>().Where(s => s.ApprovalRequestID == id).OrderBy(s => s.StepNo).ToListAsync(ct);
        var current = steps.FirstOrDefault(s => s.Decision == "PENDING") ?? throw BusinessException.Conflict("No pending step.");
        if (current.ApproverUserID != actor || !row.AllowSelfApproval && row.RequestedByUserID == actor) throw BusinessException.Scope();
        if (current.ApproverEmployeeId.HasValue && !await db.Set<User>().AnyAsync(u => u.UserId == actor && u.Status == "ACTIVE" && u.EmployeeId == current.ApproverEmployeeId, ct))
            throw BusinessException.Scope();
        var before = new { row.Status, row.Version, step = current.StepNo, current.Decision };
        current.Decision = approve ? "APPROVED" : "REJECTED"; current.Comment = request.Reason.Trim(); current.DecidedAt = Now; row.Version++;
        var next = steps.FirstOrDefault(s => s.Decision == "PENDING");
        if (!approve)
        {
            row.Status = "REJECTED";
            foreach (var future in steps.Where(s => s.Decision == "PENDING")) future.Decision = "SKIPPED";
            await Complete(row, false, actor, ct);
        }
        else if (next is null) { row.Status = "APPROVED"; await Complete(row, true, actor, ct); }
        Audit(actor, id, approve ? "WORKFLOW_STEP_APPROVED" : "WORKFLOW_REJECTED", before, new { row.Status, row.Version, step = current.StepNo, current.Decision, reason = current.Comment });
        await db.SaveChangesAsync(ct);
        if (row.Status == "PENDING") await Notify(row, next!.ApproverUserID, $"step-{next.StepNo}", "A request is awaiting your approval.", ct);
        else await Notify(row, row.RequestedByUserID, row.Status.ToLowerInvariant(), $"Your {row.RequestType} request was {row.Status.ToLowerInvariant()}.", ct);
        return new ApprovalReceipt(row.ID, row.Status, row.Version);
    }, ct);
    private async Task Complete(ApprovalRequest approval, bool approved, string actor, CancellationToken ct)
    {
        if (approval.RequestType is "LEAVE" or "LEAVE_CANCELLATION")
        {
            var leave = await db.Set<LeaveRequest>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
            if (leave.EmployeeID != approval.EmployeeId) throw BusinessException.Conflict("Leave approval linkage mismatch.");
            if (approval.RequestType == "LEAVE")
            {
                if (leave.Status != "PENDING") throw BusinessException.Conflict("Leave is no longer pending.");
                await AdjustBalance(leave, approved ? "USE" : "RELEASE", ct); leave.Status = approved ? "APPROVED" : "REJECTED";
            }
            else
            {
                if (leave.Status != "CANCELLATION_PENDING") throw BusinessException.Conflict("Leave cancellation is no longer pending.");
                if (approved)
                {
                    if (leave.FromDate <= VietnamBusinessDate.Today(clock)) throw BusinessException.Conflict("Leave has started; cancellation requires a separate historical correction procedure.");
                    await AdjustBalance(leave, "REFUND", ct);
                }
                leave.Status = approved ? "CANCELLED" : "APPROVED";
            }
            leave.Version++;
        }
        else if (approval.RequestType == "OVERTIME")
        {
            var overtime = await db.Set<OvertimeRequest>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
            if (overtime.EmployeeID != approval.EmployeeId || overtime.Status != "PENDING") throw BusinessException.Conflict("Overtime is no longer pending.");
            overtime.Status = approved ? "APPROVED" : "REJECTED"; overtime.ApprovedHours = approved ? overtime.RequestedHours : null; overtime.Version++;
        }
        else if (approval.RequestType == "ATTENDANCE_ADJUSTMENT")
        {
            var adjustment = await db.Set<AttendanceAdjustment>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
            if (adjustment.EmployeeID != approval.EmployeeId || adjustment.Status != "PENDING") throw BusinessException.Conflict("Adjustment is no longer pending.");
            if (approved)
            {
                var attendance = await db.Set<AttendanceEntity>().SingleAsync(a => a.ID == adjustment.AttendanceID, ct);
                await db.Set<WorkSchedule>().Where(s => s.ID == attendance.ScheduleID).ExecuteUpdateAsync(s => s.SetProperty(r => r.Version, r => r.Version), ct);
                var schedule = await db.Set<WorkSchedule>().SingleAsync(s => s.ID == attendance.ScheduleID && s.EmployeeID == adjustment.EmployeeID, ct);
                if (adjustment.OriginalAttendanceJson != AttendanceSnapshot(attendance) || adjustment.ExpectedScheduleVersion != schedule.Version)
                    throw BusinessException.Conflict("Attendance or schedule changed after submission; reject and resubmit correction.");
                var rules = ValidateCorrection(schedule, adjustment.ProposedCheckIn, adjustment.ProposedCheckOut);
                var before = AttendanceSnapshot(attendance);
                attendance.CheckInAt = adjustment.ProposedCheckIn; attendance.CheckOutAt = adjustment.ProposedCheckOut;
                attendance.CheckInQRID = null; attendance.CheckOutQRID = null;
                attendance.LateMinutes = attendance.CheckInAt.HasValue ? AttendanceRules.Late(rules, attendance.CheckInAt.Value) : 0;
                attendance.EarlyMinutes = attendance.CheckOutAt.HasValue ? AttendanceRules.Early(rules, attendance.CheckOutAt.Value) : 0;
                attendance.Status = attendance.CheckInAt.HasValue ? attendance.CheckOutAt.HasValue ? "COMPLETE" : "MISSING_CHECK_OUT" : "MISSING_CHECK_IN";
                schedule.Version++;
                Audit(actor, approval.ID, "ATTENDANCE_ADJUSTED", Read<object>(before), Read<object>(AttendanceSnapshot(attendance)));
            }
            adjustment.Status = approved ? "APPROVED" : "REJECTED"; adjustment.Version++;
        }
        else throw BusinessException.Conflict("Unsupported legacy approval type.");
    }
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
            await AdjustBalance(leave, "RELEASE", ct); leave.Status = "CANCELLED"; leave.Version++; status = leave.Status; version = leave.Version;
        }
        else if (kind == "OVERTIME")
        {
            var overtime = await db.Set<OvertimeRequest>().SingleAsync(r => r.ID == id && r.EmployeeID == employee.Id, ct);
            if (overtime.Version != request.Version || overtime.Status != "PENDING") throw BusinessException.Conflict("Only pending overtime can be cancelled; reload.");
            overtime.Status = "CANCELLED"; overtime.Version++; status = overtime.Status; version = overtime.Version;
        }
        else
        {
            var adjustment = await db.Set<AttendanceAdjustment>().SingleAsync(r => r.ID == id && r.EmployeeID == employee.Id, ct);
            if (adjustment.Version != request.Version || adjustment.Status != "PENDING") throw BusinessException.Conflict("Only pending adjustments can be cancelled; reload.");
            adjustment.Status = "CANCELLED"; adjustment.Version++; status = adjustment.Status; version = adjustment.Version;
        }
        if (approval.Status != "PENDING") throw BusinessException.Conflict("Approval is no longer pending.");
        approval.Status = "CANCELLED"; approval.Version++;
        var steps = await db.Set<ApprovalStep>().Where(s => s.ApprovalRequestID == approval.ID && s.Decision == "PENDING").OrderBy(s => s.StepNo).ToListAsync(ct);
        var current = steps.FirstOrDefault(); foreach (var step in steps) { step.Decision = "CANCELLED"; step.Comment = request.Reason.Trim(); step.DecidedAt = Now; }
        Audit(actor, approval.ID, "WORKFLOW_CANCELLED", null, new { reason = request.Reason }); await db.SaveChangesAsync(ct);
        if (current is not null) await Notify(approval, current.ApproverUserID, "cancelled", "The requester cancelled a pending request.", ct);
        return new WorkflowReceipt(id, approval.ID, status, version);
    }, ct);
}
