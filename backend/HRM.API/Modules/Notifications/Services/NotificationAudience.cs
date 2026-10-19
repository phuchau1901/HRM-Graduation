using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Entities;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
namespace HRM.API.Modules.Notifications.Services;

public static class NotificationAudience
{
    // This is a backend-owned allowlist. No expression, SQL, dynamic LINQ or arbitrary property is accepted.
    public const string ActiveEmployees = "ACTIVE_EMPLOYEES";
    public static void Validate(CreateNotificationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title) || request.Title.Length > 200 ||
            string.IsNullOrWhiteSpace(request.Content) || request.Content.Length > 1000 ||
            request.Targets is null || request.Targets.Length is < 1 or > 50 ||
            request.ReferenceType?.Length > 60 || request.ReferenceId?.Length > 100)
            throw Invalid();
        var values = 0;
        foreach (var target in request.Targets)
        {
            if (target is null || target.UserIds is null || target.RoleIds is null || target.DepartmentIds is null) throw Invalid();
            values += target.UserIds.Length + target.RoleIds.Length + target.DepartmentIds.Length;
            if (values > 1000 || target.UserIds.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 100) ||
                target.RoleIds.Any(x => x <= 0) || target.DepartmentIds.Any(x => x <= 0)) throw Invalid();
            var users = target.UserIds.Length; var roles = target.RoleIds.Length; var departments = target.DepartmentIds.Length;
            var valid = target.Type switch
            {
                "USER" => users == 1 && roles == 0 && departments == 0 && target.FilterCode is null,
                "USERS" => users > 0 && roles == 0 && departments == 0 && target.FilterCode is null,
                "ROLE" => roles > 0 && users == 0 && departments == 0 && target.FilterCode is null,
                "DEPARTMENT" => departments > 0 && users == 0 && roles == 0 && target.FilterCode is null,
                "ALL" => users == 0 && roles == 0 && departments == 0 && target.FilterCode is null,
                "CUSTOM" => users == 0 && roles == 0 && departments == 0 && target.FilterCode == ActiveEmployees,
                _ => false
            };
            if (!valid) throw Invalid();
        }
    }
    private static NotificationException Invalid() => new(400, "HRM_NOTIFICATION_001", "Invalid notification or recipient criteria.");

    public static string RequiredAction(string type) => type switch
    {
        "USER" => "SEND_USER", "USERS" or "ROLE" or "DEPARTMENT" or "CUSTOM" => "SEND_GROUP",
        "ALL" => "SEND_ALL", _ => throw Invalid()
    };

    public static async Task<List<string>> ResolveAsync(AppDbContext db, IEnumerable<NotificationTarget> targets, CancellationToken ct)
    {
        var users = db.Set<User>().AsNoTracking().Where(x => x.Status == "ACTIVE");
        IQueryable<string>? combined = null;
        foreach (var stored in targets)
        {
            var target = JsonSerializer.Deserialize<NotificationTargetRequest>(stored.CriteriaJSON)
                ?? throw new InvalidOperationException("Invalid stored recipient criteria.");
            if (stored.Type != target.Type) throw new InvalidOperationException("Inconsistent stored recipient criteria.");
            Validate(new() { Title = "validation", Content = "validation", Targets = [target] });
            IQueryable<string> selected = target.Type switch
            {
                "USER" or "USERS" => users.Where(x => target.UserIds.Contains(x.UserId)).Select(x => x.UserId),
                "ROLE" => from user in users
                          join ur in db.Set<UserRole>() on user.UserId equals ur.UserID
                          join role in db.Set<Role>() on ur.RoleID equals role.ID
                          where target.RoleIds.Contains(role.ID) select user.UserId,
                "DEPARTMENT" => from user in users
                                join employee in db.Set<Employee>() on user.EmployeeId equals employee.Id
                                where employee.EmploymentStatus == "ACTIVE" && target.DepartmentIds.Contains(employee.DepartmentId)
                                select user.UserId,
                "CUSTOM" when target.FilterCode == ActiveEmployees => from user in users
                                join employee in db.Set<Employee>() on user.EmployeeId equals employee.Id
                                where employee.EmploymentStatus == "ACTIVE" select user.UserId,
                "ALL" => users.Select(x => x.UserId),
                _ => throw new InvalidOperationException("Unsupported stored recipient criteria.")
            };
            combined = combined is null ? selected : combined.Union(selected);
        }
        return combined is null ? [] : await combined.Distinct().OrderBy(x => x).ToListAsync(ct);
    }
}
