using HRM.API.Common;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Performance.Services;
public sealed partial class KpiService
{
    public async Task<PageResult<KpiUnit>> Units(string actor, KpiUnitQuery q, CancellationToken ct)
    {
        await Configuration(actor, "VIEW", ct);
        var rows = db.Set<KpiUnit>().AsNoTracking();
        if(q.IsActive.HasValue) rows = rows.Where(x => x.IsActive == q.IsActive);
        if(!string.IsNullOrWhiteSpace(q.Search)) rows = rows.Where(x => x.Code.Contains(q.Search) || x.Name.Contains(q.Search));
        return new(true, await rows.CountAsync(ct), q.Page, q.PageSize,
            await rows.OrderBy(x => x.SortOrder).ThenBy(x => x.Code).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct));
    }
    public async Task<KpiUnit> Unit(string actor, long id, CancellationToken ct)
    {
        await Configuration(actor, "VIEW", ct);
        return await db.Set<KpiUnit>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing();
    }
    public Task<KpiUnit> SaveUnit(string actor, long? id, KpiUnitRequest r, CancellationToken ct) => Transaction(async () =>
    {
        await Configuration(actor, id.HasValue ? "UPDATE" : "NEW", ct, true);
        var code = r.Code.Trim(); var name = r.Name.Trim();
        if(code.Length == 0 || name.Length == 0 || code.Any(char.IsControl)) throw BusinessException.Invalid("Invalid KPI unit code or name.");
        var row = id.HasValue ? await db.Set<KpiUnit>().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing() : new KpiUnit();
        var before = id.HasValue ? Json(row) : null;
        if(id.HasValue)
        {
            Version(row.Version, r.Version);
            if(row.Code != code) throw BusinessException.Conflict("Unit code is immutable; create another unit instead.");
            row.Version++;
        }
        if(await db.Set<KpiUnit>().AnyAsync(x => x.ID != (id ?? 0) && x.Code == code, ct)) throw BusinessException.Conflict("KPI unit code already exists.");
        row.Code = code; row.Name = name; row.SortOrder = r.SortOrder; row.IsActive = r.IsActive;
        if(!id.HasValue) db.Add(row);
        await db.SaveChangesAsync(ct);
        Audit(actor, "KPI_UNIT", row.ID, "KPI_UNIT_SAVED", before, row);
        return row;
    }, ct);
}
