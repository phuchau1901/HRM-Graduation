using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.System.Services;

public sealed class AuditLogService(AppDbContext db, IPermissionService permissions)
{
    // This explicit grant exposes global cross-module audit data, including before/after payloads.
    public const string Screen = "WEB_AUDIT_LOGS";
    private async Task Demand(string actor, CancellationToken ct)
    {
        if (!await permissions.HasPermissionAsync(actor, Screen, "VIEW", ct))
            throw new BusinessException(403, "HRM_ADMIN_403", "Required permission is missing.");
    }
    public async Task<PageResult<AuditLogSummary>> List(string actor, AuditLogQuery q, CancellationToken ct)
    {
        await Demand(actor, ct);
        var offset = Paging.Offset(q);
        if (q.FromUtc > q.ToUtc) throw BusinessException.Invalid("FromUtc must not be after ToUtc.");
        var rows = db.Set<AuditLog>().AsNoTracking();
        if (q.ActorUserId is not null) rows = rows.Where(x => x.ActorUserID == q.ActorUserId);
        if (q.Action is not null) rows = rows.Where(x => x.Action == q.Action);
        if (q.EntityType is not null) rows = rows.Where(x => x.EntityType == q.EntityType);
        if (q.EntityId is not null) rows = rows.Where(x => x.EntityID == q.EntityId);
        if (q.FromUtc is { } from) { var utc = from.UtcDateTime; rows = rows.Where(x => x.CreatedAt >= utc); }
        if (q.ToUtc is { } to) { var utc = to.UtcDateTime; rows = rows.Where(x => x.CreatedAt <= utc); }
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var search = q.Search.Trim();
            rows = rows.Where(x => x.Action.Contains(search) || x.EntityType.Contains(search) || x.EntityID.Contains(search)
                || (x.ActorUserID != null && x.ActorUserID.Contains(search)));
        }
        var total = await rows.CountAsync(ct);
        var data = await rows.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.ID)
            .Skip(offset).Take(q.PageSize)
            .Select(x => new AuditLogSummary(x.ID, x.ActorUserID, x.Action, x.EntityType, x.EntityID, x.CreatedAt)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, data.Select(x => x with { CreatedAt = Utc(x.CreatedAt) }).ToArray());
    }
    public async Task<AuditLogDetail> Get(string actor, long id, CancellationToken ct)
    {
        await Demand(actor, ct);
        var row = await db.Set<AuditLog>().AsNoTracking().Where(x => x.ID == id)
            .Select(x => new { x.ID, x.ActorUserID, x.Action, x.EntityType, x.EntityID, x.CreatedAt, x.BeforeJSON, x.AfterJSON })
            .SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
        return new(row.ID, row.ActorUserID, row.Action, row.EntityType, row.EntityID, Utc(row.CreatedAt), Parse(row.BeforeJSON), Parse(row.AfterJSON));
    }
    private static DateTime Utc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
    private static JsonElement? Parse(string? value) => value is null ? null : JsonSerializer.Deserialize<JsonElement>(value);
}
