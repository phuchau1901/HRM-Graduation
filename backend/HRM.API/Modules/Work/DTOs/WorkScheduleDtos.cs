using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.DTOs;
using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using HRM.API.Common;
namespace HRM.API.Modules.Work.DTOs;
public sealed class ShiftRequest
{
    [Required, MaxLength(30)] public string Code { get; set; } = "";
    [Required, MaxLength(100)] public string Name { get; set; } = "";
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    [Range(0, 1439)] public int BreakMinutes { get; set; }
    [Range(0, 240)] public int? LateGraceMinutes { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed class ScheduleRequest
{
    [Range(1, int.MaxValue)] public int EmployeeId { get; set; }
    [Range(1, long.MaxValue)] public long ShiftId { get; set; }
    public DateOnly WorkDate { get; set; }
}
public sealed class ScheduleQuery : PageQuery
{
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}
public sealed record ShiftView(long Id, string Code, string Name, TimeOnly StartTime, TimeOnly EndTime, int BreakMinutes, int LateGraceMinutes, bool IsActive, long Version);
public sealed record ScheduleView(long Id, int EmployeeId, long ShiftId, DateOnly WorkDate, string Status, long Version, AttendanceRuleSnapshot? Rules);
