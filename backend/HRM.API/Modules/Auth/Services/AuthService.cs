using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Modules.Auth.Services;

public enum LoginStatus { Success, InvalidCredentials, RateLimited }
// Return only authentication identity; never expose credential fields or issue replacement JWTs here.
public sealed record LoginResult(LoginStatus Status, string? UserId = null, long AuthVersion = 0);

public sealed class AuthService(AppDbContext db, PasswordService passwords,
    LoginRateLimiter limiter, IHttpContextAccessor httpContextAccessor)
{
    public async Task<LoginResult> LoginAsync(string? userId, string? password, CancellationToken ct = default)
    {
        // Use the server-resolved address, never a raw, client-controlled forwarding header.
        var client = httpContextAccessor.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (!limiter.TryAcquire(client)) return new(LoginStatus.RateLimited);
        if (string.IsNullOrWhiteSpace(userId) || userId.Length > 100 || !PasswordService.IsValidPasswordInput(password))
        {
            passwords.PerformDummyVerification(password);
            return new(LoginStatus.InvalidCredentials);
        }
        var user = await db.Set<User>().AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId, ct);
        if (user is null || user.Status != "ACTIVE")
        {
            passwords.PerformDummyVerification(password);
            return new(LoginStatus.InvalidCredentials);
        }
        var result = passwords.VerifyForLogin(password, user.PasswordHash, user.Salt);
        if (result == PasswordCheck.Failed)
            return new(LoginStatus.InvalidCredentials);
        if (result == PasswordCheck.RehashNeeded)
        {
            var credentials = passwords.Hash(password!);
            // Compare-and-swap prevents a concurrent reset/change from being overwritten by a login rehash.
            var originalHash = user.PasswordHash;
            var originalSalt = user.Salt;
            var updated = await db.Set<User>()
                .Where(x => x.UserId == user.UserId && x.PasswordHash == originalHash && x.Salt == originalSalt && x.Status == "ACTIVE")
                .ExecuteUpdateAsync(set => set.SetProperty(x => x.PasswordHash, credentials.PasswordHash)
                    .SetProperty(x => x.Salt, credentials.Salt), ct);
            if (updated != 1) return new(LoginStatus.InvalidCredentials);
        }
        return new(LoginStatus.Success, user.UserId, user.AuthVersion);
    }

    /// <summary>Server-side creation primitive. The caller must authorize account creation.</summary>
    public async Task<string> CreateAccountAsync(string userId, string email, string password,
        int? employeeId = null, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId) || userId.Length > 100 || string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("UserId and email are required.");
        var credentials = passwords.Hash(password);
        var user = new User
        {
            UserId = userId, Email = email, EmployeeId = employeeId, Status = "ACTIVE",
            PasswordHash = credentials.PasswordHash, Salt = credentials.Salt, CreatedAt = DateTime.UtcNow
        };
        db.Set<User>().Add(user);
        await db.SaveChangesAsync(ct);
        return user.UserId;
    }

    /// <summary>User ID must come from the authenticated principal, not an untrusted request field.</summary>
    public async Task<bool> ChangePasswordAsync(string userId, string currentPassword, string newPassword,
        CancellationToken ct = default)
    {
        var user = await db.Set<User>().AsNoTracking().SingleOrDefaultAsync(x => x.UserId == userId && x.Status == "ACTIVE", ct);
        if (user is null || passwords.Verify(currentPassword, user.PasswordHash, user.Salt) == PasswordCheck.Failed)
            return false;
        var credentials = passwords.Hash(newPassword);
        return await db.Set<User>().Where(x => x.UserId == userId && x.PasswordHash == user.PasswordHash && x.Salt == user.Salt && x.Status == "ACTIVE")
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.PasswordHash, credentials.PasswordHash)
                .SetProperty(x => x.Salt, credentials.Salt).SetProperty(x => x.AuthVersion, x => x.AuthVersion + 1), ct) == 1;
    }

    /// <summary>Trusted primitive ONLY: caller must validate a single-use reset token or administrator permission.
    /// No public reset endpoint is exposed until that authorization flow exists.</summary>
    public async Task<bool> ResetPasswordAsync(string userId, string newPassword, CancellationToken ct = default)
    {
        var credentials = passwords.Hash(newPassword);
        return await db.Set<User>().Where(x => x.UserId == userId && x.Status == "ACTIVE")
            .ExecuteUpdateAsync(set => set.SetProperty(x => x.PasswordHash, credentials.PasswordHash)
                .SetProperty(x => x.Salt, credentials.Salt).SetProperty(x => x.AuthVersion, x => x.AuthVersion + 1), ct) == 1;
    }
}
