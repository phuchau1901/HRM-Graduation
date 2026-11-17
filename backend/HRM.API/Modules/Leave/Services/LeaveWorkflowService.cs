using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.DTOs;
using System.Data;
using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.Leave.Services;

public sealed partial class LeaveWorkflowService(AppDbContext db, EmployeeDataScope scopes, IPermissionService permissions,
    SystemSettingsService settings, TimeProvider clock, ApprovalWorkflowService approvals, LeaveBalanceAccounting accounting)
{
    public const string Leave = "WEB_LEAVE_REQUESTS", Balances = "WEB_LEAVE_MANAGEMENT", MyBalances = "WEB_LEAVE_BALANCES", Types = "WEB_LEAVE_TYPES",
        Overtime = "WEB_OVERTIME_REQUESTS", Approvals = ApprovalWorkflowService.Approvals, Adjustments = "WEB_ATTENDANCE_ADJUSTMENTS",
        Configuration = ApprovalWorkflowService.Configuration, SettingsKey = ApprovalWorkflowService.SettingsKey;
    private DateTime Now => clock.GetUtcNow().UtcDateTime;
    private static string Json(object value) => JsonSerializer.Serialize(value, SettingsDefaults.Json);
    private static T Read<T>(string json) => JsonSerializer.Deserialize<T>(json, SettingsDefaults.Json) ?? throw BusinessException.Conflict("Invalid workflow snapshot.");
    private static void Validate(object value)
    {
        if (!Validator.TryValidateObject(value, new ValidationContext(value), [], true)) throw BusinessException.Invalid("Invalid workflow configuration.");
    }
    private async Task<T> Transaction<T>(Func<Task<T>> action, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try { var result = await action(); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return result; }
        catch (DbUpdateConcurrencyException) { throw BusinessException.Conflict("Request changed; reload before retrying."); }
        catch (Exception e) when (IsLockConflict(e)) { throw BusinessException.Conflict("Concurrent workflow operation; reload before retrying."); }
    }
    private static bool IsLockConflict(Exception e) => e is MySqlException { Number: 1213 or 1205 }
        || e.InnerException is not null && IsLockConflict(e.InnerException);
    private async Task Demand(string actor, string screen, string action, CancellationToken ct)
    { if (!await permissions.HasPermissionAsync(actor, screen, action, ct)) throw BusinessException.Scope(); }
    private async Task<Employee> Own(string actor, string screen, string action, CancellationToken ct)
    {
        var access = await scopes.GetAsync(actor, screen, action, ct);
        var employee = await access.Apply(db.Employees).SingleOrDefaultAsync(e => e.Id == access.EmployeeId && (action != "NEW" || e.EmploymentStatus == "ACTIVE"), ct) ?? throw BusinessException.Scope();
        // Serialize submissions/cancellations for the same employee, including empty overlap sets.
        await db.Employees.Where(e => e.Id == employee.Id).ExecuteUpdateAsync(s => s.SetProperty(e => e.CreatedAt, e => e.CreatedAt), ct);
        return employee;
    }
    private async Task<IQueryable<Employee>> Visible(string actor, string screen, WorkflowQuery q, CancellationToken ct, string action = "VIEW")
    {
        var access = await scopes.GetAsync(actor, screen, action, ct); var employees = access.Apply(db.Employees.AsNoTracking());
        if (q.View == "MY") employees = employees.Where(e => e.Id == access.EmployeeId);
        if (q.View == "TEAM")
        {
            if (access.Scope == "SELF") throw BusinessException.Scope();
            employees = employees.Where(e => e.DepartmentId == access.DepartmentId);
        }
        if (q.EmployeeId.HasValue) employees = employees.Where(e => e.Id == q.EmployeeId);
        return employees;
    }
    private void Audit(string actor, long id, string action, object? before, object? after) => approvals.RecordEvent(actor, id, action, before, after);
    private Task<ApprovalRequest> Start(string actor, Employee employee, string kind, long reference, CancellationToken ct) => approvals.StartAsync(actor, employee, kind, reference, ct);
}
