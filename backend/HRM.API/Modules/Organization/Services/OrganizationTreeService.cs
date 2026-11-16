using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Organization.DTOs;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Organization.Services;

public sealed class OrganizationTreeService(AppDbContext db, EmployeeDataScope scopes)
{
    public async Task<IReadOnlyList<OrganizationDepartment>> TreeAsync(string actor, CancellationToken ct)
    {
        var access = await scopes.GetAsync(actor, "WEB_ORGANIZATION", "VIEW", ct);
        var employees = access.Apply(db.Employees.AsNoTracking());
        // Fixed number of SQL queries. Counts and manager names are projected from the scoped query;
        // no member list is materialized until a group is opened.
        var departments = await db.Departments.AsNoTracking()
            .Where(d => access.Scope == "ALL" || employees.Any(e => e.DepartmentId == d.Id))
            .OrderBy(d => d.DepartmentName).ThenBy(d => d.Id)
            .Select(d => new {
                d.Id, d.DepartmentName,
                Manager = employees.Where(e => e.Id == d.ManagerEmployeeId && e.DepartmentId == d.Id)
                    .Select(e => new OrganizationPerson(e.Id, e.EmployeeCode, e.FullName)).FirstOrDefault(),
                Count = employees.Count(e => e.DepartmentId == d.Id),
                Unassigned = employees.Count(e => e.DepartmentId == d.Id && e.TeamId == null)
            }).ToListAsync(ct);
        var teams = await db.Teams.AsNoTracking()
            .Where(t => access.Scope == "ALL" || (access.Scope == "DEPARTMENT" && t.DepartmentId == access.DepartmentId) || employees.Any(e => e.TeamId == t.Id && e.DepartmentId == t.DepartmentId))
            .OrderBy(t => t.TeamName).ThenBy(t => t.Id)
            .Select(t => new {
                t.DepartmentId, t.Id, t.TeamName,
                Lead = employees.Where(e => e.Id == t.LeadEmployeeId && e.TeamId == t.Id && e.DepartmentId == t.DepartmentId)
                    .Select(e => new OrganizationPerson(e.Id, e.EmployeeCode, e.FullName)).FirstOrDefault(),
                Count = employees.Count(e => e.TeamId == t.Id && e.DepartmentId == t.DepartmentId)
            }).ToListAsync(ct);
        var byDepartment = teams.ToLookup(t => t.DepartmentId);
        return departments.Select(d => new OrganizationDepartment(d.Id, d.DepartmentName, d.Manager, d.Count,
            byDepartment[d.Id].Count(), d.Unassigned, byDepartment[d.Id].Select(t => new OrganizationTeam(t.Id, t.TeamName, t.Lead, t.Count)).ToList())).ToList();
    }

    public async Task<PageResult<OrganizationMember>> MembersAsync(string actor, int? teamId, int? departmentId, PageQuery q, CancellationToken ct)
    {
        var access = await scopes.GetAsync(actor, "WEB_ORGANIZATION", "VIEW", ct);
        var employees = access.Apply(db.Employees.AsNoTracking());
        if (teamId.HasValue)
        {
            var team = await db.Teams.AsNoTracking().Where(t => t.Id == teamId &&
                (access.Scope == "ALL" || (access.Scope == "DEPARTMENT" && t.DepartmentId == access.DepartmentId) || employees.Any(e => e.TeamId == t.Id)))
                .Select(t => new { t.Id, t.DepartmentId }).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
            employees = employees.Where(e => e.TeamId == team.Id && e.DepartmentId == team.DepartmentId);
        }
        else
        {
            if (!await db.Departments.AnyAsync(d => d.Id == departmentId &&
                (access.Scope == "ALL" || employees.Any(e => e.DepartmentId == d.Id)), ct)) throw BusinessException.Missing();
            employees = employees.Where(e => e.DepartmentId == departmentId && e.TeamId == null);
        }
        var total = await employees.CountAsync(ct);
        var rows = await employees.OrderBy(e => e.EmployeeCode).ThenBy(e => e.Id).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(e => new OrganizationMember(e.Id, e.EmployeeCode, e.FullName, e.Position == null ? null : e.Position.Name, e.EmploymentStatus)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }
}
