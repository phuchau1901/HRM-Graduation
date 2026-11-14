using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.System.Services;
public sealed class PasswordPolicyService(AppDbContext db, PasswordService passwords, TimeProvider clock)
{
    public async Task<PasswordPolicyRequest> ReadAsync(CancellationToken ct)
    {
        var json = await db.Set<SystemSetting>().AsNoTracking().Where(x => x.Key == SettingsDefaults.PasswordKey).Select(x => x.JsonValue).SingleOrDefaultAsync(ct)
            ?? throw BusinessException.Conflict("Password policy is not initialized; review the settings migration.");
        return SettingsDefaults.Read<PasswordPolicyRequest>(json);
    }
    public async Task ValidateAsync(string username, string password, CancellationToken ct)
    {
        var p = await ReadAsync(ct);
        if (string.IsNullOrWhiteSpace(password) || password.Length < p.MinimumLength || password.Length > p.MaximumLength ||
            p.RequireUppercase && !password.Any(char.IsUpper) || p.RequireLowercase && !password.Any(char.IsLower) ||
            p.RequireDigit && !password.Any(char.IsDigit) || p.RequireSpecialCharacter && !password.Any(c => !char.IsLetterOrDigit(c) && !char.IsWhiteSpace(c)) ||
            p.DisallowUsernameInPassword && !string.IsNullOrEmpty(username) && password.Contains(username, StringComparison.OrdinalIgnoreCase))
            throw BusinessException.Invalid("New password does not satisfy the configured password policy.");
        if (p.PasswordHistoryCount == 0) return;
        var user = await db.Set<User>().AsNoTracking().SingleOrDefaultAsync(x => x.UserId == username, ct);
        if (user is not null && passwords.Verify(password, user.PasswordHash, user.Salt) != PasswordCheck.Failed) throw Reused();
        var history = await db.Set<PasswordHistory>().AsNoTracking().Where(x => x.UserId == username).OrderByDescending(x => x.Id).Take(p.PasswordHistoryCount).ToListAsync(ct);
        if (history.Any(x => passwords.Verify(password, x.PasswordHash, x.Salt) != PasswordCheck.Failed)) throw Reused();
    }
    public async Task RememberAsync(User user, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Password history requires the password transaction.");
        var policy = await ReadAsync(ct);
        if (policy.PasswordHistoryCount == 0 || string.IsNullOrEmpty(user.PasswordHash)) return;
        db.Add(new PasswordHistory { UserId = user.UserId, PasswordHash = user.PasswordHash, Salt = user.Salt ?? "", CreatedAtUtc = clock.GetUtcNow().UtcDateTime });
        await db.SaveChangesAsync(ct);
        var retained = await db.Set<PasswordHistory>().Where(x => x.UserId == user.UserId).OrderByDescending(x => x.Id).Take(policy.PasswordHistoryCount).Select(x => x.Id).ToArrayAsync(ct);
        await db.Set<PasswordHistory>().Where(x => x.UserId == user.UserId && !retained.Contains(x.Id)).ExecuteDeleteAsync(ct);
    }
    private static BusinessException Reused() => BusinessException.Invalid("New password must not match the current or remembered passwords.");
}
