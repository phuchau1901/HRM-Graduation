using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.System.DTOs;
public sealed class ScheduleCalendarQuery : PageQuery
{
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    [Range(1, int.MaxValue)] public int? TeamId { get; set; }
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
}
public sealed record ScheduleEmployee(int Id, string EmployeeCode, string FullName, int DepartmentId, int? TeamId);
public sealed record ScheduleFilter(int Id, string Name);
public sealed record ScheduleCalendar(bool Success, int Total, int Page, int PageSize, IReadOnlyList<ScheduleEmployee> Employees,
    IReadOnlyList<ScheduleView> Schedules, IReadOnlyList<ShiftView> Shifts, IReadOnlyList<ScheduleFilter> Departments, IReadOnlyList<ScheduleFilter> Teams, DateOnly[] HolidayDates);
public sealed class ScheduleBulkRequest
{
    public Guid OperationId { get; set; }
    [Required, RegularExpression("^(ALL|DEPARTMENT|TEAM|EMPLOYEE)$")] public string Target { get; set; } = "EMPLOYEE";
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    [Range(1, int.MaxValue)] public int? TeamId { get; set; }
    [Required, MaxLength(500)] public int[] EmployeeIds { get; set; } = [];
    [Range(1, long.MaxValue)] public long? ShiftId { get; set; }
    public DateOnly From { get; set; }
    public DateOnly To { get; set; }
    [Required, MinLength(1), MaxLength(7)] public int[] Weekdays { get; set; } = [1, 2, 3, 4, 5];
    public bool ExcludeHolidays { get; set; } = true;
    public bool Overwrite { get; set; }
    public DateOnly? CopyFrom { get; set; }
    [MaxLength(64)] public string? PreviewToken { get; set; }
}
public sealed record SchedulePlan(int EmployeeId, string EmployeeCode, string EmployeeName, DateOnly WorkDate, long? ShiftId,
    string Outcome, long? ScheduleId, long? Version, AttendanceRuleSnapshot? Rules);
public sealed record SchedulePreview(string PreviewToken, int Ready, int Skipped, IReadOnlyList<SchedulePlan> Items);
public sealed record ScheduleBatchResult(Guid OperationId, int Created, int Updated, int Skipped, IReadOnlyList<SchedulePlan> Items);
