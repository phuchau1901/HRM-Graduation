using System.Globalization;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
namespace HRM.API.Modules.Approvals.Services;
public static class ApprovalAudit
{
    public static void Record(AppDbContext db, TimeProvider clock, string actor, long id, string action, object? before, object? after)
        => db.Add(new AuditLog { ActorUserID = actor, EntityType = "ApprovalRequest", EntityID = id.ToString(CultureInfo.InvariantCulture), Action = action,
            BeforeJSON = before == null ? null : JsonSerializer.Serialize(before, SettingsDefaults.Json),
            AfterJSON = after == null ? null : JsonSerializer.Serialize(after, SettingsDefaults.Json), CreatedAt = clock.GetUtcNow().UtcDateTime });
}
