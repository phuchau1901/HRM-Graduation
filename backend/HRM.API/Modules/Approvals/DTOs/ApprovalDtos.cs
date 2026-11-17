using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Approvals.DTOs;
public sealed class WorkflowActionRequest
{
    [Range(1, long.MaxValue)] public long Version { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed class WorkflowStepRule
{
    [Required, RegularExpression("^(TEAM_LEAD|DEPARTMENT_MANAGER|HR|USER)$")] public string ApproverType { get; set; } = "";
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    [MaxLength(100)] public string? UserId { get; set; }
    [MaxLength(50)] public string RoleCode { get; set; } = "HR";
}
public sealed class WorkflowRoute
{
    [Required, MaxLength(30), RegularExpression("^[A-Z][A-Z0-9_]*$")] public string RequestType { get; set; } = "";
    public bool AllowSelfApproval { get; set; }
    [Required, MinLength(1), MaxLength(10)] public WorkflowStepRule[] Steps { get; set; } = [];
}
public sealed class WorkflowSettingsRequest
{
    [Range(0, long.MaxValue)] public long Version { get; set; }
    [Required, MinLength(1), MaxLength(100)] public WorkflowRoute[] Routes { get; set; } = [];
}
public sealed record WorkflowSettingsView(long Version, IReadOnlyList<WorkflowRoute> Routes);
public sealed record ApprovalView(long Id, string RequestType, long ReferenceId, int? EmployeeId, string EmployeeName,
    string RequestedByUserId, string Status, DateTime CreatedAt, long Version, int? CurrentStepNo);
public sealed record ApprovalStepView(long Id, int StepNo, string ApproverUserId, string Decision, string? Comment, DateTime? DecidedAt, int? ApproverEmployeeId = null);
public sealed record ApprovalDetail(ApprovalView Request, IReadOnlyList<ApprovalStepView> Steps, object? Details = null);
public sealed record ApprovalReceipt(long Id, string Status, long Version);
public sealed record ApprovalHistoryView(long Id, string? ActorUserId, string Action, string? BeforeJson, string? AfterJson, DateTime CreatedAt);
public sealed class ApprovalQuery : PageQuery
{
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    [RegularExpression("^(MY|TEAM|ALL)$")] public string View { get; set; } = "ALL";
    [MaxLength(30)] public string? Status { get; set; }
    [MaxLength(30)] public string? RequestType { get; set; }
    [MaxLength(30)] public string? Module { get; set; }
}
