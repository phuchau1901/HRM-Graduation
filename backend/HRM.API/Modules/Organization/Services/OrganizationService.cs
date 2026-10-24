using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Organization.Services;
public sealed class OrganizationService(AppDbContext db)
{
    public async Task<PageResult<DepartmentDto>> DepartmentsAsync(OrganizationQuery q, CancellationToken ct)
    {
        var query = db.Set<Department>().AsNoTracking();
        if (q.IsActive.HasValue) query = query.Where(x => x.IsActive == q.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.DepartmentCode.Contains(q.Search) || x.DepartmentName.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var data = await query.OrderBy(x => x.Id).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(x => new DepartmentDto(x.Id, x.DepartmentCode, x.DepartmentName, x.Description, x.IsActive)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, data);
    }
    public async Task<DepartmentDto> DepartmentAsync(int id, CancellationToken ct) =>
        await db.Set<Department>().AsNoTracking().Where(x => x.Id == id)
            .Select(x => new DepartmentDto(x.Id, x.DepartmentCode, x.DepartmentName, x.Description, x.IsActive)).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
    public async Task<DepartmentDto> SaveDepartmentAsync(int? id, DepartmentRequest request, CancellationToken ct)
    {
        var code = request.DepartmentCode.Trim();
        if (await db.Set<Department>().AnyAsync(x => x.DepartmentCode == code && x.Id != id, ct)) throw BusinessException.Conflict("Department code already exists.");
        var entity = id.HasValue ? await db.Set<Department>().FindAsync([id.Value], ct) ?? throw BusinessException.Missing() : new Department();
        entity.DepartmentCode = code; entity.DepartmentName = request.DepartmentName.Trim(); entity.Description = request.Description; entity.IsActive = request.IsActive;
        if (!id.HasValue) db.Add(entity);
        await db.SaveChangesAsync(ct); return new(entity.Id, entity.DepartmentCode, entity.DepartmentName, entity.Description, entity.IsActive);
    }
    public async Task DeleteDepartmentAsync(int id, CancellationToken ct)
    {
        var entity = await db.Set<Department>().FindAsync([id], ct) ?? throw BusinessException.Missing();
        if (await db.Set<Employee>().AnyAsync(x => x.DepartmentId == id, ct) ||
            await db.Set<EmployeeHistory>().AnyAsync(x => x.OldDepartmentID == id || x.NewDepartmentID == id, ct))
            throw BusinessException.Conflict("Department is referenced; deactivate it instead of deleting it.");
        db.Remove(entity); await db.SaveChangesAsync(ct);
    }
    public async Task<PageResult<PositionDto>> PositionsAsync(OrganizationQuery q, CancellationToken ct)
    {
        var query = db.Set<Position>().AsNoTracking();
        if (q.IsActive.HasValue) query = query.Where(x => x.IsActive == q.IsActive);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.Code.Contains(q.Search) || x.Name.Contains(q.Search));
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await query.OrderBy(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(x => new PositionDto(x.ID, x.Code, x.Name, x.IsActive)).ToListAsync(ct));
    }
    public async Task<PositionDto> PositionAsync(long id, CancellationToken ct) => await db.Set<Position>().AsNoTracking().Where(x => x.ID == id)
        .Select(x => new PositionDto(x.ID, x.Code, x.Name, x.IsActive)).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
    public async Task<PositionDto> SavePositionAsync(long? id, PositionRequest request, CancellationToken ct)
    {
        var code = request.Code.Trim();
        if (await db.Set<Position>().AnyAsync(x => x.Code == code && x.ID != id, ct)) throw BusinessException.Conflict("Position code already exists.");
        var entity = id.HasValue ? await db.Set<Position>().FindAsync([id.Value], ct) ?? throw BusinessException.Missing() : new Position();
        entity.Code = code; entity.Name = request.Name.Trim(); entity.IsActive = request.IsActive;
        if (!id.HasValue) db.Add(entity);
        await db.SaveChangesAsync(ct); return new(entity.ID, entity.Code, entity.Name, entity.IsActive);
    }
    public async Task DeletePositionAsync(long id, CancellationToken ct)
    {
        var entity = await db.Set<Position>().FindAsync([id], ct) ?? throw BusinessException.Missing();
        if (await db.Set<EmployeeHistory>().AnyAsync(x => x.OldPositionID == id || x.NewPositionID == id, ct))
            throw BusinessException.Conflict("Position is referenced; deactivate it instead of deleting it.");
        db.Remove(entity); await db.SaveChangesAsync(ct);
    }
}
