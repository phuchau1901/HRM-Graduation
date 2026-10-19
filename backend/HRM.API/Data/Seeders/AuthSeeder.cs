using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Data.Seeders;

public sealed class AuthSeeder(AppDbContext db, PasswordService passwords, IHostEnvironment environment, IConfiguration settings)
{
    private static readonly (string UserId, string Role)[] Accounts =
    [ ("admin", "ADMIN") ];

    // Program supplies a separate configuration containing ONLY user-secrets, never merged app/environment settings.
    public async Task SeedAsync(IConfiguration userSecrets, CancellationToken ct = default)
    {
        if (!environment.IsDevelopment() || !settings.GetValue<bool>("AuthSeed:Enabled")) return;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var existing = await db.Set<User>().AsNoTracking().Select(x => x.UserId).ToListAsync(ct);
        var missing = Accounts.Where(a => !existing.Contains(a.UserId, StringComparer.OrdinalIgnoreCase)).ToArray();
        // Validate all secrets before writing anything, without including their values in exceptions.
        foreach (var account in missing)
            if (!PasswordService.IsValidPasswordInput(userSecrets[$"AuthSeed:Passwords:{account.UserId}"]))
                throw new InvalidOperationException($"Missing or invalid demo password in user-secrets for '{account.UserId}'.");
        var roles = await db.Set<Role>().ToListAsync(ct);
        foreach (var code in Accounts.Select(x => x.Role).Distinct())
            if (!roles.Any(r => string.Equals(r.Code, code, StringComparison.OrdinalIgnoreCase)))
            {
                var role = new Role { Code = code, Name = code };
                roles.Add(role); db.Add(role);
            }
        await db.SaveChangesAsync(ct);
        foreach (var account in missing)
        {
            var credentials = passwords.Hash(userSecrets[$"AuthSeed:Passwords:{account.UserId}"]!);
            var user = new User
            {
                UserId = account.UserId, Email = $"{account.UserId}@example.invalid", Status = "ACTIVE",
                PasswordHash = credentials.PasswordHash, Salt = credentials.Salt, CreatedAt = DateTime.UtcNow
            };
            db.Add(user); await db.SaveChangesAsync(ct);
            var role = roles.Single(r => string.Equals(r.Code, account.Role, StringComparison.OrdinalIgnoreCase));
            db.Add(new UserRole { UserID = user.UserId, RoleID = role.ID });
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        // Existing users, memberships, screen permissions and role names are deliberately untouched.
    }
}
