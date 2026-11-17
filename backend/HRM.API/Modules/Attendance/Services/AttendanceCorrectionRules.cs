using System.Text.Json;
using HRM.API.Common;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.System.Services;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
namespace HRM.API.Modules.Attendance.Services;
public static class AttendanceCorrectionRules
{
    public static string Snapshot(AttendanceEntity row) => JsonSerializer.Serialize(new { row.CheckInAt, row.CheckOutAt, row.CheckInQRID, row.CheckOutQRID, row.LateMinutes, row.EarlyMinutes, row.Status }, SettingsDefaults.Json);
    public static AttendanceRuleSnapshot Validate(WorkSchedule schedule, DateTime? checkIn, DateTime? checkOut, TimeProvider clock)
    {
        if (schedule.Status == "CANCELLED" || schedule.RulesSnapshotJson == null) throw BusinessException.Conflict("Schedule is cancelled or has no rules snapshot.");
        var rules = JsonSerializer.Deserialize<AttendanceRuleSnapshot>(schedule.RulesSnapshotJson, SettingsDefaults.Json) ?? throw BusinessException.Conflict("Invalid attendance rules snapshot.");
        var now = clock.GetUtcNow().UtcDateTime;
        if ((!checkIn.HasValue && !checkOut.HasValue) || checkOut < checkIn || checkOut == checkIn || checkIn > now || checkOut > now ||
            checkIn < rules.CheckInOpenUtc || checkIn > rules.CheckOutCloseUtc || checkOut < rules.CheckInOpenUtc || checkOut > rules.CheckOutCloseUtc)
            throw BusinessException.Invalid("Correction timestamps must be past, ordered and inside the schedule's correction envelope.");
        return rules;
    }
}
