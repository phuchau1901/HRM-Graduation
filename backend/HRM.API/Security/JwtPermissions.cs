using System.Security.Claims;
using System.Text.Json;
using HRM.API.Modules.Authorization.Services;
namespace HRM.API.Security;
public static class JwtPermissions
{
    public const string ClaimType = "hrm_p";
    public static bool HasPermission(ClaimsPrincipal user, string screenCode, string action)
    {
        if (user.Identity?.IsAuthenticated != true || user.FindFirst("hrm_pv")?.Value != "1") return false;
        var operation = PermissionActions.Normalize(action);
        var claims = user.FindAll(ClaimType).ToArray();
        if (operation is null || claims.Length != 1 || claims[0].Value.Length > 32768) return false;
        try
        {
            using var json = JsonDocument.Parse(claims[0].Value, new JsonDocumentOptions { MaxDepth = 4 });
            if (json.RootElement.ValueKind != JsonValueKind.Object) return false;
            var matches = json.RootElement.EnumerateObject().Where(x => x.Name == screenCode).ToArray();
            return matches.Length == 1 && matches[0].Value.ValueKind == JsonValueKind.Array &&
                matches[0].Value.EnumerateArray().Any(x => x.ValueKind == JsonValueKind.String && x.GetString() == operation);
        }
        catch (JsonException) { return false; }
    }
}
