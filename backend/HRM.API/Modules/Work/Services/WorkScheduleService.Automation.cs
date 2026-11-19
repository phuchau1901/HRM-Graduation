using HRM.API.Common;
using System.Data;
using System.Globalization;
using System.Text.Json;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Work.DTOs;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Work.Services;
public sealed record ScheduleAutomationResult(DateOnly WeekFrom, int Created, int Employees, int Skipped, string Status);
public sealed partial class WorkScheduleService
{
    public static DateOnly AutomaticWeek(DateOnly today)
    {
        var sunday = today.AddDays(-(int)today.DayOfWeek);
        return sunday.AddDays(1);
    }
    // Internal worker only: no HTTP route, actor impersonation or RBAC bypass for API callers.
    public async Task<ScheduleAutomationResult> RunAutomaticSchedules(CancellationToken ct)
    {
        var today = VietnamBusinessDate.Today(clock); var from = AutomaticWeek(today); var to = from.AddDays(6);
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        if (!config.Settings.AutoScheduleEnabled) return new(from, 0, 0, 0, "DISABLED");
        var created = 0; var employees = 0; var skipped = 0; var cursor = 0;
        while (true)
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // Shared setting lock serializes replicas and prevents a config change mid-batch.
            await db.Set<SystemSetting>().Where(s => s.Key == SettingsDefaults.AttendanceKey).ExecuteUpdateAsync(s => s.SetProperty(s => s.Version, s => s.Version), ct);
            config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
            if (!config.Settings.AutoScheduleEnabled) { await tx.CommitAsync(ct); break; }
            var batch = await db.Employees.AsNoTracking().Where(e => e.Id > cursor && e.EmploymentStatus == "ACTIVE" && e.HireDate <= today &&
                db.Set<Contract>().Any(c => c.EmployeeID == e.Id && c.Status == "ACTIVE" && c.StartDate <= today && (!c.EndDate.HasValue || c.EndDate >= today)))
                .OrderBy(e => e.Id).Take(100).ToArrayAsync(ct);
            if (batch.Length == 0) { await tx.CommitAsync(ct); break; }
            cursor = batch[^1].Id;
            foreach (var employee in batch) await db.Employees.Where(e => e.Id == employee.Id).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
            var ids = batch.Select(e => e.Id).ToArray();
            var prefix = "weekly:" + from.ToString("yyyyMMdd", CultureInfo.InvariantCulture) + ":";
            var keys = ids.Select(id => prefix + id.ToString(CultureInfo.InvariantCulture)).ToArray();
            var completed = (await db.Set<AuditLog>().AsNoTracking().Where(a => a.EntityType == "ScheduleAutomation" && keys.Contains(a.EntityID)).Select(a => a.EntityID).ToListAsync(ct)).ToHashSet();
            var pending = batch.Where(e => !completed.Contains(prefix + e.Id.ToString(CultureInfo.InvariantCulture))).ToArray();
            var pendingIds = pending.Select(e => e.Id).ToArray();
            var latest = await db.Set<WorkSchedule>().AsNoTracking().Where(s => pendingIds.Contains(s.EmployeeID) && s.WorkDate < from && (s.Status == "SCHEDULED" || s.Status == "CLOSED"))
                .GroupBy(s => s.EmployeeID).Select(g => new { EmployeeId = g.Key, LastDate = g.Max(s => s.WorkDate) }).ToListAsync(ct);
            var sourceWeeks = latest.ToDictionary(e => e.EmployeeId, e => e.LastDate.AddDays(-(((int)e.LastDate.DayOfWeek + 6) % 7)));
            var contracts = await db.Set<Contract>().AsNoTracking().Where(c => pendingIds.Contains(c.EmployeeID) && c.Status == "ACTIVE" && c.StartDate <= to && (!c.EndDate.HasValue || c.EndDate >= from)).ToListAsync(ct);
            if (pending.Length == 0) { await tx.CommitAsync(ct); continue; }
            var request = new ScheduleBulkRequest { OperationId = Guid.NewGuid(), From = from, To = to, Weekdays = [1, 2, 3, 4, 5, 6, 7], ExcludeHolidays = true, Overwrite = false };
            var preview = await Plan("SYSTEM_AUTOMATION", request, pending, ct, sourceWeeks);
            var ready = preview.Items.Where(p => p.Outcome == "READY" && !p.ScheduleId.HasValue && contracts.Any(c => c.EmployeeID == p.EmployeeId && c.StartDate <= p.WorkDate && (!c.EndDate.HasValue || c.EndDate >= AttendanceRules.LocalDate(p.Rules!.EndAtUtc.AddTicks(-1), p.Rules.Timezone)))).ToArray();
            var existingIds = ready.Where(p => p.ScheduleId.HasValue).Select(p => p.ScheduleId!.Value).ToArray();
            var existing = await db.Set<WorkSchedule>().Where(s => existingIds.Contains(s.ID)).ToDictionaryAsync(s => s.ID, ct);
            foreach (var item in ready)
            {
                var row = item.ScheduleId.HasValue ? existing[item.ScheduleId.Value] : new WorkSchedule();
                var before = item.ScheduleId.HasValue ? JsonSerializer.Serialize(ScheduleDto(row), SettingsDefaults.Json) : null;
                row.EmployeeID = item.EmployeeId; row.ShiftID = item.ShiftId!.Value; row.WorkDate = item.WorkDate; row.Status = "SCHEDULED"; row.Version++;
                row.UniqueWorkKey = $"{row.EmployeeID}:{row.WorkDate:yyyyMMdd}:{row.ShiftID}";
                row.RulesSnapshotJson = JsonSerializer.Serialize(item.Rules, SettingsDefaults.Json);
                if (!item.ScheduleId.HasValue) db.Add(row);
                db.Add(new AuditLog { EntityType = "WorkSchedule", EntityID = prefix + item.EmployeeId, Action = "SCHEDULE_AUTO_ASSIGNED", BeforeJSON = before,
                    AfterJSON = JsonSerializer.Serialize(item, SettingsDefaults.Json), CreatedAt = clock.GetUtcNow().UtcDateTime });
            }
            await db.SaveChangesAsync(ct);
            foreach (var group in ready.GroupBy(p => p.EmployeeId))
            {
                db.Add(new AuditLog { EntityType = "ScheduleAutomation", EntityID = prefix + group.Key.ToString(CultureInfo.InvariantCulture), Action = "SCHEDULE_AUTO_COMPLETED", CreatedAt = clock.GetUtcNow().UtcDateTime,
                    AfterJSON = JsonSerializer.Serialize(new { weekFrom = from, sourceWeek = sourceWeeks[group.Key], created = group.Count(), settingsVersion = config.Version }, SettingsDefaults.Json) });
            }
            await db.SaveChangesAsync(ct);
            foreach (var group in ready.GroupBy(p => p.EmployeeId)) await NotifySchedules(group.Key, prefix + group.Key.ToString(CultureInfo.InvariantCulture), group.Count(), ct);
            await tx.CommitAsync(ct);
            created += ready.Length; employees += ready.Select(p => p.EmployeeId).Distinct().Count(); skipped += preview.Items.Count - ready.Length;
            db.ChangeTracker.Clear();
        }
        return new(from, created, employees, skipped, created > 0 ? "COMPLETED" : "NO_CHANGES");
    }
}
