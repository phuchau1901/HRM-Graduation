using System.Data;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.Organization.DTOs;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Organization.Services;

public sealed class TeamService(AppDbContext db)
{
    private static TeamDto Dto(Team team) => new(team.Id, team.TeamCode, team.TeamName, team.DepartmentId,
        team.Department.DepartmentName, team.Description, team.IsActive, DateTime.SpecifyKind(team.CreatedAt, DateTimeKind.Utc));
    public async Task<PageResult<TeamDto>> ListAsync(TeamQuery q, CancellationToken ct)
    {
        var query = db.Set<Team>().AsNoTracking();
        if (q.DepartmentId.HasValue) query = query.Where(x => x.DepartmentId == q.DepartmentId);
        if (q.IsActive.HasValue) query = query.Where(x => x.IsActive == q.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.TeamCode.Contains(q.Search) || x.TeamName.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var rows = await query.Include(x => x.Department).OrderBy(x => x.Id).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows.Select(Dto).ToList());
    }
    public async Task<TeamDto> GetAsync(int id, CancellationToken ct) => Dto(await db.Set<Team>().AsNoTracking()
        .Include(x => x.Department).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw BusinessException.Missing());
    public async Task<TeamDto> SaveAsync(string actor, int? id, TeamRequest request, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var entity = id.HasValue ? await db.Set<Team>().Include(x => x.Department).SingleOrDefaultAsync(x => x.Id == id, ct)
            ?? throw BusinessException.Missing() : new Team();
        if (id.HasValue && entity.DepartmentId != request.DepartmentId)
            throw BusinessException.Conflict("A team's department cannot be changed; create a team in the target department.");
        var department = await db.Set<Department>().SingleOrDefaultAsync(x => x.Id == request.DepartmentId, ct)
            ?? throw BusinessException.Invalid("Department does not exist.");
        // Allow deactivation and maintenance of an inactive team after its department is deactivated.
        if (!department.IsActive && (!id.HasValue || request.IsActive)) throw BusinessException.Invalid("An active department is required.");
        var code = request.TeamCode.Trim().ToUpperInvariant();
        if (await db.Set<Team>().AnyAsync(x => x.TeamCode == code && x.Id != id, ct)) throw BusinessException.Conflict("Team code already exists.");
        var before = id.HasValue ? Dto(entity) : null;
        entity.TeamCode = code; entity.TeamName = request.TeamName.Trim(); entity.DepartmentId = department.Id;
        entity.Department = department; entity.Description = request.Description?.Trim(); entity.IsActive = request.IsActive;
        if (!id.HasValue) db.Add(entity);
        await db.SaveChangesAsync(ct);
        var after = Dto(entity); Audit(actor, entity.Id, id.HasValue ? "TEAM_UPDATED" : "TEAM_CREATED", before, after);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return after;
    }
    public async Task DeleteAsync(string actor, int id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var entity = await db.Set<Team>().Include(x => x.Department).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw BusinessException.Missing();
        if (await db.Set<Employee>().AnyAsync(x => x.TeamId == id, ct))
            throw BusinessException.Conflict("Team has employees; deactivate it or explicitly reassign its employees first.");
        Audit(actor, id, "TEAM_DELETED", Dto(entity), null); db.Remove(entity);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
    }
    private void Audit(string actor, int id, string action, TeamDto? before, TeamDto? after) => db.Add(new AuditLog
    {
        ActorUserID = actor, Action = action, EntityType = "Team", EntityID = id.ToString(global::System.Globalization.CultureInfo.InvariantCulture),
        BeforeJSON = before is null ? null : JsonSerializer.Serialize(before), AfterJSON = after is null ? null : JsonSerializer.Serialize(after), CreatedAt = DateTime.UtcNow
    });
}
