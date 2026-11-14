using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using HRM.API.Common;
namespace HRM.API.Modules.System.DTOs;
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
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class PunchRequest
{
    [Range(1, long.MaxValue)] public long ScheduleId { get; set; }
    [Required, MaxLength(100)] public string RequestKey { get; set; } = "";
    [Range(1, long.MaxValue)] public long? QrSessionId { get; set; }
    [MaxLength(512)] public string? QrToken { get; set; }
    [Range(-90d, 90d)] public double? Latitude { get; set; }
    [Range(-180d, 180d)] public double? Longitude { get; set; }
}
public sealed class QrCreateRequest
{
    [Required, MaxLength(50)] public string LocationCode { get; set; } = "";
    [Range(15, 300)] public int LifetimeSeconds { get; set; } = 60;
}
public sealed record ShiftView(long Id, string Code, string Name, TimeOnly StartTime, TimeOnly EndTime, int BreakMinutes, int LateGraceMinutes, bool IsActive, long Version);
public sealed record AttendanceRuleSnapshot(DateOnly WorkDate, string Timezone, long ShiftId, string ShiftCode,
    DateTime StartAtUtc, DateTime EndAtUtc, DateTime CheckInOpenUtc, DateTime CheckInCloseUtc, DateTime CheckOutOpenUtc, DateTime CheckOutCloseUtc,
    int BreakMinutes, int LateGraceMinutes, int EarlyLeaveGraceMinutes, bool RequireQr, bool RequireGps, string MissingPunchRule, AttendanceLocation[] Locations, long SettingsVersion);
public sealed record ScheduleView(long Id, int EmployeeId, long ShiftId, DateOnly WorkDate, string Status, long Version, AttendanceRuleSnapshot? Rules);
public sealed record AttendanceView(long Id, long ScheduleId, int EmployeeId, DateOnly WorkDate, DateTime? CheckInAtUtc, DateTime? CheckOutAtUtc,
    int LateMinutes, int EarlyMinutes, string Status, int? WorkedMinutes);
public sealed record QrView(long Id, string LocationCode, DateTime ValidFromUtc, DateTime ExpiresAtUtc, string Status);
public sealed record QrCreated(QrView Session, string Token);
