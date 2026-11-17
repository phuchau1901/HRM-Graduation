using System.Data;
using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.Leave.Services;

public sealed partial class LeaveWorkflowService(AppDbContext db, EmployeeDataScope scopes, IPermissionService permissions,
    NotificationService notifications, SystemSettingsService settings, TimeProvider clock)
{
    public const string Leave = "WEB_LEAVE_REQUESTS", Balances = "WEB_LEAVE_BALANCES", Types = "WEB_LEAVE_TYPES",
        Overtime = "WEB_OVERTIME_REQUESTS", Approvals = "WEB_APPROVALS", Adjustments = "WEB_ATTENDANCE_ADJUSTMENTS",
        Configuration = "WEB_APPROVAL_SETTINGS", SettingsKey = "APPROVAL_WORKFLOWS";
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
    private void Audit(string actor, long approvalId, string action, object? before, object? after) => db.Add(new AuditLog
    {
        ActorUserID = actor, EntityType = "ApprovalRequest", EntityID = approvalId.ToString(CultureInfo.InvariantCulture),
        Action = action, BeforeJSON = before is null ? null : Json(before), AfterJSON = after is null ? null : Json(after), CreatedAt = Now
    });
    private async Task Notify(ApprovalRequest approval, string user, string eventKey, string message, CancellationToken ct)
    {
        await notifications.CreateInternalAsync(new CreateNotificationRequest
        {
            Title = "Approval workflow", Content = message, ReferenceType = "APPROVAL", ReferenceId = approval.ID.ToString(CultureInfo.InvariantCulture),
            Targets = [new NotificationTargetRequest { Type = "USER", UserIds = [user] }]
        }, "WORKFLOW", $"approval:{approval.ID}:{eventKey}", $"workflow-{approval.ID}", ct);
    }
    public async Task<WorkflowSettingsView> GetSettings(string actor, CancellationToken ct)
    {
        await Demand(actor, Configuration, "VIEW", ct);
        var row = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(s => s.Key == SettingsKey, ct);
        return row is null ? new(0, []) : new(row.Version, Read<WorkflowRoute[]>(row.JsonValue));
    }
    public Task<WorkflowSettingsView> SaveSettings(string actor, WorkflowSettingsRequest request, CancellationToken ct) => Transaction(async () =>
    {
        await Demand(actor, Configuration, "UPDATE", ct); Validate(request);
        if (request.Routes.Any(r => r is null) || request.Routes.Select(r => r.RequestType).Distinct().Count() != request.Routes.Length) throw BusinessException.Invalid("Duplicate or null routes.");
        foreach (var route in request.Routes)
        {
            Validate(route);
            foreach (var step in route.Steps)
            {
                if (step is null) throw BusinessException.Invalid("Null approval step."); Validate(step);
                if (step.ApproverType == "USER" && (string.IsNullOrWhiteSpace(step.UserId) || !await db.Set<User>().AnyAsync(u => u.UserId == step.UserId && u.Status == "ACTIVE", ct)))
                    throw BusinessException.Invalid("USER step requires an active user.");
                if (step.ApproverType == "HR" && (string.IsNullOrWhiteSpace(step.UserId) || !await db.Set<User>().AnyAsync(u => u.UserId == step.UserId && u.Status == "ACTIVE" && db.Set<UserRole>().Any(ur => ur.UserID == u.UserId && db.Set<Role>().Any(r => r.ID == ur.RoleID && r.Code == step.RoleCode)), ct)))
                    throw BusinessException.Invalid("HR step requires an active user assigned to its configured role.");
            }
        }
        var row = await db.Set<SystemSetting>().SingleOrDefaultAsync(s => s.Key == SettingsKey, ct);
        if ((row?.Version ?? 0) != request.Version) throw BusinessException.Conflict("Workflow settings changed; reload.");
        var before = row?.JsonValue;
        if (row is null) { row = new SystemSetting { Key = SettingsKey, Version = 0 }; db.Add(row); }
        row.JsonValue = Json(request.Routes); row.Version++; row.UpdatedAtUtc = Now;
        db.Add(new AuditLog { ActorUserID = actor, EntityType = "System", EntityID = SettingsKey, Action = "WORKFLOW_SETTINGS_UPDATED", BeforeJSON = before, AfterJSON = row.JsonValue, CreatedAt = Now });
        return new WorkflowSettingsView(row.Version, request.Routes);
    }, ct);
    private async Task<ApprovalRequest> Start(string actor, Employee employee, string kind, long reference, CancellationToken ct)
    {
        var config = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(s => s.Key == SettingsKey, ct) ?? throw BusinessException.Conflict("Configure approval workflows first.");
        var routes = Read<WorkflowRoute[]>(config.JsonValue);
        var route = routes.SingleOrDefault(r => r.RequestType == kind) ?? (kind == "LEAVE_CANCELLATION" ? routes.SingleOrDefault(r => r.RequestType == "LEAVE") : null)
            ?? throw BusinessException.Conflict("No approval route configured for this request type.");
        var users = new List<string>();
        foreach (var step in route.Steps)
        {
            string? user;
            if (step.ApproverType == "USER")
                user = await db.Set<User>().Where(u => u.UserId == step.UserId && u.Status == "ACTIVE").Select(u => u.UserId).SingleOrDefaultAsync(ct);
            else if (step.ApproverType == "HR")
                user = await db.Set<User>().Where(u => u.UserId == step.UserId && u.Status == "ACTIVE" && db.Set<UserRole>().Any(ur => ur.UserID == u.UserId && db.Set<Role>().Any(r => r.ID == ur.RoleID && r.Code == step.RoleCode))).Select(u => u.UserId).SingleOrDefaultAsync(ct);
            else
            {
                int? approverEmployee = step.ApproverType == "TEAM_LEAD"
                    ? await db.Teams.Where(t => t.Id == employee.TeamId && t.DepartmentId == employee.DepartmentId && t.IsActive).Select(t => t.LeadEmployeeId).SingleOrDefaultAsync(ct)
                    : await db.Departments.Where(d => d.Id == employee.DepartmentId && d.IsActive).Select(d => d.ManagerEmployeeId).SingleOrDefaultAsync(ct);
                user = await db.Set<User>().Where(u => u.EmployeeId == approverEmployee && approverEmployee != null && u.Status == "ACTIVE").Select(u => u.UserId).SingleOrDefaultAsync(ct);
            }
            if (user is null || (!route.AllowSelfApproval && user == actor)) throw BusinessException.Invalid("Configured approver is unavailable or would self-approve.");
            await Demand(user, Approvals, "VIEW", ct); await Demand(user, Approvals, "APPROVE", ct);
            foreach (var action in new[] { "VIEW", "APPROVE" })
            {
                var access = await scopes.GetAsync(user, Approvals, action, ct);
                if (!await access.Apply(db.Employees).AnyAsync(e => e.Id == employee.Id, ct)) throw BusinessException.Invalid("Assigned approver's scope does not cover the requesting employee.");
            }
            users.Add(user);
        }
        if (users.Count == 0 || users.Count != users.Distinct().Count()) throw BusinessException.Invalid("Workflow requires distinct, available approvers.");
        var approval = new ApprovalRequest { RequestType = kind, ReferenceID = reference, RequestedByUserID = actor, EmployeeId = employee.Id, Status = "PENDING", CreatedAt = Now, AllowSelfApproval = route.AllowSelfApproval };
        db.Add(approval); await db.SaveChangesAsync(ct);
        for (var i = 0; i < users.Count; i++) db.Add(new ApprovalStep { ApprovalRequestID = approval.ID, StepNo = i + 1, ApproverUserID = users[i], Decision = "PENDING" });
        Audit(actor, approval.ID, "WORKFLOW_SUBMITTED", null, new { approval.RequestType, approval.ReferenceID, employeeId = employee.Id, approvers = users });
        await db.SaveChangesAsync(ct); await Notify(approval, users[0], "submitted", "A request is awaiting your approval.", ct);
        return approval;
    }
}
