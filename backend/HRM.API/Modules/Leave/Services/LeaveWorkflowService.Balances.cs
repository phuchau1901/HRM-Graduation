using HRM.API.Common;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Leave.Services;
public sealed partial class LeaveWorkflowService
{
    public async Task<MyBalanceSummary> MyLeaveBalances(string actor, MyBalanceQuery q, CancellationToken ct)
    {
        if (!await permissions.HasPermissionAsync(actor, MyBalances, "VIEW", ct))
            throw new BusinessException(403, "HRM_AUTH_003", "Tài khoản chưa có quyền WEB_LEAVE_BALANCES / VIEW đang hiệu lực.", "PERMISSION_DENIED");
        var employee = await (from user in db.Set<User>().AsNoTracking()
                              join person in db.Employees.AsNoTracking() on user.EmployeeId equals (int?)person.Id
                              where user.UserId == actor && user.Status == "ACTIVE"
                              select new { person.Id, person.FullName, person.EmployeeCode }).SingleOrDefaultAsync(ct)
            ?? throw new BusinessException(403, "HRM_AUTH_006", "Tài khoản chưa liên kết với hồ sơ nhân viên hợp lệ.", "EMPLOYEE_LINK_REQUIRED");
        var today = VietnamBusinessDate.Today(clock); var year = q.Year ?? today.Year;
        var rows = await (from b in db.Set<LeaveBalance>().AsNoTracking()
                          join t in db.Set<LeaveType>().AsNoTracking() on b.LeaveTypeID equals t.ID
                          where b.EmployeeID == employee.Id && b.YearNo == year && (!q.LeaveTypeId.HasValue || b.LeaveTypeID == q.LeaveTypeId)
                          orderby b.LeaveTypeID
                          select new { Balance = b, TypeName = t.Name }).ToListAsync(ct);
        var balances = rows.Select(r => BalanceDto(r.Balance, employee.FullName, r.TypeName, employee.EmployeeCode)).ToArray();
        return new(employee.Id, year, today, balances.Sum(b => b.EntitledDays + b.CarriedOverDays + b.AdjustmentDays), balances.Sum(b => b.UsedDays),
            balances.Sum(b => b.RemainingDays), balances.Sum(b => b.ReservedDays), balances.Sum(b => b.AvailableDays), balances);
    }
    private static decimal Allocated(LeaveBalance b) => b.EntitledDays + b.CarriedOverDays + b.AdjustmentDays;
    private static void BalanceAmounts(LeaveBalance b)
    {
        foreach (var amount in new[] { b.EntitledDays, b.CarriedOverDays, b.AdjustmentDays })
            if (decimal.Round(amount, 2) != amount || Math.Abs(amount) > 99999.99m) throw BusinessException.Invalid("Days must have at most two decimals and fit the balance precision.");
        if (b.EntitledDays < 0 || b.CarriedOverDays < 0 || Allocated(b) > 99999.99m) throw BusinessException.Invalid("Invalid total allocation.");
        if (Allocated(b) < b.UsedDays + b.ReservedDays) throw BusinessException.Conflict("Allocation cannot be below used plus reserved days.");
    }
    private static BalanceView BalanceDto(LeaveBalance b, string employeeName, string typeName, string employeeCode) => new(b.ID, b.EmployeeID, employeeName, b.LeaveTypeID, typeName, b.YearNo,
        b.EntitledDays, b.UsedDays, b.ReservedDays, Allocated(b) - b.UsedDays - b.ReservedDays, b.Version, b.CarriedOverDays, b.AdjustmentDays, Allocated(b) - b.UsedDays, employeeCode);
    private void BalanceAudit(string? actor, LeaveBalance balance, string action, string? before, string reason, Guid? operationId = null)
        => accounting.Record(actor, balance, action, before, reason, operationId);
    public Task<BalanceView> SaveBalance(string actor, BalanceRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var access = await scopes.GetAsync(actor, Balances, "UPDATE", ct); access.DemandWrite();
        var employee = await access.Apply(db.Employees).SingleOrDefaultAsync(e => e.Id == request.EmployeeId, ct) ?? throw BusinessException.Missing();
        await db.Employees.Where(e => e.Id == employee.Id).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
        var type = await db.Set<LeaveType>().SingleOrDefaultAsync(t => t.ID == request.LeaveTypeId && t.IsActive, ct) ?? throw BusinessException.Invalid("Active leave type required.");
        var balance = await db.Set<LeaveBalance>().SingleOrDefaultAsync(b => b.EmployeeID == employee.Id && b.LeaveTypeID == type.ID && b.YearNo == request.Year, ct);
        if ((balance?.Version ?? 0) != request.Version) throw BusinessException.Conflict("Balance changed; reload.");
        if (balance != null && string.IsNullOrWhiteSpace(request.Reason)) throw BusinessException.Invalid("A reason is required when changing an allocation.");
        var before = balance == null ? null : Json(balance);
        if (balance == null) { balance = new LeaveBalance { EmployeeID = employee.Id, LeaveTypeID = type.ID, YearNo = request.Year }; db.Add(balance); }
        balance.EntitledDays = request.EntitledDays;
        if (request.CarriedOverDays.HasValue) balance.CarriedOverDays = request.CarriedOverDays.Value;
        BalanceAmounts(balance); if (request.Version > 0) balance.Version++;
        await db.SaveChangesAsync(ct);
        BalanceAudit(actor, balance, before == null ? "LEAVE_BALANCE_GRANTED" : "LEAVE_BALANCE_ALLOCATION_UPDATED", before, string.IsNullOrWhiteSpace(request.Reason) ? "Initial allocation" : request.Reason.Trim());
        return BalanceDto(balance, employee.FullName, type.Name, employee.EmployeeCode);
    }, ct);
    public Task<BalanceView> AdjustLeaveBalance(string actor, long id, BalanceAdjustmentRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var access = await scopes.GetAsync(actor, Balances, "UPDATE", ct); access.DemandWrite(); var employees = access.Apply(db.Employees);
        var balance = await db.Set<LeaveBalance>().SingleOrDefaultAsync(b => b.ID == id && employees.Any(e => e.Id == b.EmployeeID), ct) ?? throw BusinessException.Missing();
        await db.Employees.Where(e => e.Id == balance.EmployeeID).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
        if (balance.Version != request.Version) throw BusinessException.Conflict("Balance changed; reload.");
        if (request.Days == 0 || string.IsNullOrWhiteSpace(request.Reason)) throw BusinessException.Invalid("A nonzero adjustment and a reason are required.");
        var before = Json(balance); balance.AdjustmentDays += request.Days; BalanceAmounts(balance); balance.Version++;
        BalanceAudit(actor, balance, "LEAVE_BALANCE_ADJUSTED", before, request.Reason.Trim());
        var employee = await db.Employees.Where(e => e.Id == balance.EmployeeID).Select(e => new { e.FullName, e.EmployeeCode }).SingleAsync(ct);
        var typeName = await db.Set<LeaveType>().Where(t => t.ID == balance.LeaveTypeID).Select(t => t.Name).SingleAsync(ct);
        return BalanceDto(balance, employee.FullName, typeName, employee.EmployeeCode);
    }, ct);
    public async Task<PageResult<BalanceHistoryView>> LeaveBalanceHistory(string actor, long id, WorkflowQuery q, CancellationToken ct)
    {
        var employees = await Visible(actor, Balances, new(), ct);
        if (!await db.Set<LeaveBalance>().AnyAsync(b => b.ID == id && employees.Any(e => e.Id == b.EmployeeID), ct)) throw BusinessException.Missing();
        var key = id.ToString(global::System.Globalization.CultureInfo.InvariantCulture);
        var query = db.Set<AuditLog>().AsNoTracking().Where(a => a.EntityType == "LeaveBalance" && a.EntityID == key);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(a => a.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(a => new BalanceHistoryView(a.ID, a.ActorUserID, a.Action, a.BeforeJSON, a.AfterJSON, a.CreatedAt)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }
    private sealed record GrantRecord(string RequestHash, int[] EmployeeIds, BalanceGrantReceipt Receipt);
    public Task<BalanceGrantReceipt> GrantLeaveBalances(string actor, BalanceGrantRequest request, CancellationToken ct) => Transaction(async () =>
    {
        var access = await scopes.GetAsync(actor, Balances, "UPDATE", ct); access.DemandWrite();
        if (request.OperationId == Guid.Empty || string.IsNullOrWhiteSpace(request.Reason)) throw BusinessException.Invalid("OperationId and reason are required.");
        if ((request.Target == "EMPLOYEE" && (!request.EmployeeId.HasValue || request.DepartmentId.HasValue)) ||
            (request.Target == "DEPARTMENT" && (!request.DepartmentId.HasValue || request.EmployeeId.HasValue)) ||
            (request.Target == "ALL" && (request.EmployeeId.HasValue || request.DepartmentId.HasValue))) throw BusinessException.Invalid("Specify only the ID required by the target.");
        // Serializes idempotency claims across instances using the existing screen catalog row.
        // The permanent receipt is an AuditLog row, not a new business table or a setting.
        if (await db.Screens.Where(s => s.Code == Balances && s.IsActive).ExecuteUpdateAsync(s => s.SetProperty(s => s.IsActive, s => s.IsActive), ct) != 1) throw BusinessException.Scope();
        var key = request.OperationId.ToString("N");
        var hash = Convert.ToHexString(global::System.Security.Cryptography.SHA256.HashData(global::System.Text.Encoding.UTF8.GetBytes(Json(request))));
        var previous = await db.Set<AuditLog>().AsNoTracking().SingleOrDefaultAsync(a => a.EntityType == "LeaveBalanceGrant" && a.EntityID == key, ct);
        if (previous != null)
        {
            var record = Read<GrantRecord>(previous.AfterJSON!);
            if (previous.ActorUserID != actor || record.RequestHash != hash) throw BusinessException.Conflict("OperationId was already used for a different grant.");
            foreach (var chunk in record.EmployeeIds.Chunk(500))
                if (await access.Apply(db.Employees).CountAsync(e => chunk.Contains(e.Id), ct) != chunk.Length) throw BusinessException.Scope();
            return record.Receipt;
        }
        var type = await db.Set<LeaveType>().SingleOrDefaultAsync(t => t.ID == request.LeaveTypeId && t.IsActive, ct) ?? throw BusinessException.Invalid("Active leave type required.");
        BalanceAmounts(new LeaveBalance { EntitledDays = request.EntitledDays, CarriedOverDays = request.CarriedOverDays });
        var employees = access.Apply(db.Employees).Where(e => e.EmploymentStatus == "ACTIVE");
        if (request.Target == "EMPLOYEE") employees = employees.Where(e => e.Id == request.EmployeeId);
        else if (request.Target == "DEPARTMENT")
        {
            access.DemandDepartment(request.DepartmentId!.Value);
            if (!await db.Departments.AnyAsync(d => d.Id == request.DepartmentId && d.IsActive, ct)) throw BusinessException.Missing();
            employees = employees.Where(e => e.DepartmentId == request.DepartmentId);
        }
        var ids = await employees.OrderBy(e => e.Id).Select(e => e.Id).ToArrayAsync(ct);
        if (request.Target == "EMPLOYEE" && ids.Length == 0) throw BusinessException.Missing();
        var created = 0;
        foreach (var chunk in ids.Chunk(500))
        {
            await db.Employees.Where(e => chunk.Contains(e.Id)).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
            var existing = await db.Set<LeaveBalance>().Where(b => b.LeaveTypeID == type.ID && b.YearNo == request.Year && chunk.Contains(b.EmployeeID)).Select(b => b.EmployeeID).ToArrayAsync(ct);
            var rows = chunk.Except(existing).Select(employee => new LeaveBalance { EmployeeID = employee, LeaveTypeID = type.ID, YearNo = request.Year,
                EntitledDays = request.EntitledDays, CarriedOverDays = request.CarriedOverDays }).ToArray();
            db.AddRange(rows); await db.SaveChangesAsync(ct); created += rows.Length;
            foreach (var balance in rows) BalanceAudit(actor, balance, "LEAVE_BALANCE_GRANTED", null, request.Reason.Trim(), request.OperationId);
        }
        var receipt = new BalanceGrantReceipt(request.OperationId, ids.Length, created, ids.Length - created);
        db.Add(new AuditLog { ActorUserID = actor, EntityType = "LeaveBalanceGrant", EntityID = key, Action = "LEAVE_BALANCES_GRANTED",
            AfterJSON = Json(new GrantRecord(hash, ids, receipt)), CreatedAt = Now });
        return receipt;
    }, ct);
}
