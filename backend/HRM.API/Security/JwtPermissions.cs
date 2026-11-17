using System.Security.Claims;
using System.Text.Json;
using HRM.API.Modules.Authorization.Services;
namespace HRM.API.Security;
public static class JwtPermissions
{
    public const string ClaimType = "hrm_p";
    public const string CurrentVersion = "2";
    // Persisted JWT v2 wire format: never reorder/reassign these bits.
    private static readonly IReadOnlyDictionary<string, int> ActionBits = new Dictionary<string, int>(StringComparer.Ordinal)
    {
        ["VIEW"] = 1, ["NEW"] = 2, ["UPDATE"] = 4, ["DELETE"] = 8,
        ["APPROVE"] = 16, ["EXPORT"] = 32, ["SEND_USER"] = 64,
        ["SEND_GROUP"] = 128, ["SEND_ALL"] = 256, ["SCHEDULE"] = 512, ["CANCEL"] = 1024
    };
    public static string Serialize(Dictionary<string, string[]> permissions)
    {
        var compact = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var (screen, actions) in permissions)
        {
            var mask = 0;
            foreach (var action in actions)
            {
                if (!ActionBits.TryGetValue(action, out var bit)) throw new InvalidOperationException("Unsupported permission action in token snapshot.");
                mask |= bit;
            }
            compact.Add(screen, mask);
        }
        return JsonSerializer.Serialize(compact);
    }
    public static bool HasPermission(ClaimsPrincipal user, string screenCode, string action)
    {
        if (user.Identity?.IsAuthenticated != true) return false;
        var versions = user.FindAll("hrm_pv").ToArray();
        if (versions.Length != 1 || versions[0].Value is not ("1" or CurrentVersion)) return false;
        var operation = PermissionActions.Normalize(action);
        var claims = user.FindAll(ClaimType).ToArray();
        if (operation is null || claims.Length != 1 || claims[0].Value.Length > 32768) return false;
        try
        {
            using var json = JsonDocument.Parse(claims[0].Value, new JsonDocumentOptions { MaxDepth = 4 });
            if (json.RootElement.ValueKind != JsonValueKind.Object) return false;
            var matches = json.RootElement.EnumerateObject().Where(x => x.Name == screenCode).ToArray();
            if (matches.Length != 1) return false;
            if (versions[0].Value == CurrentVersion)
                return matches[0].Value.ValueKind == JsonValueKind.Number && matches[0].Value.TryGetInt32(out var mask)
                    && mask >= 0 && (mask & ~2047) == 0 && ActionBits.TryGetValue(operation, out var bit) && (mask & bit) != 0;
            return matches[0].Value.ValueKind == JsonValueKind.Array &&
                matches[0].Value.EnumerateArray().Any(x => x.ValueKind == JsonValueKind.String && x.GetString() == operation);
        }
        catch (JsonException) { return false; }
    }
}
