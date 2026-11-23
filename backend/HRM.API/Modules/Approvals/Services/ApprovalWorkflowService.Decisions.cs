using HRM.API.Common;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Approvals.Services;
public sealed partial class ApprovalWorkflowService
{
    public Task<ApprovalReceipt> Decide(string actor, long id, WorkflowActionRequest request, bool approve, CancellationToken ct) => Transaction(async () =>
    {
        var access = await scopes.GetAsync(actor, Approvals, "APPROVE", ct);
        var employees = access.Apply(db.Employees);
        var row = await db.Set<ApprovalRequest>().SingleOrDefaultAsync(a => a.ID == id && employees.Any(e => e.Id == a.EmployeeId), ct) ?? throw BusinessException.Missing();
        await db.Set<ApprovalRequest>().Where(a => a.ID == id).ExecuteUpdateAsync(s => s.SetProperty(a => a.Version, a => a.Version), ct);
        if (row.Version != request.Version || row.Status != "PENDING") throw BusinessException.Conflict("Approval changed or is already complete.");
        var module = ModuleFor(row.RequestType);
        var steps = await db.Set<ApprovalStep>().Where(s => s.ApprovalRequestID == id).OrderBy(s => s.StepNo).ToListAsync(ct);
        var current = steps.FirstOrDefault(s => s.Decision == "PENDING") ?? throw BusinessException.Conflict("No pending step.");
        if (current.ApproverUserID != actor || !row.AllowSelfApproval && row.RequestedByUserID == actor) throw BusinessException.Scope();
        if (current.ApproverEmployeeId.HasValue && !await db.Set<User>().AnyAsync(u => u.UserId == actor && u.Status == "ACTIVE" && u.EmployeeId == current.ApproverEmployeeId, ct))
            throw BusinessException.Scope();
        await module.AuthorizeDecisionAsync(row, actor, ct);
        var before = new { row.Status, row.Version, step = current.StepNo, current.Decision };
        current.Decision = approve ? "APPROVED" : "REJECTED"; current.Comment = request.Reason.Trim(); current.DecidedAt = Now; row.Version++;
        var next = steps.FirstOrDefault(s => s.Decision == "PENDING");
        if (!approve)
        {
            row.Status = "REJECTED";
            foreach (var future in steps.Where(s => s.Decision == "PENDING")) future.Decision = "SKIPPED";
            await module.CompleteAsync(row, false, actor, ct);
        }
        else if (next is null) { row.Status = "APPROVED"; await module.CompleteAsync(row, true, actor, ct); }
        Audit(actor, id, approve ? "WORKFLOW_STEP_APPROVED" : "WORKFLOW_REJECTED", before, new { row.Status, row.Version, step = current.StepNo, current.Decision, reason = current.Comment });
        await db.SaveChangesAsync(ct);
        if (row.Status == "PENDING") await Notify(row, next!.ApproverUserID, $"step-{next.StepNo}", "A request is awaiting your approval.", ct);
        else await Notify(row, row.RequestedByUserID, row.Status.ToLowerInvariant(), $"Your {row.RequestType} request was {row.Status.ToLowerInvariant()}.", ct);
        return new ApprovalReceipt(row.ID, row.Status, row.Version);
    }, ct);
    public async Task CancelPendingAsync(string actor, ApprovalRequest approval, string reason, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction == null) throw new InvalidOperationException("Cancellation must share the domain transaction.");
        if (approval.RequestedByUserID != actor) throw BusinessException.Scope();
        if (approval.Status != "PENDING") throw BusinessException.Conflict("Approval is no longer pending.");
        approval.Status = "CANCELLED"; approval.Version++;
        var steps = await db.Set<ApprovalStep>().Where(s => s.ApprovalRequestID == approval.ID && s.Decision == "PENDING").OrderBy(s => s.StepNo).ToListAsync(ct);
        var current = steps.FirstOrDefault(); foreach (var step in steps) { step.Decision = "CANCELLED"; step.Comment = reason.Trim(); step.DecidedAt = Now; }
        Audit(actor, approval.ID, "WORKFLOW_CANCELLED", null, new { reason = reason }); await db.SaveChangesAsync(ct);
        if (current is not null) await Notify(approval, current.ApproverUserID, "cancelled", "The requester cancelled a pending request.", ct);
    }
}
