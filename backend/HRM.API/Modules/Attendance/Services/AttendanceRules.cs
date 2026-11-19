using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Common;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.System.DTOs;
namespace HRM.API.Modules.Attendance.Services;
public static class AttendanceRules
{
    public static DateOnly LocalDate(DateTime utc, string zone) => DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(Utc(utc), TimeZoneInfo.FindSystemTimeZoneById(zone)));
    public static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
    public static int Duration(Shift shift) => (int)((shift.EndTime > shift.StartTime ? shift.EndTime - shift.StartTime : shift.EndTime - shift.StartTime + TimeSpan.FromDays(1)).TotalMinutes);
    public static AttendanceRuleSnapshot Snapshot(Shift shift, DateOnly date, AttendanceSettingsRequest settings, long settingsVersion)
    {
        if (date.DayNumber < 2 || date.DayNumber > DateOnly.MaxValue.DayNumber - 2) throw BusinessException.Invalid("WorkDate is outside the supported calendar range.");
        var isoDay = ((int)date.DayOfWeek + 6) % 7 + 1;
        if (!settings.WorkingDays.Contains(isoDay)) throw BusinessException.Invalid("WorkDate is not an enabled working day.");
        if (shift.StartTime == shift.EndTime || !settings.AllowOvernightShifts && shift.EndTime < shift.StartTime || shift.BreakMinutes >= Duration(shift))
            throw BusinessException.Invalid("Invalid shift duration, break or overnight policy.");
        var zone = TimeZoneInfo.FindSystemTimeZoneById(settings.Timezone);
        DateTime Convert(DateOnly day, TimeOnly time)
        {
            var local = day.ToDateTime(time, DateTimeKind.Unspecified);
            if (zone.IsInvalidTime(local) || zone.IsAmbiguousTime(local)) throw BusinessException.Invalid("Shift time is invalid or ambiguous in this timezone.");
            return TimeZoneInfo.ConvertTimeToUtc(local, zone);
        }
        var start = Convert(date, shift.StartTime); var end = Convert(shift.EndTime < shift.StartTime ? date.AddDays(1) : date, shift.EndTime);
        return new(date, settings.Timezone, shift.ID, shift.Code, start, end, start.AddMinutes(-settings.CheckInBeforeStartMinutes),
            new DateTime(Math.Min(end.Ticks, start.AddMinutes(settings.CheckInAfterStartMinutes).Ticks), DateTimeKind.Utc),
            new DateTime(Math.Max(start.Ticks, end.AddMinutes(-settings.CheckOutBeforeEndMinutes).Ticks), DateTimeKind.Utc), end.AddMinutes(settings.CheckOutAfterEndMinutes),
            shift.BreakMinutes, shift.LateGraceMinutes, settings.EarlyLeaveGraceMinutes, settings.RequireQr, settings.RequireGps, settings.MissingPunchRule,
            SettingsDefaults.Read<AttendanceLocation[]>(global::System.Text.Json.JsonSerializer.Serialize(settings.Locations, SettingsDefaults.Json)), settingsVersion);
    }
    public static void Window(AttendanceRuleSnapshot rules, DateTime now, bool checkIn)
    {
        if (now < (checkIn ? rules.CheckInOpenUtc : rules.CheckOutOpenUtc) || now > (checkIn ? rules.CheckInCloseUtc : rules.CheckOutCloseUtc))
            throw BusinessException.Conflict("Server time is outside the attendance window.");
    }
    public static int Late(AttendanceRuleSnapshot rules, DateTime checkIn) => Math.Max(0, (int)Math.Ceiling((checkIn - rules.StartAtUtc).TotalMinutes) - rules.LateGraceMinutes);
    public static int Early(AttendanceRuleSnapshot rules, DateTime checkOut) => Math.Max(0, (int)Math.Ceiling((rules.EndAtUtc - checkOut).TotalMinutes) - rules.EarlyLeaveGraceMinutes);
    public static double DistanceMeters(double lat1, double lon1, double lat2, double lon2)
    {
        double Radians(double x) => x * Math.PI / 180;
        var a = Math.Pow(Math.Sin(Radians(lat2 - lat1) / 2), 2) + Math.Cos(Radians(lat1)) * Math.Cos(Radians(lat2)) * Math.Pow(Math.Sin(Radians(lon2 - lon1) / 2), 2);
        return 6371000 * 2 * Math.Asin(Math.Sqrt(Math.Clamp(a, 0, 1)));
    }
}
