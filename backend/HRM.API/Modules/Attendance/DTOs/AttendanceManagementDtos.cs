using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using HRM.API.Common;
namespace HRM.API.Modules.Attendance.DTOs;
public sealed class DailyAttendanceQuery : PageQuery
{
    public DateOnly? Date { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    [Range(1, int.MaxValue)] public int? TeamId { get; set; }
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    [RegularExpression("^(NOT_CHECKED_IN|WORKING|COMPLETE|MISSING_CHECK_OUT|MISSING_CHECK_IN|ABSENT|ON_LEAVE|DAY_OFF|HOLIDAY|NO_SCHEDULE|LEGACY_UNVERIFIED|LATE|EARLY)$")]
    public string? Status { get; set; }
}
public sealed class DailyAttendanceRow
{
    public int EmployeeId { get; set; }
    public string EmployeeCode { get; set; } = "";
    public string EmployeeName { get; set; } = "";
    public int DepartmentId { get; set; }
    public string DepartmentName { get; set; } = "";
    public int? TeamId { get; set; }
    public string? TeamName { get; set; }
    public DateOnly WorkDate { get; set; }
    public long? ScheduleId { get; set; }
    public long? AttendanceId { get; set; }
    public string? ShiftCode { get; set; }
    public string? Timezone { get; set; }
    public DateTime? ShiftStartAtUtc { get; set; }
    public DateTime? ShiftEndAtUtc { get; set; }
    public DateTime? CheckInOpenUtc { get; set; }
    public DateTime? CheckInCloseUtc { get; set; }
    public DateTime? CheckOutOpenUtc { get; set; }
    public DateTime? CheckOutCloseUtc { get; set; }
    public DateTime? CheckInAtUtc { get; set; }
    public DateTime? CheckOutAtUtc { get; set; }
    public int? WorkedMinutes { get; set; }
    public int LateMinutes { get; set; }
    public int EarlyMinutes { get; set; }
    public bool IsLate { get; set; }
    public bool IsEarly { get; set; }
    public bool IsOnLeave { get; set; }
    public bool IsHoliday { get; set; }
    public bool IsPeriodLocked { get; set; }
    public bool SnapshotMissing { get; set; }
    public bool RequireQr { get; set; }
    public bool RequireGps { get; set; }
    public string? MissingPunchRule { get; set; }
    public string Status { get; set; } = "";
    [JsonIgnore] public string? RulesJson { get; set; }
}
public sealed record DailyAttendancePage(bool Success, int Total, int Page, int PageSize, DateTime AsOfUtc, IReadOnlyList<DailyAttendanceRow> Data);
public sealed record DailyAttendanceStatistics(bool Success, DateTime AsOfUtc, DateOnly From, DateOnly To, int Employees,
    int Scheduled, int CheckedIn, int Working, int Late, int Early, int NotPunched, int OnLeave, int Absent, int MissingCheckOut);
public sealed record AttendanceAdjustmentSummary(long Id, string Status, string? Reason, DateTime? ProposedCheckIn, DateTime? ProposedCheckOut);
public sealed record DailyAttendanceDetail(DailyAttendanceRow Attendance, AttendanceRuleSnapshot? Rules, IReadOnlyList<AttendanceAdjustmentSummary> Adjustments);
public sealed record AttendanceFilterOption(int Id, string Name);
public sealed record AttendanceFilters(IReadOnlyList<AttendanceFilterOption> Departments, IReadOnlyList<AttendanceFilterOption> Teams);
