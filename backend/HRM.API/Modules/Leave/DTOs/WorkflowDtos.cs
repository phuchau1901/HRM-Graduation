using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Leave.DTOs;
public sealed class WorkflowQuery : PageQuery
{
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    [Range(1900, 9999)] public int? Year { get; set; }
    [MaxLength(30)] public string? Status { get; set; }
    [RegularExpression("^(MY|TEAM|ALL)$")] public string View { get; set; } = "ALL";
    [MaxLength(30)] public string? RequestType { get; set; }
}
public sealed class LeaveCreateRequest
{
    [Range(1, long.MaxValue)] public long LeaveTypeId { get; set; }
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed class OvertimeCreateRequest
{
    public DateTimeOffset StartAt { get; set; }
    public DateTimeOffset EndAt { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed class AdjustmentCreateRequest
{
    [Range(1, long.MaxValue)] public long AttendanceId { get; set; }
    public DateTimeOffset? ProposedCheckIn { get; set; }
    public DateTimeOffset? ProposedCheckOut { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed class WorkflowActionRequest
{
    [Range(1, long.MaxValue)] public long Version { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed class LeaveTypeRequest
{
    [Required, MaxLength(30), RegularExpression("^[A-Z0-9][A-Z0-9_-]*$")] public string Code { get; set; } = "";
    [Required, MaxLength(100)] public string Name { get; set; } = "";
    public bool Paid { get; set; }
    public bool RequiresBalance { get; set; } = true;
    public bool IsActive { get; set; } = true;
}
public sealed class BalanceRequest
{
    [Range(1, int.MaxValue)] public int EmployeeId { get; set; }
    [Range(1, long.MaxValue)] public long LeaveTypeId { get; set; }
    [Range(1900, 9999)] public short Year { get; set; }
    [Range(typeof(decimal), "0", "99999")] public decimal EntitledDays { get; set; }
    [Range(0, long.MaxValue)] public long Version { get; set; }
}
public sealed class WorkflowStepRule
{
    [Required, RegularExpression("^(TEAM_LEAD|DEPARTMENT_MANAGER|HR)$")] public string ApproverType { get; set; } = "";
    [MaxLength(100)] public string? UserId { get; set; }
    [MaxLength(50)] public string RoleCode { get; set; } = "HR";
}
public sealed class WorkflowRoute
{
    [Required, RegularExpression("^(LEAVE|LEAVE_CANCELLATION|OVERTIME|ATTENDANCE_ADJUSTMENT)$")] public string RequestType { get; set; } = "";
    public bool AllowSelfApproval { get; set; }
    [Required, MinLength(1), MaxLength(10)] public WorkflowStepRule[] Steps { get; set; } = [];
}
public sealed class WorkflowSettingsRequest
{
    [Range(0, long.MaxValue)] public long Version { get; set; }
    [Required, MinLength(1), MaxLength(4)] public WorkflowRoute[] Routes { get; set; } = [];
}
public sealed record WorkflowSettingsView(long Version, IReadOnlyList<WorkflowRoute> Routes);
public sealed record LeaveTypeView(long Id, string Code, string Name, bool Paid, bool RequiresBalance, bool IsActive);
public sealed record BalanceView(long Id, int EmployeeId, string EmployeeName, long LeaveTypeId, string LeaveTypeName, short Year,
    decimal EntitledDays, decimal UsedDays, decimal ReservedDays, decimal AvailableDays, long Version);
public sealed record LeaveView(long Id, int EmployeeId, string EmployeeName, long LeaveTypeId, string LeaveTypeName, DateOnly FromDate,
    DateOnly ToDate, decimal RequestedDays, string? Reason, string Status, long Version, long? ApprovalId);
public sealed record OvertimeView(long Id, int EmployeeId, string EmployeeName, DateTime StartAt, DateTime EndAt, decimal RequestedHours,
    decimal? ApprovedHours, string? Reason, string Status, long Version, long? ApprovalId);
public sealed record AdjustmentView(long Id, int EmployeeId, long AttendanceId, DateTime? ProposedCheckIn, DateTime? ProposedCheckOut,
    string Reason, string Status, long Version, long? ApprovalId);
public sealed record ApprovalView(long Id, string RequestType, long ReferenceId, int? EmployeeId, string EmployeeName,
    string RequestedByUserId, string Status, DateTime CreatedAt, long Version, int? CurrentStepNo);
public sealed record ApprovalStepView(long Id, int StepNo, string ApproverUserId, string Decision, string? Comment, DateTime? DecidedAt);
public sealed record ApprovalDetail(ApprovalView Request, IReadOnlyList<ApprovalStepView> Steps, object? Details = null);
public sealed record WorkflowReceipt(long Id, long ApprovalId, string Status, long Version);
public sealed record ApprovalReceipt(long Id, string Status, long Version);
public sealed record ApprovalHistoryView(long Id, string? ActorUserId, string Action, string? BeforeJson, string? AfterJson, DateTime CreatedAt);
public sealed record BalanceAllocation(long BalanceId, decimal Days);
