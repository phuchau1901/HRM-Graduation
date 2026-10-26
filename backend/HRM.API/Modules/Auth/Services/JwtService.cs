using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HRM.API.Modules.Auth.DTOs;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace HRM.API.Modules.Auth.Services;

public sealed class JwtOptions
{
    public string Issuer { get; set; } = "";
    public string Audience { get; set; } = "";
    public string SigningKey { get; set; } = "";
    public int AccessTokenMinutes { get; set; } = 15;
    public int MaxTokenBytes { get; set; } = 8192;
    public bool IsValid() => !string.IsNullOrWhiteSpace(Issuer) && !string.IsNullOrWhiteSpace(Audience)
        && !string.IsNullOrWhiteSpace(SigningKey) && Encoding.UTF8.GetByteCount(SigningKey) >= 32
        && AccessTokenMinutes is >= 1 and <= 120 && MaxTokenBytes is >= 2048 and <= 32768;
}

public sealed class JwtService(IOptions<JwtOptions> options)
{
    public LoginResponse Issue(AuthProfileDto profile, Dictionary<string, string[]> permissions, long authVersion = 0)
    {
        var config = options.Value;
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(config.AccessTokenMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, profile.User.UserId),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")),
            new(JwtRegisteredClaimNames.Iat, new DateTimeOffset(now).ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture), ClaimValueTypes.Integer64),
            new("name", profile.User.UserId)
        };
        claims.Add(new Claim(HRM.API.Security.JwtPermissions.ClaimType, global::System.Text.Json.JsonSerializer.Serialize(permissions)));
        claims.Add(new Claim("hrm_pv", "1"));
        claims.Add(new Claim("av", authVersion.ToString(CultureInfo.InvariantCulture), ClaimValueTypes.Integer64));
        claims.AddRange(profile.Roles.Select(r => new Claim("role", r.Code)));
        var token = new JwtSecurityToken(config.Issuer, config.Audience, claims, now, expires,
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.SigningKey)), SecurityAlgorithms.HmacSha256));
        var encoded = new JwtSecurityTokenHandler().WriteToken(token);
        if (Encoding.UTF8.GetByteCount(encoded) > config.MaxTokenBytes)
            throw new InvalidOperationException("Permission token exceeds the configured size limit.");
        return new(encoded, "Bearer", expires,
            profile.User, profile.Roles, profile.Permissions);
    }
}
