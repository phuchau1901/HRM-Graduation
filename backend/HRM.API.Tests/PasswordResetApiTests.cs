using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Auth.Entities;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class PasswordResetApiTests
{
    private const string NewSecret = "Changed-secret-2026!";
    private static async Task Login(HttpClient client, string user, string password)
    {
        var result = await client.PostAsJsonAsync("/api/auth/login", new { userId = user, password });
        result.EnsureSuccessStatusCode();
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await result.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
    }
    [Fact]
    public async Task SelfChangeWithoutAdminGrantsOrBootstrapRevokesOldTokensAndNeverLeaksCredentials()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new("https://localhost") });
        await app.PrepareAsync(); await Login(client, "api-user", app.Password);
        long before;
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); before = (await db.Set<User>().SingleAsync()).AuthVersion;
            db.Add(new RefreshToken { UserID = "api-user", TokenHash = "self-refresh", CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(1) }); await db.SaveChangesAsync();
        }
        var response = await client.PostAsJsonAsync("/api/users/api-user/reset-password", new { type = PasswordResetTypes.SelfChange, oldPassword = app.Password, newPassword = NewSecret });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode); Assert.Equal("", await response.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        using var check = app.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        var user = await context.Set<User>().SingleAsync(); Assert.Equal(before + 1, user.AuthVersion);
        Assert.NotNull((await context.Set<RefreshToken>().SingleAsync()).RevokedAt);
        Assert.Equal(PasswordCheck.Success, check.ServiceProvider.GetRequiredService<PasswordService>().Verify(NewSecret, user.PasswordHash, user.Salt));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password })).StatusCode);
        await Login(client, "api-user", NewSecret);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        var audit = await context.Set<AuditLog>().SingleAsync(); Assert.Equal("PASSWORD_RESET", audit.Action);
        using var metadata = JsonDocument.Parse(audit.AfterJSON!); var value = metadata.RootElement;
        Assert.Equal("api-user", value.GetProperty("actorUserId").GetString()); Assert.Equal("api-user", value.GetProperty("targetUserId").GetString());
        Assert.Equal(PasswordResetTypes.SelfChange, value.GetProperty("type").GetString()); Assert.Equal("SUCCESS", value.GetProperty("result").GetString());
        Assert.True(value.TryGetProperty("timestamp", out _));
        foreach (var secret in new[] { app.Password, NewSecret, user.PasswordHash, user.Salt! }) Assert.DoesNotContain(secret, audit.AfterJSON!);
    }
    [Fact]
    public async Task WrongOldPasswordUsesGenericAuthErrorAndLeavesCredentialAndVersionUntouched()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using var target = f.App.CreateClient(new() { BaseAddress = new("https://localhost") }); await Login(target, "target", f.App.Password);
        var response = await target.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.SelfChange, oldPassword = "wrong-old-secret", newPassword = NewSecret });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync(); Assert.Contains("INVALID_CREDENTIALS", json); Assert.DoesNotContain("wrong-old-secret", json);
        Assert.Equal(HttpStatusCode.OK, (await target.GetAsync("/api/auth/me")).StatusCode);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, (await db.Set<User>().SingleAsync(x => x.UserId == "target")).AuthVersion);
        Assert.Contains("AUTHENTICATION_FAILED", (await db.Set<AuditLog>().SingleAsync()).AfterJSON);
    }
    [Fact]
    public async Task SelfChangeCannotTargetAnotherUserEvenWithCorrectOldPasswordOrAdminGrants()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.SelfChange, oldPassword = f.App.Password, newPassword = NewSecret })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users/missing/reset-password", new { type = PasswordResetTypes.SelfChange, oldPassword = f.App.Password, newPassword = NewSecret })).StatusCode);
    }
    [Fact]
    public async Task AdminResetNeedsOnlyUpdateAndDoesNotRequireOldPasswordOrEtag()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using var delegated = f.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_USERS");
            db.Add(new RoleDetail { RoleID = f.TargetRole, ScreenID = screen.ID, CanUpdate = "Y" });
            var c = scope.ServiceProvider.GetRequiredService<PasswordService>().Hash(f.App.Password);
            db.Add(new User { UserId = "limited-target", Email = "limited-target@example.invalid", Status = "ACTIVE", PasswordHash = c.PasswordHash, Salt = c.Salt }); await db.SaveChangesAsync();
        }
        await Login(delegated, "target", f.App.Password);
        var response = await delegated.PostAsJsonAsync("/api/users/limited-target/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await delegated.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await delegated.PostAsJsonAsync("/api/users/api-user/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await delegated.PostAsJsonAsync("/api/users/missing/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret })).StatusCode);
    }
    [Fact]
    public async Task ClientTypeCannotGrantAdminAuthorityAndApproveAloneDoesNotAllowReset()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using var target = f.App.CreateClient(new() { BaseAddress = new("https://localhost") }); await Login(target, "target", f.App.Password);
        var body = new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret };
        Assert.Equal(HttpStatusCode.Forbidden, (await target.PostAsJsonAsync("/api/users/api-user/reset-password", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await target.PostAsJsonAsync("/api/users/missing/reset-password", body)).StatusCode);
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_USERS");
            db.Add(new RoleDetail { RoleID = f.TargetRole, ScreenID = screen.ID, CanApprove = "Y" }); await db.SaveChangesAsync();
        }
        await Login(target, "target", f.App.Password);
        Assert.Equal(HttpStatusCode.Forbidden, (await target.PostAsJsonAsync("/api/users/api-user/reset-password", body)).StatusCode);
    }
    [Fact]
    public async Task AdminResetRechecksLiveGrantsEvenWhenJwtStillContainsUpdate()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_USERS");
            await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanUpdate, "N"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret })).StatusCode);
    }
    [Theory]
    [InlineData(null, null, "Changed-secret-2026!")]
    [InlineData("UNKNOWN", null, "Changed-secret-2026!")]
    [InlineData("self_change", "old", "Changed-secret-2026!")]
    [InlineData("SELF_CHANGE", null, "Changed-secret-2026!")]
    [InlineData("SELF_CHANGE", "", "Changed-secret-2026!")]
    [InlineData("ADMIN_RESET", null, "short")]
    [InlineData("ADMIN_RESET", null, "            ")]
    public async Task InvalidTypeOldPasswordOrPolicyReturns400(string? type, string? oldPassword, string newPassword)
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type, oldPassword, newPassword })).StatusCode);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, (await db.Set<User>().SingleAsync(x => x.UserId == "target")).AuthVersion);
    }
    [Theory]
    [InlineData(11, false)]
    [InlineData(12, true)]
    [InlineData(128, true)]
    [InlineData(129, false)]
    public async Task ExistingNewPasswordLengthPolicyIsPreserved(int length, bool valid)
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        var response = await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = new string('x', length) });
        Assert.Equal(valid ? HttpStatusCode.NoContent : HttpStatusCode.BadRequest, response.StatusCode);
    }
    [Fact]
    public async Task ResetRequiresAuthenticationAndRejectsLegacyBodyWithoutExplicitType()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start(login: false);
        var body = new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret };
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", body)).StatusCode);
        await OrganizationApiTests.Login(f.Client, f.App);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { currentPassword = f.App.Password, newPassword = NewSecret })).StatusCode);
    }
    [Fact]
    public async Task SelfAndAdminModesShareOneRateLimitAndRateLimitedAttemptsAreAudited()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        for (var i = 0; i < 5; i++)
        {
            var self = i % 2 == 0;
            var response = await f.Client.PostAsJsonAsync("/api/users/api-user/reset-password", new { type = self ? PasswordResetTypes.SelfChange : PasswordResetTypes.AdminReset, oldPassword = "wrong-password", newPassword = NewSecret });
            Assert.Equal(self ? HttpStatusCode.Unauthorized : HttpStatusCode.Forbidden, response.StatusCode);
        }
        var limited = await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode); Assert.Contains("RATE_LIMITED", await limited.Content.ReadAsStringAsync());
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logs = await db.Set<AuditLog>().ToListAsync(); Assert.Equal(6, logs.Count);
        Assert.Contains(logs, x => x.AfterJSON!.Contains("RATE_LIMITED"));
        Assert.All(logs, x => Assert.DoesNotContain(NewSecret, x.AfterJSON!));
    }
    [Fact]
    public async Task AdministrativeRecoveryFailureRollsBackPasswordSessionVersionAndRefreshRevocation()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_PERMISSIONS");
            await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanApprove, "N"));
            db.Add(new RefreshToken { UserID = "target", TokenHash = "rollback-refresh", CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(1) }); await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = PasswordResetTypes.AdminReset, newPassword = NewSecret })).StatusCode);
        using var check = f.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        var target = await context.Set<User>().SingleAsync(x => x.UserId == "target");
        Assert.Equal(0, target.AuthVersion); Assert.Null((await context.Set<RefreshToken>().SingleAsync()).RevokedAt);
        Assert.Equal(PasswordCheck.Success, check.ServiceProvider.GetRequiredService<PasswordService>().Verify(f.App.Password, target.PasswordHash, target.Salt));
        Assert.DoesNotContain(await context.Set<AuditLog>().ToListAsync(), x => x.AfterJSON!.Contains("SUCCESS"));
    }
}
