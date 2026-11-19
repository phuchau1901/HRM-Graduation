using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Work.DTOs;
using System.Data;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.System.DTOs;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Work.Services;
public sealed partial class WorkScheduleService(AppDbContext db, SystemSettingsService settings, EmployeeDataScope scopes, TimeProvider clock, HRM.API.Modules.Notifications.Services.NotificationService notifications)
{
    internal static ShiftView ShiftDto(Shift s) => new(s.ID, s.Code, s.Name, s.StartTime, s.EndTime, s.BreakMinutes, s.LateGraceMinutes, s.IsActive, s.Version);
    internal static ScheduleView ScheduleDto(WorkSchedule s) => new(s.ID, s.EmployeeID, s.ShiftID, s.WorkDate, s.Status, s.Version,
        s.RulesSnapshotJson is null ? null : SettingsDefaults.Read<AttendanceRuleSnapshot>(s.RulesSnapshotJson));
    public async Task<PageResult<ShiftView>> Shifts(string actor, PageQuery q, CancellationToken ct)
    {
        await settings.Demand(actor, WorkScreens.Shifts, "VIEW", ct); var query = db.Set<Shift>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.Code.Contains(q.Search) || x.Name.Contains(q.Search));
        var total = await query.CountAsync(ct); var rows = await query.OrderBy(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows.Select(ShiftDto).ToList());
    }
    public async Task<ShiftView> Shift(string actor, long id, CancellationToken ct)
    { await settings.Demand(actor, WorkScreens.Shifts, "VIEW", ct); return ShiftDto(await db.Set<Shift>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing()); }
    public async Task<ShiftView> SaveShift(string actor, long? id, ShiftRequest r, string? match, CancellationToken ct)
    {
        SettingsDefaults.Validate(r);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await settings.Demand(actor, WorkScreens.Shifts, id.HasValue ? "UPDATE" : "NEW", ct);
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        if (id.HasValue) await db.Set<Shift>().Where(x => x.ID == id).ExecuteUpdateAsync(x => x.SetProperty(s => s.Version, s => s.Version), ct);
        var row = id.HasValue ? await db.Set<Shift>().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing() : new Shift();
        if (id.HasValue && SystemSettingsService.Match(match) != row.Version) throw new BusinessException(412, "HRM_SETTINGS_412", "Shift changed.");
        var code = r.Code.Trim().ToUpperInvariant();
        if (await db.Set<Shift>().AnyAsync(x => x.Code == code && x.ID != id, ct)) throw BusinessException.Conflict("Shift code already exists.");
        var before = id.HasValue ? ShiftDto(row) : null;
        row.Code = code; row.Name = r.Name.Trim(); row.StartTime = r.StartTime; row.EndTime = r.EndTime; row.BreakMinutes = r.BreakMinutes;
        row.LateGraceMinutes = r.LateGraceMinutes ?? config.Settings.LateGraceMinutes; row.IsActive = r.IsActive; row.Version++;
        if (r.StartTime == r.EndTime || r.BreakMinutes >= AttendanceRules.Duration(row) || row.LateGraceMinutes >= AttendanceRules.Duration(row) || !config.Settings.AllowOvernightShifts && r.IsActive && r.EndTime < r.StartTime)
            throw BusinessException.Invalid("Invalid shift duration, break, grace or overnight policy.");
        if (!id.HasValue) db.Add(row);
        await db.SaveChangesAsync(ct); settings.Audit(actor, "SHIFT_SAVED", "shift:" + row.ID, before, ShiftDto(row));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return ShiftDto(row);
    }
    internal async Task<IQueryable<WorkSchedule>> Scoped(string actor, string screen, string action, CancellationToken ct)
    {
        var access = await scopes.GetAsync(actor, screen, action, ct);
        var employeeIds = access.Apply(db.Employees.AsNoTracking()).Select(x => x.Id);
        return db.Set<WorkSchedule>().Where(s => employeeIds.Contains(s.EmployeeID));
    }
    internal async Task<WorkSchedule> Find(string actor, long id, string screen, string action, bool locked, CancellationToken ct)
    {
        await settings.Demand(actor, screen, action, ct);
        var query = await Scoped(actor, screen, action, ct);
        if (locked)
        {
            if (await query.Where(x => x.ID == id).ExecuteUpdateAsync(x => x.SetProperty(s => s.Version, s => s.Version), ct) != 1) throw BusinessException.Missing();
            return await query.SingleAsync(x => x.ID == id, ct);
        }
        return await query.AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing();
    }
    public async Task<PageResult<ScheduleView>> Schedules(string actor, ScheduleQuery q, CancellationToken ct)
    {
        await settings.Demand(actor, WorkScreens.Schedules, "VIEW", ct); var query = (await Scoped(actor, WorkScreens.Schedules, "VIEW", ct)).AsNoTracking();
        if (q.EmployeeId.HasValue) query = query.Where(x => x.EmployeeID == q.EmployeeId);
        if (q.From.HasValue) query = query.Where(x => x.WorkDate >= q.From); if (q.To.HasValue) query = query.Where(x => x.WorkDate <= q.To);
        var total = await query.CountAsync(ct); var rows = await query.OrderBy(x => x.WorkDate).ThenBy(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows.Select(ScheduleDto).ToList());
    }
    public async Task<ScheduleView> Schedule(string actor, long id, CancellationToken ct) => ScheduleDto(await Find(actor, id, WorkScreens.Schedules, "VIEW", false, ct));
    public async Task<ScheduleView> SaveSchedule(string actor, long? id, ScheduleRequest r, string? match, CancellationToken ct)
    {
        SettingsDefaults.Validate(r); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var action = id.HasValue ? "UPDATE" : "NEW"; await settings.Demand(actor, WorkScreens.Schedules, action, ct);
        var access = await scopes.GetAsync(actor, WorkScreens.Schedules, action, ct); access.DemandWrite();
        var employee = await access.Apply(db.Employees.AsNoTracking()).SingleOrDefaultAsync(x => x.Id == r.EmployeeId && x.EmploymentStatus == "ACTIVE", ct) ?? throw BusinessException.Scope();
        var lockIds = id.HasValue ? await db.Set<WorkSchedule>().Where(s => s.ID == id).Select(s => s.EmployeeID).ToArrayAsync(ct) : [];
        foreach (var employeeId in lockIds.Append(r.EmployeeId).Distinct().Order()) await db.Employees.Where(e => e.Id == employeeId).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
        var row = id.HasValue ? await Find(actor, id.Value, WorkScreens.Schedules, action, true, ct) : new WorkSchedule();
        if (id.HasValue && SystemSettingsService.Match(match) != row.Version) throw new BusinessException(412, "HRM_SETTINGS_412", "Schedule changed.");
        if (id.HasValue && (row.Status != "SCHEDULED" || await db.Set<HRM.API.Modules.Attendance.Entities.Attendance>().AnyAsync(x => x.ScheduleID == id, ct))) throw BusinessException.Conflict("Schedule has attendance or is closed; history is immutable.");
        if (id.HasValue && row.RulesSnapshotJson is not null && clock.GetUtcNow().UtcDateTime >= SettingsDefaults.Read<AttendanceRuleSnapshot>(row.RulesSnapshotJson).StartAtUtc)
            throw BusinessException.Conflict("Started schedules cannot be rewritten.");
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        if (r.WorkDate < AttendanceRules.LocalDate(clock.GetUtcNow().UtcDateTime, config.Settings.Timezone) || id.HasValue && row.WorkDate < AttendanceRules.LocalDate(clock.GetUtcNow().UtcDateTime, config.Settings.Timezone)) throw BusinessException.Invalid("Past schedules cannot be created or rewritten.");
        var shift = await db.Set<Shift>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == r.ShiftId && x.IsActive, ct) ?? throw BusinessException.Invalid("Active shift required.");
        if (await db.Set<WorkSchedule>().AnyAsync(x => x.ID != id && x.EmployeeID == r.EmployeeId && x.ShiftID == r.ShiftId && x.WorkDate == r.WorkDate, ct)) throw BusinessException.Conflict("Employee already has this shift on that date.");
        var snapshot = AttendanceRules.Snapshot(shift, r.WorkDate, config.Settings, config.Version);
        await ValidateAssignment(employee, id, snapshot, ct);
        if (id.HasValue && PeriodLocked(await LockedPeriods(ct), row.WorkDate)) throw BusinessException.Conflict("Original timesheet period is locked.");
        var before = id.HasValue ? ScheduleDto(row) : null;
        row.EmployeeID = r.EmployeeId; row.ShiftID = r.ShiftId; row.WorkDate = r.WorkDate; row.Status = "SCHEDULED";
        row.UniqueWorkKey = $"{r.EmployeeId}:{r.WorkDate:yyyyMMdd}:{r.ShiftId}"; row.Version++;
        row.RulesSnapshotJson = JsonSerializer.Serialize(snapshot, SettingsDefaults.Json);
        if (!id.HasValue) db.Add(row); await db.SaveChangesAsync(ct);
        settings.Audit(actor, "SCHEDULE_SAVED", "schedule:" + row.ID, before, ScheduleDto(row)); await db.SaveChangesAsync(ct);
        await NotifySchedules(row.EmployeeID, $"single:{row.ID}:{row.Version}", 1, ct);
        if (before != null && before.EmployeeId != row.EmployeeID) await NotifySchedules(before.EmployeeId, $"reassigned:{row.ID}:{row.Version}", 1, ct);
        await tx.CommitAsync(ct); return ScheduleDto(row);
    }
    public async Task Cancel(string actor, long id, string? match, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var access = await scopes.GetAsync(actor, WorkScreens.Schedules, "DELETE", ct); access.DemandWrite();
        var row = await Find(actor, id, WorkScreens.Schedules, "DELETE", true, ct);
        if (SystemSettingsService.Match(match) != row.Version) throw new BusinessException(412, "HRM_SETTINGS_412", "Schedule changed.");
        if (row.Status != "SCHEDULED" || await db.Set<HRM.API.Modules.Attendance.Entities.Attendance>().AnyAsync(x => x.ScheduleID == id, ct)) throw BusinessException.Conflict("Attendance history cannot be cancelled.");
        if (row.RulesSnapshotJson is not null && clock.GetUtcNow().UtcDateTime >= SettingsDefaults.Read<AttendanceRuleSnapshot>(row.RulesSnapshotJson).StartAtUtc)
            throw BusinessException.Conflict("Started schedules cannot be cancelled.");
        if (PeriodLocked(await LockedPeriods(ct), row.WorkDate)) throw BusinessException.Conflict("Timesheet period is locked.");
        row.Status = "CANCELLED"; row.Version++; settings.Audit(actor, "SCHEDULE_CANCELLED", "schedule:" + id, null, new { row.ID });
        await db.SaveChangesAsync(ct); await NotifySchedules(row.EmployeeID, $"cancel:{row.ID}:{row.Version}", 1, ct); await tx.CommitAsync(ct);
    }
}
