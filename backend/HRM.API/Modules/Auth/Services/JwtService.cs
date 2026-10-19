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
    public bool IsValid() => !string.IsNullOrWhiteSpace(Issuer) && !string.IsNullOrWhiteSpace(Audience)
        && !string.IsNullOrWhiteSpace(SigningKey) && Encoding.UTF8.GetByteCount(SigningKey) >= 32
        && AccessTokenMinutes is >= 1 and <= 120;
}

public sealed class JwtService(IOptions<JwtOptions> options)
{
    public LoginResponse Issue(AuthProfileDto profile)
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
        claims.AddRange(profile.Roles.Select(r => new Claim("role", r.Code)));
        var token = new JwtSecurityToken(config.Issuer, config.Audience, claims, now, expires,
            new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.SigningKey)), SecurityAlgorithms.HmacSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(token), "Bearer", expires,
            profile.User, profile.Roles, profile.Permissions);
    }
}
