using System.Data;
using System.Globalization;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.DTOs;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.System.Services;
public sealed class SystemSettingsService(AppDbContext db, IPermissionService permissions, TimeProvider clock)
{
    public const string Screen = "WEB_SYSTEM_SETTINGS";
    public async Task Demand(string actor, string screen, string action, CancellationToken ct)
    { if (!await permissions.HasPermissionAsync(actor, screen, action, ct)) throw new BusinessException(403, "HRM_ADMIN_403", "Required permission is missing."); }
    public async Task<SettingsView<T>> Get<T>(string actor, string key, CancellationToken ct)
    { await Demand(actor, Screen, "VIEW", ct); return await Read<T>(key, ct); }
    internal async Task<SettingsView<T>> Read<T>(string key, CancellationToken ct)
    {
        var row = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(x => x.Key == key, ct) ?? throw BusinessException.Conflict("Settings are not initialized; review the settings migration.");
        return new(SettingsDefaults.Read<T>(row.JsonValue), row.Version, DateTime.SpecifyKind(row.UpdatedAtUtc, DateTimeKind.Utc));
    }
    public static long Match(string? header)
    {
        if (string.IsNullOrEmpty(header)) throw new BusinessException(428, "HRM_SETTINGS_428", "If-Match is required.");
        if (header.Length < 3 || header[0] != '"' || header[^1] != '"' || !long.TryParse(header[1..^1], NumberStyles.None, CultureInfo.InvariantCulture, out var version) || version < 0)
            throw new BusinessException(412, "HRM_SETTINGS_412", "Invalid or stale version.");
        if (header != $"\"{version.ToString(CultureInfo.InvariantCulture)}\"") throw new BusinessException(412, "HRM_SETTINGS_412", "Invalid or stale version.");
        return version;
    }
    public async Task<SettingsView<T>> Put<T>(string actor, string key, T request, string? match, CancellationToken ct) where T : class
    {
        SettingsDefaults.Validate(request); var expected = Match(match);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await Demand(actor, Screen, "UPDATE", ct);
        await db.Set<SystemSetting>().Where(x => x.Key == key).ExecuteUpdateAsync(x => x.SetProperty(s => s.Version, s => s.Version), ct);
        var before = await Read<T>(key, ct); var json = JsonSerializer.Serialize(request, SettingsDefaults.Json); var now = clock.GetUtcNow().UtcDateTime;
        var updated = await db.Set<SystemSetting>().Where(x => x.Key == key && x.Version == expected).ExecuteUpdateAsync(x => x
            .SetProperty(s => s.JsonValue, json).SetProperty(s => s.Version, s => s.Version + 1).SetProperty(s => s.UpdatedAtUtc, now), ct);
        if (updated != 1) throw new BusinessException(412, "HRM_SETTINGS_412", "Settings changed; reload before saving.");
        Audit(actor, "SETTINGS_UPDATED", key, before.Settings, request);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return new(request, expected + 1, now);
    }
    internal void Audit(string actor, string action, string id, object? before, object? after) => db.Add(new AuditLog
    { ActorUserID = actor, Action = action, EntityType = "System", EntityID = id, BeforeJSON = before is null ? null : JsonSerializer.Serialize(before, SettingsDefaults.Json),
      AfterJSON = after is null ? null : JsonSerializer.Serialize(after, SettingsDefaults.Json), CreatedAt = clock.GetUtcNow().UtcDateTime });
}
