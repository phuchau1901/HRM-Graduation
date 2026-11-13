using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using HRM.API.Modules.Authorization.Services;
namespace HRM.API.Modules.Employees.Services;

public sealed record EmployeeAccess(string Scope, int? EmployeeId, int? DepartmentId)
{
    public IQueryable<Employee> Apply(IQueryable<Employee> query) => Scope switch
    {
        "ALL" => query,
        "DEPARTMENT" when DepartmentId.HasValue => query.Where(x => x.DepartmentId == DepartmentId),
        "SELF" when EmployeeId.HasValue => query.Where(x => x.Id == EmployeeId),
        _ => query.Where(x => false)
    };
    public void DemandWrite()
    {
        if (Scope is not ("ALL" or "DEPARTMENT") || (Scope == "DEPARTMENT" && !DepartmentId.HasValue)) throw BusinessException.Scope();
    }
    public void DemandDepartment(int departmentId)
    {
        DemandWrite();
        if (Scope != "ALL" && departmentId != DepartmentId) throw BusinessException.Scope();
    }
}
public sealed class EmployeeDataScope(AppDbContext db, IPermissionService permissions)
{
    public async Task<EmployeeAccess> GetAsync(string userId, string screen, string action, CancellationToken ct)
    {
        var user = await db.Set<User>().AsNoTracking().Where(x => x.UserId == userId && x.Status == "ACTIVE")
            .Select(x => new { x.EmployeeId }).SingleOrDefaultAsync(ct) ?? throw BusinessException.Scope();
        var scope = await permissions.GetDataScopeAsync(userId, screen, action, ct) ?? throw BusinessException.Scope();
        var departmentId = await db.Set<Employee>().AsNoTracking().Where(x => x.Id == user.EmployeeId)
            .Select(x => (int?)x.DepartmentId).SingleOrDefaultAsync(ct);
        return new(scope, user.EmployeeId, departmentId);
    }
}
