using HRM.API.Common;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Leave.Services;
public sealed partial class LeaveWorkflowService
{
    public const string AccrualSettingsScreen = "WEB_SYSTEM_SETTINGS", AccrualSettingsKey = "LEAVE_ACCRUAL";
    public async Task<LeaveAccrualSettingsView> GetAccrualSettings(string actor, CancellationToken ct)
    {
        await DemandAccrualPermission(actor, "VIEW", ct);
        var row = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(s => s.Key == AccrualSettingsKey, ct);
        var today = VietnamBusinessDate.Today(clock);
        var policy = row == null ? new LeaveAccrualPolicy { ScheduleVersion = 2, EffectiveFrom = today, AccrualSchedule = new() { StartDate = today } } : Read<LeaveAccrualPolicy>(row.JsonValue);
        return await AccrualView(row?.Version ?? 0, policy, ct);
    }
    private async Task DemandAccrualPermission(string actor, string action, CancellationToken ct)
    {
        if (!await permissions.HasPermissionAsync(actor, AccrualSettingsScreen, action, ct))
            throw new BusinessException(403, "HRM_AUTH_003", $"Required permission: {AccrualSettingsScreen} / {action}.", "PERMISSION_DENIED");
    }
    private async Task<long?> AnnualLeaveType(CancellationToken ct) => await db.Set<LeaveType>().AsNoTracking()
        .Where(t => t.Code == "ANNUAL" && t.IsActive && t.RequiresBalance).Select(t => (long?)t.ID).SingleOrDefaultAsync(ct);
    private async Task<LeaveAccrualSettingsView> AccrualView(long version, LeaveAccrualPolicy policy, CancellationToken ct)
        => new(version, policy, await AnnualLeaveType(ct), VietnamBusinessDate.Today(clock), LeaveRecurrenceCalendar.First(policy.AccrualSchedule), LeaveRecurrenceCalendar.First(policy.ResetSchedule));
    private static decimal AccrualDays(LeaveAccrualRule rule) => rule.DaysPerCycle ?? rule.DaysPerMonth ?? 0;
    private async Task NormalizeAccrualRules(LeaveAccrualPolicy policy, CancellationToken ct)
    {
        long? annual = null;
        foreach (var rule in policy.Rules)
        {
            if (!rule.LeaveTypeId.HasValue)
            {
                annual ??= await AnnualLeaveType(ct);
                rule.LeaveTypeId = annual ?? throw BusinessException.Invalid("Configure an active ANNUAL leave type with requires_balance=true before using the annual-leave default.");
            }
            if (policy.ScheduleVersion == 2) rule.DaysPerCycle ??= rule.DaysPerMonth;
        }
    }
    private static bool SameSchedule(LeaveRecurrence? a, LeaveRecurrence? b) => a != null && b != null && a.StartDate == b.StartDate && a.Interval == b.Interval && a.Unit == b.Unit;
    private static void ValidateRecurrence(LeaveRecurrence? schedule, LeaveRecurrence? previous, DateOnly today)
    {
        if (schedule == null) return;
        Validate(schedule);
        var first = LeaveRecurrenceCalendar.First(schedule);
        if (schedule.StartDate.Year < 1900 || first == null) throw BusinessException.Invalid("The first recurrence falls outside the supported calendar.");
        if (schedule.StartDate < today && !SameSchedule(schedule, previous) && first <= today)
            throw BusinessException.Invalid("A new or changed past anchor requires its first activation to be in the future; existing unchanged schedules may retain their anchor.");
    }
    public Task<LeaveAccrualSettingsView> SaveAccrualSettings(string actor, LeaveAccrualSettingsRequest request, CancellationToken ct) => Transaction(async () =>
    {
        await DemandAccrualPermission(actor, "UPDATE", ct);
        await db.Screens.Where(s => s.Code == AccrualSettingsScreen && s.IsActive).ExecuteUpdateAsync(s => s.SetProperty(s => s.IsActive, s => s.IsActive), ct);
        Validate(request); Validate(request.Settings);
        var policy = request.Settings; var today = VietnamBusinessDate.Today(clock);
        var row = await db.Set<SystemSetting>().SingleOrDefaultAsync(s => s.Key == AccrualSettingsKey, ct);
        if ((row?.Version ?? 0) != request.Version) throw BusinessException.Conflict("Leave accrual settings changed; reload.");
        var oldPolicy = row == null ? null : Read<LeaveAccrualPolicy>(row.JsonValue);
        if (policy.AccrualSchedule != null || policy.ResetSchedule != null) policy.ScheduleVersion = 2;
        if (policy.ScheduleVersion == 2)
        {
            ValidateRecurrence(policy.AccrualSchedule, oldPolicy?.AccrualSchedule, today);
            ValidateRecurrence(policy.ResetSchedule, oldPolicy?.ResetSchedule, today);
            if (policy.Enabled && policy.AccrualSchedule == null && policy.ResetSchedule == null) throw BusinessException.Invalid("Enable an accrual or reset schedule.");
            var anchors = new[] { policy.AccrualSchedule?.StartDate, policy.ResetSchedule?.StartDate }.Where(d => d.HasValue).Select(d => d!.Value).ToArray();
            policy.EffectiveFrom = anchors.Length == 0 ? today : anchors.Min();
        }
        else
        {
            if (policy.EffectiveFrom.Year < 1900 || policy.EffectiveFrom < today && policy.EffectiveFrom != oldPolicy?.EffectiveFrom)
                throw BusinessException.Invalid("New effective dates must be today or later; historical awards are not inferred.");
            if (policy.ResetOn.HasValue && policy.ResetOn < policy.EffectiveFrom) throw BusinessException.Invalid("ResetOn must not precede EffectiveFrom.");
        }
        if (policy.Enabled && policy.Rules.Length == 0 || policy.Rules.Any(r => r == null)) throw BusinessException.Invalid("Enabled policy requires valid position rules.");
        await NormalizeAccrualRules(policy, ct);
        if (policy.Rules.Select(r => (r.PositionId, r.LeaveTypeId)).Distinct().Count() != policy.Rules.Length) throw BusinessException.Invalid("Duplicate position/leave-type rules.");
        foreach (var rule in policy.Rules)
        {
            Validate(rule); var days = AccrualDays(rule);
            if ((policy.ScheduleVersion == 1 || policy.AccrualSchedule != null) && days <= 0 || decimal.Round(days, 2) != days)
                throw BusinessException.Invalid("Accrual requires positive days per cycle with at most two decimals.");
        }
        var positions = policy.Rules.Select(r => r.PositionId).Distinct().ToArray(); var types = policy.Rules.Select(r => r.LeaveTypeId!.Value).Distinct().ToArray();
        if (await db.Set<Position>().CountAsync(p => positions.Contains(p.ID) && p.IsActive, ct) != positions.Length ||
            await db.Set<LeaveType>().CountAsync(t => types.Contains(t.ID) && t.IsActive && t.RequiresBalance, ct) != types.Length)
            throw BusinessException.Invalid("Rules require active positions and balance-tracked leave types.");
        var before = row?.JsonValue;
        if (row == null) { row = new SystemSetting { Key = AccrualSettingsKey, Version = 0 }; db.Add(row); }
        row.JsonValue = Json(policy); row.Version++; row.UpdatedAtUtc = Now;
        db.Add(new AuditLog { ActorUserID = actor, EntityType = "System", EntityID = AccrualSettingsKey, Action = "LEAVE_ACCRUAL_SETTINGS_UPDATED", BeforeJSON = before, AfterJSON = row.JsonValue, CreatedAt = Now });
        return await AccrualView(row.Version, policy, ct);
    }, ct);
    public async Task<LeaveAccrualRunView> RunAccrualNow(string actor, CancellationToken ct)
    {
        await DemandAccrualPermission(actor, "UPDATE", ct);
        return await RunAccrual(actor, ct);
    }
    // Internal scheduled execution. The only HTTP entry point independently demands live system-settings UPDATE authority.
    public Task<LeaveAccrualRunView> RunScheduledAccrual(CancellationToken ct) => RunAccrual(null, ct);
    private Task<LeaveAccrualRunView> RunAccrual(string? actor, CancellationToken ct) => Transaction(async () =>
    {
        var today = VietnamBusinessDate.Today(clock);
        if (!await db.Set<SystemSetting>().AnyAsync(s => s.Key == AccrualSettingsKey, ct)) return new LeaveAccrualRunView(today, 0, 0, false, false);
        // Serializes worker instances, manual execution and configuration changes.
        await db.Set<SystemSetting>().Where(s => s.Key == AccrualSettingsKey).ExecuteUpdateAsync(s => s.SetProperty(s => s.Version, s => s.Version), ct);
        var config = await db.Set<SystemSetting>().AsNoTracking().SingleAsync(s => s.Key == AccrualSettingsKey, ct);
        var policy = Read<LeaveAccrualPolicy>(config.JsonValue);
        if (!policy.Enabled || today < policy.EffectiveFrom) return new LeaveAccrualRunView(today, 0, 0, false, false);
        await NormalizeAccrualRules(policy, ct);
        var activePositions = await db.Set<Position>().Where(p => p.IsActive).Select(p => p.ID).ToArrayAsync(ct);
        var activeTypes = await db.Set<LeaveType>().Where(t => t.IsActive && t.RequiresBalance).Select(t => t.ID).ToArrayAsync(ct);
        var rules = policy.Rules.Where(r => activePositions.Contains(r.PositionId) && activeTypes.Contains(r.LeaveTypeId!.Value)).ToArray();
        var positionIds = rules.Select(r => r.PositionId).Distinct().ToArray(); var typeIds = rules.Select(r => r.LeaveTypeId!.Value).Distinct().ToArray();
        var employees = await db.Employees.AsNoTracking().Where(e => e.EmploymentStatus == "ACTIVE" && e.PositionId.HasValue && positionIds.Contains(e.PositionId.Value) && e.HireDate <= today)
            .OrderBy(e => e.Id).Select(e => new { e.Id, PositionId = e.PositionId!.Value, e.HireDate }).ToListAsync(ct);
        var expired = 0; var credited = 0; var resetProcessed = false; var accrualProcessed = false;
        DateOnly? reset = policy.ScheduleVersion == 2 ? LeaveRecurrenceCalendar.Latest(policy.ResetSchedule, today) : policy.ResetOn;
        if (policy.ScheduleVersion == 1 && reset.HasValue && policy.RepeatResetYearly)
        {
            var candidate = new DateOnly(today.Year, reset.Value.Month, Math.Min(reset.Value.Day, DateTime.DaysInMonth(today.Year, reset.Value.Month)));
            if (candidate > today && today.Year > 1) candidate = new(today.Year - 1, reset.Value.Month, Math.Min(reset.Value.Day, DateTime.DaysInMonth(today.Year - 1, reset.Value.Month)));
            reset = candidate >= policy.ResetOn ? candidate : null;
        }
        if (reset.HasValue && reset >= policy.EffectiveFrom && reset <= today)
        {
            var key = "reset:" + reset.Value.ToString("yyyyMMdd", global::System.Globalization.CultureInfo.InvariantCulture);
            resetProcessed = await db.Set<AuditLog>().AnyAsync(a => a.EntityType == "LeaveAutomation" && a.EntityID == key, ct);
            if (!resetProcessed)
            {
                // January 1 closes last year's availability; it must not erase new-year allocations.
                var year = reset.Value.Month == 1 && reset.Value.Day == 1 ? reset.Value.Year - 1 : reset.Value.Year;
                foreach (var chunk in employees.Where(e => e.HireDate <= reset.Value).Chunk(500))
                {
                    var ids = chunk.Select(e => e.Id).ToArray();
                    await db.Employees.Where(e => ids.Contains(e.Id)).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
                    var balances = await db.Set<LeaveBalance>().Where(b => ids.Contains(b.EmployeeID) && typeIds.Contains(b.LeaveTypeID) && (policy.ScheduleVersion == 2 ? b.YearNo <= year : b.YearNo == year)).ToListAsync(ct);
                    foreach (var balance in balances)
                    {
                        var employee = chunk.First(e => e.Id == balance.EmployeeID);
                        if (!rules.Any(r => r.PositionId == employee.PositionId && r.LeaveTypeId == balance.LeaveTypeID)) continue;
                        var unused = Allocated(balance) - balance.UsedDays - balance.ReservedDays;
                        if (unused <= 0) continue;
                        var before = Json(balance); balance.AdjustmentDays -= unused; BalanceAmounts(balance); balance.Version++; expired++;
                        BalanceAudit(actor, balance, "LEAVE_BALANCE_EXPIRED", before, $"Scheduled reset on {reset:yyyy-MM-dd}; used and reserved days retained");
                    }
                }
                db.Add(new AuditLog { ActorUserID = actor, EntityType = "LeaveAutomation", EntityID = key, Action = "LEAVE_RESET_COMPLETED", AfterJSON = Json(new { policyVersion = config.Version, date = reset, expiredBalances = expired }), CreatedAt = Now });
                await db.SaveChangesAsync(ct);
            }
        }
        DateOnly? accrualDue = policy.ScheduleVersion == 2 ? LeaveRecurrenceCalendar.Latest(policy.AccrualSchedule, today)
            : new DateOnly(today.Year, today.Month, Math.Min(policy.AccrualDay, DateTime.DaysInMonth(today.Year, today.Month)));
        if (accrualDue is { } due && due >= policy.EffectiveFrom && due <= today && (!reset.HasValue || reset > today || due >= reset))
        {
            var key = policy.ScheduleVersion == 2 ? "accrual-cycle:" + due.ToString("yyyyMMdd", global::System.Globalization.CultureInfo.InvariantCulture)
                : "accrual:" + due.ToString("yyyyMM", global::System.Globalization.CultureInfo.InvariantCulture);
            accrualProcessed = await db.Set<AuditLog>().AnyAsync(a => a.EntityType == "LeaveAutomation" && a.EntityID == key, ct);
            if (!accrualProcessed)
            {
                foreach (var chunk in employees.Where(e => e.HireDate <= due && (policy.NewHireEligibility != "ONE_MONTH" || e.HireDate <= DateOnly.MaxValue.AddMonths(-1) && e.HireDate.AddMonths(1) <= due)).Chunk(500))
                {
                    var ids = chunk.Select(e => e.Id).ToArray();
                    await db.Employees.Where(e => ids.Contains(e.Id)).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
                    var balances = await db.Set<LeaveBalance>().Where(b => ids.Contains(b.EmployeeID) && typeIds.Contains(b.LeaveTypeID) && b.YearNo == due.Year).ToListAsync(ct);
                    var changes = new List<(LeaveBalance Balance, string? Before, decimal Days)>();
                    foreach (var employee in chunk)
                    foreach (var rule in rules.Where(r => r.PositionId == employee.PositionId))
                    {
                        var balance = balances.SingleOrDefault(b => b.EmployeeID == employee.Id && b.LeaveTypeID == rule.LeaveTypeId);
                        var before = balance == null ? null : Json(balance);
                        if (balance == null) { balance = new LeaveBalance { EmployeeID = employee.Id, LeaveTypeID = rule.LeaveTypeId!.Value, YearNo = (short)due.Year }; db.Add(balance); }
                        else balance.Version++;
                        balance.EntitledDays += AccrualDays(rule); BalanceAmounts(balance); credited++;
                        changes.Add((balance, before, AccrualDays(rule)));
                    }
                    await db.SaveChangesAsync(ct);
                    foreach (var change in changes) BalanceAudit(actor, change.Balance, "LEAVE_BALANCE_ACCRUED", change.Before, $"Scheduled accrual {due:yyyy-MM-dd}: +{change.Days} days, policy version {config.Version}");
                }
                db.Add(new AuditLog { ActorUserID = actor, EntityType = "LeaveAutomation", EntityID = key, Action = "LEAVE_ACCRUAL_COMPLETED", AfterJSON = Json(new { policyVersion = config.Version, dueDate = due, creditedBalances = credited }), CreatedAt = Now });
            }
        }
        return new LeaveAccrualRunView(today, credited, expired, accrualProcessed, resetProcessed);
    }, ct);
}
