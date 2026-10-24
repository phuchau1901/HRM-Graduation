using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace HRM.API.Modules.Employees.Services;

public sealed class EmployeeDataScopeOptions
{
    // Server-owned mapping; no role-name inference, request scope, or ADMIN bypass.
    public Dictionary<string, string> Users { get; set; } = new(StringComparer.Ordinal);
    public bool IsValid() => Users.All(x => !string.IsNullOrWhiteSpace(x.Key) && x.Key.Length <= 100 && x.Value is "SELF" or "DEPARTMENT" or "ALL");
}
public sealed record EmployeeAccess(string Scope, int? EmployeeId, int? DepartmentId)
{
    public IQueryable<Employee> Apply(IQueryable<Employee> query) => Scope switch
    {
        "ALL" => query,
        "DEPARTMENT" when DepartmentId.HasValue => query.Where(x => x.DepartmentId == DepartmentId),
        _ when EmployeeId.HasValue => query.Where(x => x.Id == EmployeeId),
        _ => query.Where(x => false)
    };
    public void DemandWrite()
    {
        if (Scope == "SELF" || (Scope == "DEPARTMENT" && !DepartmentId.HasValue)) throw BusinessException.Scope();
    }
    public void DemandDepartment(int departmentId)
    {
        DemandWrite();
        if (Scope != "ALL" && departmentId != DepartmentId) throw BusinessException.Scope();
    }
}
public sealed class EmployeeDataScope(AppDbContext db, IOptions<EmployeeDataScopeOptions> options)
{
    public async Task<EmployeeAccess> GetAsync(string userId, CancellationToken ct)
    {
        var user = await db.Set<User>().AsNoTracking().Where(x => x.UserId == userId && x.Status == "ACTIVE")
            .Select(x => new { x.EmployeeId }).SingleOrDefaultAsync(ct) ?? throw BusinessException.Scope();
        var scope = options.Value.Users.GetValueOrDefault(userId) ?? "SELF";
        var departmentId = await db.Set<Employee>().AsNoTracking().Where(x => x.Id == user.EmployeeId)
            .Select(x => (int?)x.DepartmentId).SingleOrDefaultAsync(ct);
        return new(scope, user.EmployeeId, departmentId);
    }
}
