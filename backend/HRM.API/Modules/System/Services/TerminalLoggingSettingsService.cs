using System.Data;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Logging;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.System.Services;
public sealed class TerminalLoggingSettingsService(AppDbContext db, SystemSettingsService security, TerminalLoggingState state,
    IActionDescriptorCollectionProvider actions, TimeProvider clock)
{
    private string[] Modules() => actions.ActionDescriptors.Items.OfType<ControllerActionDescriptor>()
        .Select(x => TerminalConsoleProvider.ModuleFrom(x.ControllerTypeInfo.Namespace)).OfType<string>()
        .Concat(["System", "Notifications", "Leave", "Work"]).Distinct(StringComparer.OrdinalIgnoreCase).OrderBy(x => x, StringComparer.Ordinal).ToArray();
    public async Task<object> Catalog(string actor, CancellationToken ct)
    {
        await security.Demand(actor, SystemSettingsService.Screen, "VIEW", ct);
        return new { modules = Modules(), specialUsers = new[] { "system", "anonymous" } };
    }
    public async Task<SettingsView<TerminalLoggingOptions>> Get(string actor, CancellationToken ct)
    {
        await security.Demand(actor, SystemSettingsService.Screen, "VIEW", ct);
        var row = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(x => x.Key == TerminalLoggingState.Key, ct);
        if (row == null) return new(state.Current, 0, DateTime.UnixEpoch);
        var settings = SettingsDefaults.Read<TerminalLoggingRequest>(row.JsonValue);
        state.Publish(settings, row.Version);
        return new(settings, row.Version, DateTime.SpecifyKind(row.UpdatedAtUtc, DateTimeKind.Utc));
    }
    private void ValidateModules(IEnumerable<string> values)
    {
        var modules = Modules().ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (values.Any(x => !modules.Contains(x))) throw BusinessException.Invalid("Unknown terminal logging module; load the module catalog or your personal settings first.");
    }
    private async Task Self(string actor, CancellationToken ct)
    {
        if (actor.Equals("system", StringComparison.OrdinalIgnoreCase) || actor.Equals("anonymous", StringComparison.OrdinalIgnoreCase)
            || !await db.Set<User>().AnyAsync(u => u.UserId == actor && u.Status == "ACTIVE", ct)) throw BusinessException.Scope();
    }
    private TerminalUserLoggingView Own(TerminalLoggingOptions settings, string actor)
    {
        var modules = Modules();
        // Return only this user's effective choices, never other user IDs or preferences.
        var own = settings.ModulesFor(actor);
        var effective = modules.ToDictionary(m => m, m => own != null
            ? own.FirstOrDefault(p => p.Key.Equals(m, StringComparison.OrdinalIgnoreCase)).Value ?? "N"
            : settings.Modules.FirstOrDefault(p => p.Key.Equals(m, StringComparison.OrdinalIgnoreCase)).Value ?? "N");
        return new(settings.UserFlag(actor), effective, settings.Enabled, settings.IncludeSql, modules);
    }
    public async Task<SettingsView<TerminalUserLoggingView>> GetMe(string actor, CancellationToken ct)
    {
        await Self(actor, ct);
        var row = await db.Set<SystemSetting>().AsNoTracking().SingleOrDefaultAsync(x => x.Key == TerminalLoggingState.Key, ct);
        var settings = row == null ? state.Current : SettingsDefaults.Read<TerminalLoggingRequest>(row.JsonValue);
        if (row != null) state.Publish(settings, row.Version);
        return new(Own(settings, actor), row?.Version ?? 0, row == null ? DateTime.UnixEpoch : DateTime.SpecifyKind(row.UpdatedAtUtc, DateTimeKind.Utc));
    }
    public async Task<SettingsView<TerminalUserLoggingView>> PutMe(string actor, TerminalUserLoggingRequest request, string? etag, CancellationToken ct)
    {
        await Self(actor, ct); SettingsDefaults.Validate(request); ValidateModules(request.Modules.Keys);
        var saved = await Save(actor, etag, true, current =>
        {
            // Remove case variants before adding; do not touch another user's overrides or global switches.
            foreach (var key in current.Users.Keys.Where(k => k.Equals(actor, StringComparison.OrdinalIgnoreCase)).ToArray()) current.Users.Remove(key);
            foreach (var key in current.UserModules.Keys.Where(k => k.Equals(actor, StringComparison.OrdinalIgnoreCase)).ToArray()) current.UserModules.Remove(key);
            current.Users[actor] = request.Enabled;
            current.UserModules[actor] = new(request.Modules);
            return current;
        }, ct);
        return new(Own(saved.Settings, actor), saved.Version, saved.UpdatedAtUtc);
    }
    public async Task<SettingsView<TerminalLoggingOptions>> Put(string actor, TerminalLoggingRequest request, string? etag, CancellationToken ct)
    {
        await security.Demand(actor, SystemSettingsService.Screen, "UPDATE", ct);
        SettingsDefaults.Validate(request);
        ValidateModules(request.Modules.Keys.Concat(request.UserModules.Values.SelectMany(m => m.Keys)));
        var users = request.Users.Keys.Concat(request.UserModules.Keys).Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(x => !x.Equals("system", StringComparison.OrdinalIgnoreCase) && !x.Equals("anonymous", StringComparison.OrdinalIgnoreCase)).ToArray();
        var normalized = users.Select(x => x.ToLowerInvariant()).ToArray();
        var existing = await db.Set<User>().AsNoTracking().Where(x => normalized.Contains(x.UserId.ToLower())).Select(x => x.UserId).ToListAsync(ct);
        if (users.Any(x => !existing.Contains(x, StringComparer.OrdinalIgnoreCase))) throw BusinessException.Invalid("Terminal logging user does not exist.");
        return await Save(actor, etag, false, _ => request, ct);
    }
    private async Task<SettingsView<TerminalLoggingOptions>> Save(string actor, string? etag, bool self,
        Func<TerminalLoggingRequest, TerminalLoggingRequest> transform, CancellationToken ct)
    {
        var expected = SystemSettingsService.Match(etag);
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            if (self) await Self(actor, ct); else await security.Demand(actor, SystemSettingsService.Screen, "UPDATE", ct);
            await db.Set<SystemSetting>().Where(x => x.Key == TerminalLoggingState.Key).ExecuteUpdateAsync(s => s.SetProperty(x => x.Version, x => x.Version), ct);
            var row = await db.Set<SystemSetting>().SingleOrDefaultAsync(x => x.Key == TerminalLoggingState.Key, ct);
            if ((row?.Version ?? 0) != expected) throw new BusinessException(412, "HRM_SETTINGS_412", "Settings changed; reload before saving.");
            var before = row?.JsonValue; var now = clock.GetUtcNow().UtcDateTime;
            var current = SettingsDefaults.Read<TerminalLoggingRequest>(before ?? JsonSerializer.Serialize(state.Current, SettingsDefaults.Json));
            if (self) SettingsDefaults.Validate(current);
            var request = transform(current); SettingsDefaults.Validate(request);
            if (row == null) { row = new SystemSetting { Key = TerminalLoggingState.Key, Version = 0 }; db.Add(row); }
            row.JsonValue = JsonSerializer.Serialize(request, SettingsDefaults.Json); row.Version++; row.UpdatedAtUtc = now;
            object? auditBefore = before == null ? null : self ? Own(SettingsDefaults.Read<TerminalLoggingOptions>(before), actor) : SettingsDefaults.Read<TerminalLoggingOptions>(before);
            security.Audit(actor, self ? "TERMINAL_LOGGING_SELF_UPDATED" : "SETTINGS_UPDATED", TerminalLoggingState.Key, auditBefore, self ? Own(request, actor) : request);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            state.Publish(request, row.Version);
            return new(request, row.Version, DateTime.SpecifyKind(now, DateTimeKind.Utc));
        }
        catch (DbUpdateConcurrencyException) { throw new BusinessException(412, "HRM_SETTINGS_412", "Settings changed; reload before saving."); }
        catch (Exception ex) when (Conflict(ex)) { throw BusinessException.Conflict("Concurrent settings write; reload before retrying."); }
    }
    private static bool Conflict(Exception e) => e is MySqlException { Number: 1062 or 1205 or 1213 } || e.InnerException != null && Conflict(e.InnerException);
}
