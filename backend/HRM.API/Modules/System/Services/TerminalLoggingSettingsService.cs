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
    public async Task<SettingsView<TerminalLoggingOptions>> Put(string actor, TerminalLoggingRequest request, string? etag, CancellationToken ct)
    {
        await security.Demand(actor, SystemSettingsService.Screen, "UPDATE", ct);
        SettingsDefaults.Validate(request); var expected = SystemSettingsService.Match(etag);
        var modules = Modules().ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (request.Modules.Keys.Any(x => !modules.Contains(x))) throw BusinessException.Invalid("Unknown terminal logging module; load the module catalog first.");
        var users = request.Users.Keys.Where(x => !x.Equals("system", StringComparison.OrdinalIgnoreCase) && !x.Equals("anonymous", StringComparison.OrdinalIgnoreCase)).ToArray();
        var existing = await db.Set<User>().AsNoTracking().Where(x => users.Contains(x.UserId)).Select(x => x.UserId).ToListAsync(ct);
        if (users.Any(x => !existing.Contains(x, StringComparer.OrdinalIgnoreCase))) throw BusinessException.Invalid("Terminal logging user does not exist.");
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        try
        {
            await security.Demand(actor, SystemSettingsService.Screen, "UPDATE", ct);
            await db.Set<SystemSetting>().Where(x => x.Key == TerminalLoggingState.Key).ExecuteUpdateAsync(s => s.SetProperty(x => x.Version, x => x.Version), ct);
            var row = await db.Set<SystemSetting>().SingleOrDefaultAsync(x => x.Key == TerminalLoggingState.Key, ct);
            if ((row?.Version ?? 0) != expected) throw new BusinessException(412, "HRM_SETTINGS_412", "Settings changed; reload before saving.");
            var before = row?.JsonValue; var now = clock.GetUtcNow().UtcDateTime;
            if (row == null) { row = new SystemSetting { Key = TerminalLoggingState.Key, Version = 0 }; db.Add(row); }
            row.JsonValue = JsonSerializer.Serialize(request, SettingsDefaults.Json); row.Version++; row.UpdatedAtUtc = now;
            security.Audit(actor, "SETTINGS_UPDATED", TerminalLoggingState.Key, before is null ? null : SettingsDefaults.Read<TerminalLoggingOptions>(before), request);
            await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
            state.Publish(request, row.Version);
            return new(request, row.Version, DateTime.SpecifyKind(now, DateTimeKind.Utc));
        }
        catch (DbUpdateConcurrencyException) { throw new BusinessException(412, "HRM_SETTINGS_412", "Settings changed; reload before saving."); }
        catch (Exception ex) when (Conflict(ex)) { throw BusinessException.Conflict("Concurrent settings write; reload before retrying."); }
    }
    private static bool Conflict(Exception e) => e is MySqlException { Number: 1062 or 1205 or 1213 } || e.InnerException != null && Conflict(e.InnerException);
}
