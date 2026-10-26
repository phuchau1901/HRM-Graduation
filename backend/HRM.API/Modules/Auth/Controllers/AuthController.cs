using System.IdentityModel.Tokens.Jwt;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Security;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace HRM.API.Modules.Auth.Controllers;

[ApiController]
[Route("api/auth")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthController(AuthService auth, AuthProfileService profiles, JwtService jwt, IPermissionService permissions) : ControllerBase
{
    [AllowAnonymous]
    [HttpPost("login")]
    [RequestSizeLimit(16_384)]
    public async Task<IActionResult> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        // Preserve username requests, but fail closed if both aliases identify different accounts.
        var userId = request.UserId ?? request.Username;
        if (request.UserId is not null && request.Username is not null && request.UserId != request.Username)
            userId = null;
        var result = await auth.LoginAsync(userId, request.Password, ct);
        if (result.Status == LoginStatus.RateLimited)
        {
            Response.Headers.RetryAfter = "60";
            return StatusCode(429, ApiErrors.Create(HttpContext, "HRM_AUTH_005", "RATE_LIMITED", "Too many login attempts. Try again later."));
        }
        if (result.Status != LoginStatus.Success || result.UserId is null) return InvalidCredentials();
        var profile = await profiles.GetAsync(result.UserId, ct);
        return profile is null ? InvalidCredentials() : Ok(jwt.Issue(profile, await permissions.GetSnapshotAsync(result.UserId, ct), result.AuthVersion));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken ct)
    {
        var profile = await CurrentProfile(ct);
        return profile is null ? Unauthorized(ApiErrors.Create(HttpContext, "HRM_AUTH_001", "INVALID_TOKEN", "Authentication required.")) : Ok(profile);
    }

    [Authorize]
    [HttpGet("me/permissions")]
    public async Task<IActionResult> Permissions(CancellationToken ct)
    {
        var profile = await CurrentProfile(ct);
        return profile is null ? Unauthorized(ApiErrors.Create(HttpContext, "HRM_AUTH_001", "INVALID_TOKEN", "Authentication required.")) : Ok(profile.Permissions);
    }

    private Task<AuthProfileDto?> CurrentProfile(CancellationToken ct)
    {
        var userId = User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        return string.IsNullOrWhiteSpace(userId) || userId.Length > 100
            ? Task.FromResult<AuthProfileDto?>(null) : profiles.GetAsync(userId, ct);
    }
    private UnauthorizedObjectResult InvalidCredentials() => Unauthorized(ApiErrors.Create(HttpContext, "HRM_AUTH_001", "INVALID_CREDENTIALS", "Invalid username or password."));
}
