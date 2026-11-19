using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Work.DTOs;
using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.Work.Services;
public sealed partial class WorkScheduleService
{
    private static void Range(DateOnly from, DateOnly to)
    {
        if (from.Year < 1900 || to.Year > 9998 || to < from || to.DayNumber - from.DayNumber > 91)
            throw BusinessException.Invalid("Select a valid range of at most 92 days (1900..9998).");
    }
    public async Task<ScheduleCalendar> Calendar(string actor, ScheduleCalendarQuery q, CancellationToken ct, string action = "VIEW")
    {
        Range(q.From, q.To); await settings.Demand(actor, WorkScreens.Schedules, action, ct);
        var access = await scopes.GetAsync(actor, WorkScreens.Schedules, action, ct);
        var all = access.Apply(db.Employees.AsNoTracking());
        var departments = await (from e in all join d in db.Departments on e.DepartmentId equals d.Id select new ScheduleFilter(d.Id, d.DepartmentName)).Distinct().ToListAsync(ct);
        var teams = await (from e in all join t in db.Teams on e.TeamId equals (int?)t.Id select new ScheduleFilter(t.Id, t.TeamName)).Distinct().ToListAsync(ct);
        var query = all;
        if (q.DepartmentId.HasValue) query = query.Where(e => e.DepartmentId == q.DepartmentId);
        if (q.TeamId.HasValue) query = query.Where(e => e.TeamId == q.TeamId);
        if (q.EmployeeId.HasValue) query = query.Where(e => e.Id == q.EmployeeId);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(e => e.FullName.Contains(q.Search) || e.EmployeeCode.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var employees = await query.OrderBy(e => e.EmployeeCode).ThenBy(e => e.Id).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(e => new ScheduleEmployee(e.Id, e.EmployeeCode, e.FullName, e.DepartmentId, e.TeamId)).ToListAsync(ct);
        var ids = employees.Select(e => e.Id).ToArray();
        var schedules = await db.Set<WorkSchedule>().AsNoTracking().Where(s => ids.Contains(s.EmployeeID) && s.WorkDate >= q.From && s.WorkDate <= q.To).OrderBy(s => s.WorkDate).ThenBy(s => s.ID).ToListAsync(ct);
        var shifts = await db.Set<Shift>().AsNoTracking().OrderBy(s => s.Code).ToListAsync(ct);
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        return new(true, total, q.Page, q.PageSize, employees, schedules.Select(ScheduleDto).ToArray(), shifts.Select(ShiftDto).ToArray(), departments, teams, config.Settings.HolidayDates);
    }
    private async Task<Employee[]> Targets(string actor, ScheduleBulkRequest r, CancellationToken ct)
    {
        SettingsDefaults.Validate(r); Range(r.From, r.To);
        if (r.OperationId == Guid.Empty || r.Weekdays.Any(d => d < 1 || d > 7) || r.Weekdays.Distinct().Count() != r.Weekdays.Length || r.EmployeeIds.Any(id => id <= 0) || r.EmployeeIds.Distinct().Count() != r.EmployeeIds.Length)
            throw BusinessException.Invalid("OperationId and unique employee IDs / ISO weekdays 1..7 are required.");
        await settings.Demand(actor, WorkScreens.Schedules, "NEW", ct);
        var access = await scopes.GetAsync(actor, WorkScreens.Schedules, "NEW", ct); access.DemandWrite();
        var query = access.Apply(db.Employees.AsNoTracking());
        if (r.Target == "DEPARTMENT") { if (!r.DepartmentId.HasValue) throw BusinessException.Invalid("DepartmentId required."); query = query.Where(e => e.DepartmentId == r.DepartmentId); }
        if (r.Target == "TEAM") { if (!r.TeamId.HasValue) throw BusinessException.Invalid("TeamId required."); query = query.Where(e => e.TeamId == r.TeamId); }
        if (r.Target == "EMPLOYEE") { if (r.EmployeeIds.Length == 0) throw BusinessException.Invalid("Select employees."); query = query.Where(e => r.EmployeeIds.Contains(e.Id)); }
        var employees = await query.OrderBy(e => e.Id).Take(501).ToArrayAsync(ct);
        if (employees.Length > 500 || employees.Length * (r.To.DayNumber - r.From.DayNumber + 1) > 5000) throw BusinessException.Invalid("Limit each batch to 500 employees and 5000 employee-days.");
        if (employees.Length == 0 || r.Target == "EMPLOYEE" && employees.Length != r.EmployeeIds.Length) throw BusinessException.Missing();
        if (r.Overwrite)
        {
            await settings.Demand(actor, WorkScreens.Schedules, "UPDATE", ct);
            var update = await scopes.GetAsync(actor, WorkScreens.Schedules, "UPDATE", ct); update.DemandWrite();
            var ids = employees.Select(e => e.Id).ToArray();
            if (await update.Apply(db.Employees).CountAsync(e => ids.Contains(e.Id), ct) != ids.Length) throw BusinessException.Scope();
        }
        if (r.CopyFrom.HasValue)
        {
            if (r.CopyFrom.Value.Year < 1900 || r.CopyFrom.Value.Year > 9998 || r.CopyFrom.Value.DayNumber + r.To.DayNumber - r.From.DayNumber > new DateOnly(9998, 12, 31).DayNumber) throw BusinessException.Invalid("Copy range is outside the supported calendar.");
            Range(r.CopyFrom.Value, r.CopyFrom.Value.AddDays(r.To.DayNumber - r.From.DayNumber));
            await settings.Demand(actor, WorkScreens.Schedules, "VIEW", ct);
            var view = await scopes.GetAsync(actor, WorkScreens.Schedules, "VIEW", ct); var ids = employees.Select(e => e.Id).ToArray();
            if (await view.Apply(db.Employees).CountAsync(e => ids.Contains(e.Id), ct) != ids.Length) throw BusinessException.Scope();
        }
        else if (!r.ShiftId.HasValue) throw BusinessException.Invalid("ShiftId required.");
        return employees;
    }
    private async Task<HashSet<string>> LockedPeriods(CancellationToken ct) => (await db.Set<TimesheetPeriod>().AsNoTracking()
        .Where(p => p.ClosedAt != null || p.Status != "OPEN" && p.Status != "DRAFT").Select(p => p.PeriodKey).ToListAsync(ct)).ToHashSet(StringComparer.Ordinal);
    private static bool PeriodLocked(HashSet<string> periods, DateOnly day) => periods.Contains(day.ToString("yyyy-MM", CultureInfo.InvariantCulture));
    private static bool Overlaps(AttendanceRuleSnapshot a, AttendanceRuleSnapshot b) => a.StartAtUtc < b.EndAtUtc && b.StartAtUtc < a.EndAtUtc;
    private static string Hash(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value, SettingsDefaults.Json))));
    private static object RequestIdentity(ScheduleBulkRequest r) => new { r.OperationId, r.Target, r.DepartmentId, r.TeamId, r.EmployeeIds, r.ShiftId, r.From, r.To, r.Weekdays, r.ExcludeHolidays, r.Overwrite, r.CopyFrom };
    private async Task<SchedulePreview> Plan(string actor, ScheduleBulkRequest r, Employee[] employees, CancellationToken ct, Dictionary<int, DateOnly>? sourceWeeks = null)
    {
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        var ids = employees.Select(e => e.Id).ToArray(); var low = r.From.AddDays(-1); var high = r.To.AddDays(1);
        var rows = await db.Set<WorkSchedule>().AsNoTracking().Where(s => ids.Contains(s.EmployeeID) && s.WorkDate >= low && s.WorkDate <= high).OrderBy(s => s.ID).ToListAsync(ct);
        var rowIds = rows.Select(s => s.ID).ToArray();
        var attended = (await db.Set<HRM.API.Modules.Attendance.Entities.Attendance>().Where(a => rowIds.Contains(a.ScheduleID)).Select(a => a.ScheduleID).ToListAsync(ct)).ToHashSet();
        var leaves = await db.Set<LeaveRequest>().AsNoTracking().Where(l => ids.Contains(l.EmployeeID) && (l.Status == "APPROVED" || l.Status == "CANCELLATION_PENDING") && l.FromDate <= high && l.ToDate >= low).ToListAsync(ct);
        var locked = await LockedPeriods(ct);
        var shifts = await db.Set<Shift>().AsNoTracking().OrderBy(s => s.ID).ToArrayAsync(ct);
        var source = new List<WorkSchedule>();
        if (sourceWeeks != null)
        {
            var parameter = global::System.Linq.Expressions.Expression.Parameter(typeof(WorkSchedule), "s");
            global::System.Linq.Expressions.Expression predicate = global::System.Linq.Expressions.Expression.Constant(false);
            foreach (var pair in sourceWeeks)
            {
                var id = global::System.Linq.Expressions.Expression.Equal(global::System.Linq.Expressions.Expression.Property(parameter, nameof(WorkSchedule.EmployeeID)), global::System.Linq.Expressions.Expression.Constant(pair.Key));
                var date = global::System.Linq.Expressions.Expression.Property(parameter, nameof(WorkSchedule.WorkDate));
                var window = global::System.Linq.Expressions.Expression.AndAlso(global::System.Linq.Expressions.Expression.GreaterThanOrEqual(date, global::System.Linq.Expressions.Expression.Constant(pair.Value)), global::System.Linq.Expressions.Expression.LessThanOrEqual(date, global::System.Linq.Expressions.Expression.Constant(pair.Value.AddDays(6))));
                predicate = global::System.Linq.Expressions.Expression.OrElse(predicate, global::System.Linq.Expressions.Expression.AndAlso(id, window));
            }
            var filter = global::System.Linq.Expressions.Expression.Lambda<Func<WorkSchedule, bool>>(predicate, parameter);
            source = await db.Set<WorkSchedule>().AsNoTracking().Where(filter).Where(s => s.Status != "CANCELLED" && s.WorkDate < r.From).OrderBy(s => s.ID).ToListAsync(ct);
        }
        else if (r.CopyFrom is { } copyFrom)
        {
            var end = copyFrom.AddDays(r.To.DayNumber - r.From.DayNumber);
            source = await db.Set<WorkSchedule>().AsNoTracking().Where(s => ids.Contains(s.EmployeeID) && s.WorkDate >= copyFrom && s.WorkDate <= end && s.Status != "CANCELLED").OrderBy(s => s.ID).ToListAsync(ct);
        }
        else if (!shifts.Any(s => s.ID == r.ShiftId && s.IsActive)) throw BusinessException.Invalid("Active shift required.");
        var today = AttendanceRules.LocalDate(clock.GetUtcNow().UtcDateTime, config.Settings.Timezone);
        var plans = new List<SchedulePlan>();
        foreach (var employee in employees)
        foreach (var n in Enumerable.Range(0, r.To.DayNumber - r.From.DayNumber + 1))
        {
            var date = r.From.AddDays(n); if (!r.Weekdays.Contains(((int)date.DayOfWeek + 6) % 7 + 1)) continue;
            var existing = rows.Where(s => s.EmployeeID == employee.Id && s.WorkDate == date).ToArray();
            var live = existing.Where(s => s.Status != "CANCELLED").ToArray();
            var copyDate = sourceWeeks != null ? (sourceWeeks.TryGetValue(employee.Id, out var sourceWeek) ? (DateOnly?)sourceWeek.AddDays(n) : null) : r.CopyFrom?.AddDays(n);
            var copying = sourceWeeks != null || r.CopyFrom.HasValue;
            var copies = copyDate.HasValue ? source.Where(s => s.EmployeeID == employee.Id && s.WorkDate == copyDate.Value).ToArray() : [];
            var shiftId = copying ? copies.FirstOrDefault()?.ShiftID : r.ShiftId;
            var shift = shifts.SingleOrDefault(s => s.ID == shiftId && s.IsActive);
            var target = live.Length == 1 ? live[0] : existing.FirstOrDefault(s => s.ShiftID == shiftId);
            string outcome = "READY"; AttendanceRuleSnapshot? snapshot = null;
            if (employee.EmploymentStatus != "ACTIVE") outcome = "INACTIVE";
            else if (date < employee.HireDate) outcome = "BEFORE_HIRE";
            else if (date < today) outcome = "PAST_DATE";
            else if (r.ExcludeHolidays && config.Settings.HolidayDates.Contains(date)) outcome = "HOLIDAY";
            else if (!config.Settings.WorkingDays.Contains(((int)date.DayOfWeek + 6) % 7 + 1)) outcome = "NON_WORKING_DAY";
            else if (PeriodLocked(locked, date)) outcome = "PERIOD_LOCKED";
            else if (leaves.Any(l => l.EmployeeID == employee.Id && l.FromDate <= date && l.ToDate >= date)) outcome = "APPROVED_LEAVE";
            else if (copying && copies.Length != 1) outcome = "SOURCE_MISSING_OR_MULTIPLE";
            else if (shift == null) outcome = "SHIFT_INACTIVE";
            else if (live.Length > 1) outcome = "MULTIPLE_SCHEDULES";
            else if (target != null && attended.Contains(target.ID)) outcome = "ATTENDANCE_OR_CLOSED";
            else if (target != null && existing.Any(s => s.ID != target.ID && s.ShiftID == shiftId)) outcome = "MULTIPLE_SCHEDULES";
            else if (live.Any(s => s.Status != "SCHEDULED" || attended.Contains(s.ID))) outcome = "ATTENDANCE_OR_CLOSED";
            else if (live.Length > 0 && !r.Overwrite) outcome = "EXISTS";
            else if (live.Any(s => s.RulesSnapshotJson == null || SettingsDefaults.Read<AttendanceRuleSnapshot>(s.RulesSnapshotJson).StartAtUtc <= clock.GetUtcNow().UtcDateTime)) outcome = "STARTED_OR_LEGACY";
            if (outcome == "READY")
            {
                snapshot = AttendanceRules.Snapshot(shift!, date, config.Settings, config.Version);
                if (snapshot.StartAtUtc <= clock.GetUtcNow().UtcDateTime) outcome = "STARTED";
                else if (leaves.Any(l => l.EmployeeID == employee.Id && l.FromDate <= date.AddDays(1) && l.ToDate >= date.AddDays(1)) && snapshot.EndAtUtc > TimeZoneInfo.ConvertTimeToUtc(date.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeZoneInfo.FindSystemTimeZoneById(config.Settings.Timezone))) outcome = "APPROVED_LEAVE";
                else if (plans.Any(p => p.EmployeeId == employee.Id && p.Outcome == "READY" && p.Rules != null && Overlaps(snapshot, p.Rules))) outcome = "OVERLAP";
                else if (rows.Any(s => s.EmployeeID == employee.Id && s.Status != "CANCELLED" && s.ID != target?.ID &&
                    (s.RulesSnapshotJson == null || Overlaps(snapshot, SettingsDefaults.Read<AttendanceRuleSnapshot>(s.RulesSnapshotJson))))) outcome = "OVERLAP_OR_LEGACY";
            }
            plans.Add(new(employee.Id, employee.EmployeeCode, employee.FullName, date, shiftId, outcome, target?.ID, target?.Version, snapshot));
        }
        var token = Hash(new { actor, request = RequestIdentity(r), config.Version, employees = employees.Select(e => new { e.Id, e.HireDate, e.EmploymentStatus, e.DepartmentId, e.TeamId }), shifts = shifts.Select(s => new { s.ID, s.Version }), plans });
        return new(token, plans.Count(p => p.Outcome == "READY"), plans.Count(p => p.Outcome != "READY"), plans);
    }
    public async Task<SchedulePreview> Preview(string actor, ScheduleBulkRequest r, CancellationToken ct) => await Plan(actor, r, await Targets(actor, r, ct), ct);
    public async Task<ScheduleBatchResult> Assign(string actor, ScheduleBulkRequest r, bool copy, CancellationToken ct)
    {
        if (copy != r.CopyFrom.HasValue) throw BusinessException.Invalid("Copy endpoint requires CopyFrom; bulk endpoint must not include CopyFrom.");
        try
        {
            await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            await db.Screens.Where(s => s.Code == WorkScreens.Schedules).ExecuteUpdateAsync(s => s.SetProperty(s => s.IsActive, s => s.IsActive), ct);
            var employees = await Targets(actor, r, ct); var ids = employees.Select(e => e.Id).ToArray();
            // Common employee locks serialize bulk, single assignment and leave submissions.
            foreach (var id in ids) await db.Employees.Where(e => e.Id == id).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
            var key = r.OperationId.ToString("N"); var requestHash = Hash(RequestIdentity(r));
            var old = await db.Set<AuditLog>().AsNoTracking().SingleOrDefaultAsync(a => a.EntityType == "ScheduleBatch" && a.EntityID == key, ct);
            if (old != null)
            {
                var receipt = SettingsDefaults.Read<BatchReceipt>(old.AfterJSON!);
                if (old.ActorUserID != actor || receipt.RequestHash != requestHash) throw BusinessException.Conflict("OperationId was already used for another request.");
                if (receipt.Result.Items.Any(p => !ids.Contains(p.EmployeeId))) throw BusinessException.Scope();
                await tx.CommitAsync(ct); return receipt.Result;
            }
            var preview = await Plan(actor, r, employees, ct);
            if (r.PreviewToken != preview.PreviewToken) throw BusinessException.Conflict("Schedule preview changed; preview again before confirming.");
            var ready = preview.Items.Where(p => p.Outcome == "READY").ToArray();
            var existingIds = ready.Where(p => p.ScheduleId.HasValue).Select(p => p.ScheduleId!.Value).ToArray();
            var existing = await db.Set<WorkSchedule>().Where(s => existingIds.Contains(s.ID)).ToDictionaryAsync(s => s.ID, ct);
            foreach (var item in ready)
            {
                var row = item.ScheduleId.HasValue ? existing[item.ScheduleId.Value] : new WorkSchedule();
                var before = item.ScheduleId.HasValue ? ScheduleDto(row) : null;
                row.EmployeeID = item.EmployeeId; row.WorkDate = item.WorkDate; row.ShiftID = item.ShiftId!.Value; row.Status = "SCHEDULED"; row.Version++;
                row.UniqueWorkKey = $"{item.EmployeeId}:{item.WorkDate:yyyyMMdd}:{item.ShiftId}";
                row.RulesSnapshotJson = JsonSerializer.Serialize(item.Rules, SettingsDefaults.Json);
                if (!item.ScheduleId.HasValue) db.Add(row);
                settings.Audit(actor, "SCHEDULE_ASSIGNED", "batch:" + key, before, new { operationId = r.OperationId, item.EmployeeId, item.WorkDate, row.ShiftID, row.Version, rules = item.Rules });
            }
            await db.SaveChangesAsync(ct);
            var result = new ScheduleBatchResult(r.OperationId, ready.Count(p => !p.ScheduleId.HasValue), ready.Count(p => p.ScheduleId.HasValue), preview.Skipped, preview.Items);
            db.Add(new AuditLog { ActorUserID = actor, EntityType = "ScheduleBatch", EntityID = key, Action = "SCHEDULE_BATCH_COMPLETED", CreatedAt = clock.GetUtcNow().UtcDateTime, AfterJSON = JsonSerializer.Serialize(new BatchReceipt(requestHash, result), SettingsDefaults.Json) });
            await db.SaveChangesAsync(ct);
            foreach (var group in ready.GroupBy(p => p.EmployeeId)) await NotifySchedules(group.Key, $"batch:{key}:{group.Key}", group.Count(), ct);
            await tx.CommitAsync(ct); return result;
        }
        catch (Exception e) when (e is DbUpdateConcurrencyException || e is MySqlException { Number: 1062 or 1205 or 1213 } || e.InnerException is MySqlException { Number: 1062 or 1205 or 1213 })
        { throw BusinessException.Conflict("Concurrent scheduling change; retry with a fresh preview and the same OperationId."); }
    }
    private async Task ValidateAssignment(Employee employee, long? scheduleId, AttendanceRuleSnapshot snapshot, CancellationToken ct)
    {
        if (employee.EmploymentStatus != "ACTIVE" || snapshot.WorkDate < employee.HireDate) throw BusinessException.Invalid("Schedule must be on or after the active employee's hire date.");
        if (snapshot.StartAtUtc <= clock.GetUtcNow().UtcDateTime) throw BusinessException.Conflict("Started shifts cannot be assigned.");
        if (PeriodLocked(await LockedPeriods(ct), snapshot.WorkDate)) throw BusinessException.Conflict("Timesheet period is locked.");
        var end = AttendanceRules.LocalDate(snapshot.EndAtUtc.AddTicks(-1), snapshot.Timezone);
        if (await db.Set<LeaveRequest>().AnyAsync(l => l.EmployeeID == employee.Id && (l.Status == "APPROVED" || l.Status == "CANCELLATION_PENDING") && l.FromDate <= end && l.ToDate >= snapshot.WorkDate, ct)) throw BusinessException.Conflict("Approved leave overlaps this shift.");
        var low = snapshot.WorkDate.AddDays(-1); var high = snapshot.WorkDate.AddDays(1);
        var neighbors = await db.Set<WorkSchedule>().AsNoTracking().Where(s => s.EmployeeID == employee.Id && s.ID != scheduleId && s.Status != "CANCELLED" && s.WorkDate >= low && s.WorkDate <= high).ToListAsync(ct);
        if (neighbors.Any(s => s.RulesSnapshotJson == null || Overlaps(snapshot, SettingsDefaults.Read<AttendanceRuleSnapshot>(s.RulesSnapshotJson)))) throw BusinessException.Conflict("Shift overlaps an existing or unverified legacy schedule.");
    }
    private sealed record BatchReceipt(string RequestHash, ScheduleBatchResult Result);
    private async Task NotifySchedules(int employeeId, string eventKey, int count, CancellationToken ct)
    {
        var users = await db.Set<User>().Where(u => u.EmployeeId == employeeId && u.Status == "ACTIVE").OrderBy(u => u.UserId).Select(u => u.UserId).ToArrayAsync(ct);
        if (users.Length == 0) return;
        await notifications.CreateInternalAsync(new CreateNotificationRequest { Title = "Lịch làm việc đã cập nhật", Content = $"Có {count} ngày làm việc được phân hoặc thay đổi. Vui lòng kiểm tra lịch làm việc.", ReferenceType = "WORK_SCHEDULE", ReferenceId = employeeId.ToString(CultureInfo.InvariantCulture), Targets = [new() { Type = "USER", UserIds = users }] }, "SYSTEM", "schedule:" + eventKey, "schedule-management", ct);
    }
}
