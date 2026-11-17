using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Leave.DTOs;
public sealed class WorkflowQuery : PageQuery
{
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    [Range(1, long.MaxValue)] public long? LeaveTypeId { get; set; }
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
    [Range(typeof(decimal), "0", "99999")] public decimal? CarriedOverDays { get; set; }
    [MaxLength(1000)] public string? Reason { get; set; }
    [Range(0, long.MaxValue)] public long Version { get; set; }
}
public sealed class BalanceGrantRequest
{
    public Guid OperationId { get; set; }
    [Required, RegularExpression("^(EMPLOYEE|DEPARTMENT|ALL)$")] public string Target { get; set; } = "EMPLOYEE";
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    [Range(1, long.MaxValue)] public long LeaveTypeId { get; set; }
    [Range(1900, 9999)] public short Year { get; set; }
    [Range(typeof(decimal), "0", "99999")] public decimal EntitledDays { get; set; }
    [Range(typeof(decimal), "0", "99999")] public decimal CarriedOverDays { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed class BalanceAdjustmentRequest
{
    [Range(1, long.MaxValue)] public long Version { get; set; }
    [Range(typeof(decimal), "-99999", "99999")] public decimal Days { get; set; }
    [Required, MaxLength(1000)] public string Reason { get; set; } = "";
}
public sealed record BalanceGrantReceipt(Guid OperationId, int Selected, int Created, int Skipped);
public sealed record BalanceHistoryView(long Id, string? ActorUserId, string Action, string? BeforeJson, string? AfterJson, DateTime CreatedAt);
public sealed record LeaveTypeView(long Id, string Code, string Name, bool Paid, bool RequiresBalance, bool IsActive);
public sealed record BalanceView(long Id, int EmployeeId, string EmployeeName, long LeaveTypeId, string LeaveTypeName, short Year,
    decimal EntitledDays, decimal UsedDays, decimal ReservedDays, decimal AvailableDays, long Version, decimal CarriedOverDays = 0, decimal AdjustmentDays = 0, decimal RemainingDays = 0);
public sealed record LeaveView(long Id, int EmployeeId, string EmployeeName, long LeaveTypeId, string LeaveTypeName, DateOnly FromDate,
    DateOnly ToDate, decimal RequestedDays, string? Reason, string Status, long Version, long? ApprovalId);
public sealed record OvertimeView(long Id, int EmployeeId, string EmployeeName, DateTime StartAt, DateTime EndAt, decimal RequestedHours,
    decimal? ApprovedHours, string? Reason, string Status, long Version, long? ApprovalId);
public sealed record AdjustmentView(long Id, int EmployeeId, long AttendanceId, DateTime? ProposedCheckIn, DateTime? ProposedCheckOut,
    string Reason, string Status, long Version, long? ApprovalId);
public sealed record WorkflowReceipt(long Id, long ApprovalId, string Status, long Version);
public sealed record BalanceAllocation(long BalanceId, decimal Days);
public sealed class MyBalanceQuery
{
    [Range(1900, 9999)] public int? Year { get; set; }
    [Range(1, long.MaxValue)] public long? LeaveTypeId { get; set; }
}
public sealed record MyBalanceSummary(int EmployeeId, int Year, DateOnly AsOfDate, decimal TotalDays, decimal UsedDays,
    decimal RemainingDays, decimal ReservedDays, decimal AvailableDays, IReadOnlyList<BalanceView> Balances);
public sealed class LeaveAccrualRule
{
    [Range(1, long.MaxValue)] public long PositionId { get; set; }
    [Range(1, long.MaxValue)] public long? LeaveTypeId { get; set; }
    [Range(typeof(decimal), "0.01", "99999", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true)] public decimal? DaysPerCycle { get; set; }
    // Legacy monthly policy input; new schedules use DaysPerCycle.
    [Range(typeof(decimal), "0.01", "31", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true)] public decimal? DaysPerMonth { get; set; }
}
public sealed class LeaveRecurrence
{
    public DateOnly StartDate { get; set; }
    [Range(1, 120)] public int Interval { get; set; } = 1;
    [Required, RegularExpression("^(MONTH|YEAR)$")] public string Unit { get; set; } = "MONTH";
}
public sealed class LeaveAccrualPolicy
{
    [Range(1, 2)] public int ScheduleVersion { get; set; } = 1;
    public LeaveRecurrence? AccrualSchedule { get; set; }
    public LeaveRecurrence? ResetSchedule { get; set; }
    public bool Enabled { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    [Range(1, 31)] public int AccrualDay { get; set; } = 1;
    [Required, RegularExpression("^(ACTIVE_ON_DATE|ONE_MONTH)$")] public string NewHireEligibility { get; set; } = "ACTIVE_ON_DATE";
    public DateOnly? ResetOn { get; set; }
    public bool RepeatResetYearly { get; set; } = true;
    [Required, MaxLength(200)] public LeaveAccrualRule[] Rules { get; set; } = [];
}
public sealed class LeaveAccrualSettingsRequest
{
    [Range(0, long.MaxValue)] public long Version { get; set; }
    [Required] public LeaveAccrualPolicy Settings { get; set; } = new();
}
public sealed record LeaveAccrualSettingsView(long Version, LeaveAccrualPolicy Settings, long? DefaultLeaveTypeId = null,
    DateOnly? AsOfDate = null, DateOnly? FirstAccrualDate = null, DateOnly? FirstResetDate = null,
    DateOnly? NextAccrualDate = null, DateOnly? NextResetDate = null);
public sealed record LeaveAccrualRunView(DateOnly AsOfDate, int CreditedBalances, int ExpiredBalances, bool AccrualAlreadyProcessed, bool ResetAlreadyProcessed,
    string Status = "COMPLETED", string? Message = null, bool PolicyEnabled = false, long PolicyVersion = 0,
    DateOnly? AccrualDueDate = null, DateOnly? ResetDueDate = null, DateOnly? NextAccrualDate = null, DateOnly? NextResetDate = null,
    int MatchedEmployees = 0, int EligibleEmployees = 0, int ActiveRules = 0);
