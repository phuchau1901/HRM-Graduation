using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
internal sealed class AttendanceTestClock : TimeProvider
{
    public DateTimeOffset Now { get; set; } = new(2026, 11, 16, 0, 0, 0, TimeSpan.Zero);
    public override DateTimeOffset GetUtcNow() => Now;
}
public sealed class SystemSettingsTests
{
    private static Shift Night() => new() { ID = 1, Code = "NIGHT", StartTime = new(22, 0), EndTime = new(6, 0), BreakMinutes = 60, LateGraceMinutes = 5, IsActive = true };
    [Fact]
    public void OvernightRulesUseLocalWorkDateAndUtcWindows()
    {
        var date = new DateOnly(2026, 11, 16); var config = new AttendanceSettingsRequest();
        var rules = AttendanceRules.Snapshot(Night(), date, config, 1);
        Assert.Equal(new DateTime(2026, 11, 16, 15, 0, 0, DateTimeKind.Utc), rules.StartAtUtc);
        Assert.Equal(new DateTime(2026, 11, 16, 23, 0, 0, DateTimeKind.Utc), rules.EndAtUtc);
        Assert.Equal(date.AddDays(1), AttendanceRules.LocalDate(rules.EndAtUtc, config.Timezone));
        AttendanceRules.Window(rules, rules.CheckInOpenUtc, true); AttendanceRules.Window(rules, rules.CheckOutCloseUtc, false);
        Assert.Throws<BusinessException>(() => AttendanceRules.Window(rules, rules.CheckInOpenUtc.AddTicks(-1), true));
        Assert.Throws<BusinessException>(() => AttendanceRules.Window(rules, rules.CheckOutCloseUtc.AddTicks(1), false));
        Assert.Equal(0, AttendanceRules.Late(rules, rules.StartAtUtc.AddMinutes(5))); Assert.Equal(1, AttendanceRules.Late(rules, rules.StartAtUtc.AddMinutes(6)));
        Assert.Equal(1, AttendanceRules.Early(rules, rules.EndAtUtc.AddMinutes(-6)));
        config.AllowOvernightShifts = false; Assert.Throws<BusinessException>(() => AttendanceRules.Snapshot(Night(), date, config, 1));
    }
    [Fact]
    public void TimezoneWorkingDaysGpsAndDstAreValidated()
    {
        Assert.Throws<BusinessException>(() => SettingsDefaults.Validate(new AttendanceSettingsRequest { Timezone = "not/a-zone" }));
        Assert.Throws<BusinessException>(() => SettingsDefaults.Validate(new AttendanceSettingsRequest { WorkingDays = [1, 1] }));
        Assert.Throws<BusinessException>(() => SettingsDefaults.Validate(new AttendanceSettingsRequest { RequireGps = true }));
        Assert.Throws<BusinessException>(() => AttendanceRules.Snapshot(Night(), new(2026, 11, 15), new AttendanceSettingsRequest(), 1));
        Assert.Equal(0, AttendanceRules.DistanceMeters(10, 106, 10, 106), 6);
        Assert.True(AttendanceRules.DistanceMeters(10, 106, 11, 106) > 100000);
        var dst = new AttendanceSettingsRequest { Timezone = "America/New_York", WorkingDays = [7] };
        Assert.Throws<BusinessException>(() => AttendanceRules.Snapshot(new Shift { StartTime = new(2, 30), EndTime = new(8, 0) }, new(2026, 3, 8), dst, 1));
    }
    [Fact]
    public async Task SettingsRequireExplicitGrantAndEtagAndAuditDoesNotRevokePasswords()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.GetAsync("/api/system-settings/password-policy")).StatusCode);
        await OrganizationApiTests.Grant(f.App, "WEB_SYSTEM_SETTINGS"); await OrganizationApiTests.Login(f.Client, f.App);
        var before = await f.Client.GetAsync("/api/system-settings/password-policy"); Assert.Equal(HttpStatusCode.OK, before.StatusCode);
        var etag = before.Headers.ETag!.ToString();
        Assert.Equal(HttpStatusCode.PreconditionRequired, (await f.Client.PutAsJsonAsync("/api/system-settings/password-policy", new PasswordPolicyRequest())).StatusCode);
        var policy = new PasswordPolicyRequest { MinimumLength = 20, RequireDigit = true };
        using var request = new HttpRequestMessage(HttpMethod.Put, "/api/system-settings/password-policy") { Content = JsonContent.Create(policy) }; request.Headers.TryAddWithoutValidation("If-Match", etag);
        Assert.Equal(HttpStatusCode.OK, (await f.Client.SendAsync(request)).StatusCode);
        using var stale = new HttpRequestMessage(HttpMethod.Put, "/api/system-settings/password-policy") { Content = JsonContent.Create(policy) }; stale.Headers.TryAddWithoutValidation("If-Match", etag);
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await f.Client.SendAsync(stale)).StatusCode);
        // The currently valid JWT and stored password remain valid after policy updates.
        Assert.Equal(HttpStatusCode.OK, (await f.Client.GetAsync("/api/auth/me")).StatusCode);
        using var services = f.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(0, (await db.Set<User>().SingleAsync(x => x.UserId == "api-user")).AuthVersion);
        var audit = await db.Set<AuditLog>().SingleAsync(); Assert.Equal("SETTINGS_UPDATED", audit.Action); Assert.DoesNotContain(f.App.Password, audit.AfterJSON!);
    }
    [Theory]
    [InlineData("uppercase")]
    [InlineData("lowercase")]
    [InlineData("digit")]
    [InlineData("special")]
    [InlineData("username")]
    [InlineData("length")]
    public async Task EveryPasswordRuleIsAppliedWithoutChangingHashing(string rule)
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var config = new PasswordPolicyRequest { MinimumLength = 8 };
        var invalid = "abcdefgh";
        switch (rule)
        {
            case "uppercase": config.RequireUppercase = true; break;
            case "lowercase": config.RequireLowercase = true; invalid = "ABCDEFGH"; break;
            case "digit": config.RequireDigit = true; break;
            case "special": config.RequireSpecialCharacter = true; break;
            case "username": config.DisallowUsernameInPassword = true; invalid = "target-pass"; break;
            case "length": config.MinimumLength = 12; break;
        }
        await db.Set<SystemSetting>().Where(x => x.Key == SettingsDefaults.PasswordKey).ExecuteUpdateAsync(x => x.SetProperty(s => s.JsonValue, JsonSerializer.Serialize(config, SettingsDefaults.Json)));
        var service = scope.ServiceProvider.GetRequiredService<PasswordPolicyService>();
        await Assert.ThrowsAsync<BusinessException>(() => service.ValidateAsync("target", invalid, default));
        await service.ValidateAsync("target", "Good-new-password-123!", default);
    }
    [Fact]
    public async Task HistoryRejectsReuseAcrossSelfAndAdminResetAndRollsBackOnPolicyFailure()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var p = new PasswordPolicyRequest { PasswordHistoryCount = 2 };
            await db.Set<SystemSetting>().Where(x => x.Key == SettingsDefaults.PasswordKey).ExecuteUpdateAsync(x => x.SetProperty(s => s.JsonValue, JsonSerializer.Serialize(p, SettingsDefaults.Json)));
        }
        var reset = await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = "ADMIN_RESET", newPassword = "First-password-123!" }); Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = "ADMIN_RESET", newPassword = f.App.Password })).StatusCode);
        using var target = f.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        var login = await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = "First-password-123!" });
        var token = (await login.Content.ReadFromJsonAsync<HRM.API.Modules.Auth.DTOs.LoginResponse>())!.AccessToken; target.DefaultRequestHeaders.Authorization = new("Bearer", token);
        Assert.Equal(HttpStatusCode.BadRequest, (await target.PostAsJsonAsync("/api/users/target/reset-password", new { type = "SELF_CHANGE", oldPassword = "First-password-123!", newPassword = f.App.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await target.PostAsJsonAsync("/api/users/target/reset-password", new { type = "SELF_CHANGE", oldPassword = "First-password-123!", newPassword = "Second-password-123!" })).StatusCode);
        using var check = f.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await context.Set<PasswordHistory>().CountAsync(x => x.UserId == "target"));
        Assert.Equal(2, (await context.Set<User>().SingleAsync(x => x.UserId == "target")).AuthVersion);
        Assert.DoesNotContain(await context.Set<AuditLog>().ToListAsync(), x => (x.AfterJSON ?? "").Contains("First-password-123!"));
    }
    [Fact]
    public async Task ConfiguredPolicyReplacesDtoHardcodeAndDoesNotAffectExistingLogin()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var config = new PasswordPolicyRequest { MinimumLength = 8, MaximumLength = 10, RequireDigit = true };
            await db.Set<SystemSetting>().Where(x => x.Key == SettingsDefaults.PasswordKey).ExecuteUpdateAsync(x => x.SetProperty(s => s.JsonValue, JsonSerializer.Serialize(config, SettingsDefaults.Json)));
            var auth = scope.ServiceProvider.GetRequiredService<AuthService>();
            await Assert.ThrowsAsync<BusinessException>(() => auth.CreateAccountAsync("primitive", "primitive@example.invalid", "abcdefgh"));
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users", new { userId = "bad-policy", email = "bad@example.invalid", password = "abcdefgh", roleIds = Array.Empty<long>() })).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await f.Client.PostAsJsonAsync("/api/users", new { userId = "new-policy", email = "new-policy@example.invalid", password = "Good123!", roleIds = Array.Empty<long>() })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await f.Client.PostAsJsonAsync("/api/users/target/reset-password", new { type = "ADMIN_RESET", newPassword = "Good123!" })).StatusCode);
        // Root's old 32-character password exceeds the new max; it must still authenticate.
        await OrganizationApiTests.Login(f.Client, f.App);
        Assert.Equal(HttpStatusCode.OK, (await f.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task SettingsConcurrencyAllowsOnlyOneWriterWithSameEtag()
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-settings-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            using var f = new AdministrationApiTests.Fixture(new AuthApiFactory { SqliteDatabasePath = path }); await f.Start();
            await OrganizationApiTests.Grant(f.App, "WEB_SYSTEM_SETTINGS"); await OrganizationApiTests.Login(f.Client, f.App);
            var get = await f.Client.GetAsync("/api/system-settings/attendance"); var tag = get.Headers.ETag!.ToString();
            async Task<HttpResponseMessage> Put(int grace)
            {
                using var message = new HttpRequestMessage(HttpMethod.Put, "/api/system-settings/attendance") { Content = JsonContent.Create(new AttendanceSettingsRequest { LateGraceMinutes = grace }) };
                message.Headers.TryAddWithoutValidation("If-Match", tag); return await f.Client.SendAsync(message);
            }
            var responses = await Task.WhenAll(Put(10), Put(20));
            Assert.Single(responses, x => x.StatusCode == HttpStatusCode.OK); Assert.Single(responses, x => x.StatusCode == HttpStatusCode.PreconditionFailed);
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
}
