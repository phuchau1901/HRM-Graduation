using HRM.API.Modules.Approvals.Entities;
namespace HRM.API.Modules.Approvals.Services;
/// <summary>Domain work runs inside the orchestration transaction; handlers must not commit their own transaction.</summary>
public interface IApprovalModule
{
    string Code { get; }
    IReadOnlyCollection<string> RequestTypes { get; }
    string? WorkflowFallback(string requestType) => null;
    Task AuthorizeReadAsync(ApprovalRequest approval, string actor, CancellationToken ct) => Task.CompletedTask;
    Task<object?> GetDetailsAsync(ApprovalRequest approval, CancellationToken ct);
    Task AuthorizeDecisionAsync(ApprovalRequest approval, string actor, CancellationToken ct) => Task.CompletedTask;
    Task CompleteAsync(ApprovalRequest approval, bool approved, string actor, CancellationToken ct);
}
