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
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.Approvals.Services;

public sealed partial class ApprovalWorkflowService(AppDbContext db, EmployeeDataScope scopes, IPermissionService permissions,
    NotificationService notifications, TimeProvider clock, IEnumerable<IApprovalModule> modules)
{
    public const string Approvals = "WEB_APPROVALS", Configuration = "WEB_APPROVAL_SETTINGS", SettingsKey = "APPROVAL_WORKFLOWS";
    private IApprovalModule ModuleFor(string kind)
    {
        var matches = modules.Where(m => m.RequestTypes.Contains(kind, StringComparer.Ordinal)).ToArray();
        return matches.Length == 1 ? matches[0] : throw BusinessException.Invalid("Approval request type is not uniquely registered.");
    }
    public void RecordEvent(string actor, long id, string action, object? before, object? after) => Audit(actor, id, action, before, after);
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
    private void Audit(string actor, long id, string action, object? before, object? after) => ApprovalAudit.Record(db, clock, actor, id, action, before, after);
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
            Validate(route); ModuleFor(route.RequestType);
            foreach (var step in route.Steps)
            {
                if (step is null) throw BusinessException.Invalid("Null approval step."); Validate(step);
                if (step.ApproverType == "USER")
                {
                    if (!step.EmployeeId.HasValue || !await db.Employees.AnyAsync(e => e.Id == step.EmployeeId && e.EmploymentStatus == "ACTIVE" && db.Set<User>().Any(u => u.EmployeeId == e.Id && u.Status == "ACTIVE"), ct))
                        throw BusinessException.Invalid("USER step requires an active employee linked to an active user.");
                    step.UserId = null; // USER identity comes exclusively from EmployeeId, never a supplied account.
                }
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
    public async Task<ApprovalRequest> StartAsync(string actor, Employee employee, string kind, long reference, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction == null) throw new InvalidOperationException("Approval submission must share the domain transaction.");
        var module = ModuleFor(kind);
        var config = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(s => s.Key == SettingsKey, ct) ?? throw BusinessException.Conflict("Configure approval workflows first.");
        var routes = Read<WorkflowRoute[]>(config.JsonValue);
        var route = routes.SingleOrDefault(r => r.RequestType == kind) ?? (module.WorkflowFallback(kind) is { } fallback ? routes.SingleOrDefault(r => r.RequestType == fallback) : null)
            ?? throw BusinessException.Conflict("No approval route configured for this request type.");
        var users = new List<string>();
        var approverEmployees = new List<int?>();
        foreach (var step in route.Steps)
        {
            string? user;
            if (step.ApproverType == "USER")
                user = await db.Set<User>().Where(u => step.EmployeeId != null && u.EmployeeId == step.EmployeeId && u.Status == "ACTIVE" && db.Employees.Any(e => e.Id == step.EmployeeId && e.EmploymentStatus == "ACTIVE")).Select(u => u.UserId).SingleOrDefaultAsync(ct);
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
            // Submission resolves the assigned recipient only. Live approval permission,
            // data scope and assignment are enforced when that recipient acts.
            users.Add(user);
            approverEmployees.Add(step.ApproverType == "USER" ? step.EmployeeId : await db.Set<User>().Where(u => u.UserId == user).Select(u => u.EmployeeId).SingleAsync(ct));
        }
        if (users.Count == 0 || users.Count != users.Distinct().Count()) throw BusinessException.Invalid("Workflow requires distinct, available approvers.");
        var approval = new ApprovalRequest { RequestType = kind, ReferenceID = reference, RequestedByUserID = actor, EmployeeId = employee.Id, Status = "PENDING", CreatedAt = Now, AllowSelfApproval = route.AllowSelfApproval };
        db.Add(approval); await db.SaveChangesAsync(ct);
        for (var i = 0; i < users.Count; i++) db.Add(new ApprovalStep { ApprovalRequestID = approval.ID, StepNo = i + 1, ApproverUserID = users[i], ApproverEmployeeId = approverEmployees[i], Decision = "PENDING" });
        Audit(actor, approval.ID, "WORKFLOW_SUBMITTED", null, new { approval.RequestType, approval.ReferenceID, employeeId = employee.Id, approvers = users, approverEmployeeIds = approverEmployees });
        await db.SaveChangesAsync(ct); await Notify(approval, users[0], "submitted", "A request is awaiting your approval.", ct);
        return approval;
    }
}
