using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
namespace HRM.API.Security;
public static class AuthSessionVersion
{
    // Legacy access tokens are accepted only while the user's version is still zero.
    public static bool Matches(ClaimsPrincipal? principal, long current)
    {
        var claims = principal?.FindAll("av").ToArray() ?? [];
        if (claims.Length == 0) return current == 0;
        return claims.Length == 1 && long.TryParse(claims[0].Value, NumberStyles.None, CultureInfo.InvariantCulture, out var value)
            && value >= 0 && value == current;
    }
    public static string NotificationGroup(string userId, long version) => "hrm-session:" +
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(userId))) + ":" + version.ToString(CultureInfo.InvariantCulture);
}
