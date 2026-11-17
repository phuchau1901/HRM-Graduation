using HRM.API.Common;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
using HRM.API.Modules.Attendance.Entities;
namespace HRM.API.Modules.Leave.Services;
public sealed partial class LeaveWorkflowService
{
    public async Task<PageResult<LeaveTypeView>> LeaveTypes(string actor, WorkflowQuery q, CancellationToken ct)
    {
        await Demand(actor, Types, "VIEW", ct); var query = db.Set<LeaveType>().AsNoTracking();
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(t => t.Code.Contains(q.Search) || t.Name.Contains(q.Search));
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await query.OrderBy(t => t.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(t => new LeaveTypeView(t.ID, t.Code, t.Name, t.Paid, t.RequiresBalance, t.IsActive)).ToListAsync(ct));
    }
    public Task<LeaveTypeView> SaveType(string actor, long? id, LeaveTypeRequest request, CancellationToken ct) => Transaction(async () =>
    {
        await Demand(actor, Types, id.HasValue ? "UPDATE" : "NEW", ct);
        if (await db.Set<LeaveType>().AnyAsync(t => t.Code == request.Code && t.ID != id, ct)) throw BusinessException.Conflict("Leave type code already exists.");
        var type = id.HasValue ? await db.Set<LeaveType>().FindAsync([id.Value], ct) ?? throw BusinessException.Missing() : new LeaveType();
        var before = Json(type); type.Code = request.Code; type.Name = request.Name.Trim(); type.Paid = request.Paid; type.RequiresBalance = request.RequiresBalance; type.IsActive = request.IsActive;
        if (!id.HasValue) db.Add(type); await db.SaveChangesAsync(ct);
        db.Add(new HRM.API.Modules.System.Entities.AuditLog { ActorUserID = actor, EntityType = "LeaveType", EntityID = type.ID.ToString(), Action = "LEAVE_TYPE_SAVED", BeforeJSON = before, AfterJSON = Json(type), CreatedAt = Now });
        return new LeaveTypeView(type.ID, type.Code, type.Name, type.Paid, type.RequiresBalance, type.IsActive);
    }, ct);
    public async Task<PageResult<BalanceView>> LeaveBalances(string actor, WorkflowQuery q, CancellationToken ct)
    {
        var employees = await Visible(actor, Balances, q, ct);
        var query = from b in db.Set<LeaveBalance>().AsNoTracking() join e in employees on b.EmployeeID equals e.Id join t in db.Set<LeaveType>() on b.LeaveTypeID equals t.ID
                    where !q.Year.HasValue || b.YearNo == q.Year select new { Balance = b, Employee = e, Type = t };
        var total = await query.CountAsync(ct);
        var rows = await query.OrderBy(x => x.Employee.Id).ThenBy(x => x.Type.ID).ThenBy(x => x.Balance.YearNo).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(x => new BalanceView(x.Balance.ID, x.Employee.Id, x.Employee.FullName, x.Type.ID, x.Type.Name, x.Balance.YearNo, x.Balance.EntitledDays, x.Balance.UsedDays,
                x.Balance.ReservedDays, x.Balance.EntitledDays - x.Balance.UsedDays - x.Balance.ReservedDays, x.Balance.Version)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }

    public Task<BalanceView> SaveBalance(string actor, BalanceRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var access = await scopes.GetAsync(actor, Balances, "UPDATE", ct); access.DemandWrite();
        var employee = await access.Apply(db.Employees).SingleOrDefaultAsync(e => e.Id == request.EmployeeId, ct) ?? throw BusinessException.Missing();
        await db.Employees.Where(e => e.Id == employee.Id).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
        var type = await db.Set<LeaveType>().FindAsync([request.LeaveTypeId], ct) ?? throw BusinessException.Invalid("Unknown leave type.");
        if (decimal.Round(request.EntitledDays, 2) != request.EntitledDays) throw BusinessException.Invalid("Entitlement allows at most two decimals.");
        var balance = await db.Set<LeaveBalance>().SingleOrDefaultAsync(b => b.EmployeeID == employee.Id && b.LeaveTypeID == type.ID && b.YearNo == request.Year, ct);
        if ((balance?.Version ?? 0) != request.Version) throw BusinessException.Conflict("Balance changed; reload.");
        var before = balance is null ? null : Json(balance);
        if (balance is null) { balance = new LeaveBalance { EmployeeID = employee.Id, LeaveTypeID = type.ID, YearNo = request.Year }; db.Add(balance); }
        if (request.EntitledDays < balance.UsedDays + balance.ReservedDays) throw BusinessException.Conflict("Entitlement cannot be below used plus reserved days.");
        balance.EntitledDays = request.EntitledDays; if (request.Version > 0) balance.Version++;
        await db.SaveChangesAsync(ct);
        db.Add(new HRM.API.Modules.System.Entities.AuditLog { ActorUserID = actor, EntityType = "LeaveBalance", EntityID = balance.ID.ToString(), Action = "LEAVE_BALANCE_UPDATED", BeforeJSON = before, AfterJSON = Json(balance), CreatedAt = Now });
        return new BalanceView(balance.ID, employee.Id, employee.FullName, type.ID, type.Name, balance.YearNo, balance.EntitledDays, balance.UsedDays, balance.ReservedDays, balance.EntitledDays - balance.UsedDays - balance.ReservedDays, balance.Version);
    }, ct);
    public Task<WorkflowReceipt> CreateLeave(string actor, LeaveCreateRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var employee = await Own(actor, Leave, "NEW", ct);
        var today = VietnamBusinessDate.Today(clock);
        if (request.FromDate < today || request.ToDate < request.FromDate || request.ToDate.DayNumber - request.FromDate.DayNumber > 366) throw BusinessException.Invalid("Leave dates must be today/future, ordered and at most 367 calendar days.");
        var type = await db.Set<LeaveType>().SingleOrDefaultAsync(t => t.ID == request.LeaveTypeId && t.IsActive, ct) ?? throw BusinessException.Invalid("Active leave type required.");
        if (await db.Set<LeaveRequest>().AnyAsync(r => r.EmployeeID == employee.Id && (r.Status == "PENDING" || r.Status == "APPROVED" || r.Status == "CANCELLATION_PENDING") && r.FromDate <= request.ToDate && r.ToDate >= request.FromDate, ct)) throw BusinessException.Conflict("Leave overlaps another live request.");
        var workDays = (await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct)).Settings.WorkingDays;
        var allocations = new List<BalanceAllocation>(); decimal total = 0;
        var daysByYear = Enumerable.Range(0, request.ToDate.DayNumber - request.FromDate.DayNumber + 1).Select(request.FromDate.AddDays)
            .Where(d => workDays.Contains(((int)d.DayOfWeek + 6) % 7 + 1)).GroupBy(d => d.Year);
        foreach (var year in daysByYear)
        {
            var days = year.Count(); total += days;
            if (!type.RequiresBalance) continue;
            var balance = await db.Set<LeaveBalance>().SingleOrDefaultAsync(b => b.EmployeeID == employee.Id && b.LeaveTypeID == type.ID && b.YearNo == year.Key, ct) ?? throw BusinessException.Invalid("Leave balance is not configured for every requested year.");
            if (balance.EntitledDays - balance.UsedDays - balance.ReservedDays < days) throw BusinessException.Conflict("Insufficient available leave balance.");
            balance.ReservedDays += days; balance.Version++; allocations.Add(new(balance.ID, days));
        }
        if (total == 0) throw BusinessException.Invalid("Range contains no configured working days.");
        var row = new LeaveRequest { EmployeeID = employee.Id, LeaveTypeID = type.ID, FromDate = request.FromDate, ToDate = request.ToDate, RequestedDays = total, Reason = request.Reason.Trim(), Status = "PENDING", CreatedAt = Now, BalanceAllocationJson = Json(allocations) };
        db.Add(row); await db.SaveChangesAsync(ct);
        var approval = await Start(actor, employee, "LEAVE", row.ID, ct);
        return new WorkflowReceipt(row.ID, approval.ID, row.Status, row.Version);
    }, ct);
    public Task<WorkflowReceipt> CreateOvertime(string actor, OvertimeCreateRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var employee = await Own(actor, Overtime, "NEW", ct); var start = request.StartAt.UtcDateTime; var end = request.EndAt.UtcDateTime;
        if (start.Year < 1000 || end <= start || (end - start).TotalMinutes < 1 || (end - start).TotalHours > 24) throw BusinessException.Invalid("Overtime must last between one minute and 24 hours.");
        if (await db.Set<OvertimeRequest>().AnyAsync(r => r.EmployeeID == employee.Id && (r.Status == "PENDING" || r.Status == "APPROVED") && r.StartAt < end && r.EndAt > start, ct)) throw BusinessException.Conflict("Overtime overlaps another live request.");
        var row = new OvertimeRequest { EmployeeID = employee.Id, StartAt = start, EndAt = end, RequestedHours = decimal.Round((decimal)(end - start).TotalHours, 2), ApprovedHours = null, Reason = request.Reason.Trim(), Status = "PENDING", CreatedAt = Now };
        db.Add(row); await db.SaveChangesAsync(ct); var approval = await Start(actor, employee, "OVERTIME", row.ID, ct);
        return new WorkflowReceipt(row.ID, approval.ID, row.Status, row.Version);
    }, ct);
    private static string AttendanceSnapshot(AttendanceEntity row) => Json(new { row.CheckInAt, row.CheckOutAt, row.CheckInQRID, row.CheckOutQRID, row.LateMinutes, row.EarlyMinutes, row.Status });
    private AttendanceRuleSnapshot ValidateCorrection(WorkSchedule schedule, DateTime? checkIn, DateTime? checkOut)
    {
        if (schedule.Status == "CANCELLED" || schedule.RulesSnapshotJson is null) throw BusinessException.Conflict("Schedule is cancelled or has no rules snapshot.");
        var rules = Read<AttendanceRuleSnapshot>(schedule.RulesSnapshotJson);
        if ((!checkIn.HasValue && !checkOut.HasValue) || checkOut < checkIn || checkOut == checkIn || checkIn > Now || checkOut > Now ||
            checkIn < rules.CheckInOpenUtc || checkIn > rules.CheckOutCloseUtc || checkOut < rules.CheckInOpenUtc || checkOut > rules.CheckOutCloseUtc)
            throw BusinessException.Invalid("Correction timestamps must be past, ordered and inside the schedule's correction envelope.");
        return rules;
    }
    public Task<WorkflowReceipt> CreateAdjustment(string actor, AdjustmentCreateRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var employee = await Own(actor, Adjustments, "NEW", ct);
        var attendance = await db.Set<AttendanceEntity>().SingleOrDefaultAsync(a => a.ID == request.AttendanceId, ct) ?? throw BusinessException.Missing();
        var schedule = await db.Set<WorkSchedule>().SingleOrDefaultAsync(s => s.ID == attendance.ScheduleID && s.EmployeeID == employee.Id, ct) ?? throw BusinessException.Missing();
        await db.Set<WorkSchedule>().Where(s => s.ID == schedule.ID).ExecuteUpdateAsync(s => s.SetProperty(x => x.Version, x => x.Version), ct);
        ValidateCorrection(schedule, request.ProposedCheckIn?.UtcDateTime, request.ProposedCheckOut?.UtcDateTime);
        if (await db.Set<AttendanceAdjustment>().AnyAsync(a => a.AttendanceID == attendance.ID && a.Status == "PENDING", ct)) throw BusinessException.Conflict("Attendance already has a pending adjustment.");
        var row = new AttendanceAdjustment { AttendanceID = attendance.ID, EmployeeID = employee.Id, ProposedCheckIn = request.ProposedCheckIn?.UtcDateTime, ProposedCheckOut = request.ProposedCheckOut?.UtcDateTime, OriginalAttendanceJson = AttendanceSnapshot(attendance), ExpectedScheduleVersion = schedule.Version, Reason = request.Reason.Trim(), Status = "PENDING" };
        db.Add(row); await db.SaveChangesAsync(ct); var approval = await Start(actor, employee, "ATTENDANCE_ADJUSTMENT", row.ID, ct);
        return new WorkflowReceipt(row.ID, approval.ID, row.Status, row.Version);
    }, ct);
}
