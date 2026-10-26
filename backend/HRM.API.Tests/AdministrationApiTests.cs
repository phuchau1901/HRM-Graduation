using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Auth.Entities;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Security;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class AdministrationApiTests
{
    private sealed class Fixture : IDisposable
    {
        internal readonly AuthApiFactory App = new();
        internal readonly HttpClient Client;
        internal long TargetRole, Web, Mobile;
        internal Fixture() => Client = App.CreateClient(new() { BaseAddress = new("https://localhost") });
        internal async Task Start(bool login = true)
        {
            await App.PrepareAsync(); using var scope = App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var root = await db.Set<Role>().SingleAsync(x => x.Code == "HR");
            var role = new Role { Code = "LIMITED", Name = "Limited" };
            var web = new Screen { Code = "TEST_WEB", Name = "Web", Platform = "WEB", IsActive = true };
            var mobile = new Screen { Code = "TEST_MOBILE", Name = "Mobile", Platform = "MOBILE", IsActive = true };
            db.AddRange(role, web, mobile, new Screen { Code = "TEST_OFF", Name = "Inactive", Platform = "WEB", IsActive = false });
            foreach (var code in new[] { "WEB_USERS", "WEB_ROLES", "WEB_PERMISSIONS" }) db.Add(new Screen { Code = code, Name = code, IsActive = true });
            await db.SaveChangesAsync(); TargetRole = role.ID; Web = web.ID; Mobile = mobile.ID;
            foreach (var s in await db.Screens.Where(x => x.IsActive).ToListAsync())
            {
                var grant = await db.RoleDetails.SingleOrDefaultAsync(x => x.RoleID == root.ID && x.ScreenID == s.ID);
                if (grant == null) { grant = new() { RoleID = root.ID, ScreenID = s.ID }; db.Add(grant); }
                grant.CanView = grant.CanNew = grant.CanUpdate = grant.CanDelete = grant.CanApprove = grant.CanExport = "Y";
                foreach (var a in new[] { "SEND_USER", "SEND_GROUP", "SEND_ALL", "SCHEDULE", "CANCEL" })
                    db.Add(new RoleScreenAction { RoleID = root.ID, ScreenID = s.ID, ActionCode = a });
            }
            var c = scope.ServiceProvider.GetRequiredService<PasswordService>().Hash(App.Password);
            db.Add(new User { UserId = "target", Email = "target@example.invalid", Status = "ACTIVE", PasswordHash = c.PasswordHash, Salt = c.Salt });
            db.Add(new UserRole { UserID = "target", RoleID = TargetRole }); await db.SaveChangesAsync();
            if (login) await OrganizationApiTests.Login(Client, App);
        }
        internal async Task<HttpResponseMessage> Send(HttpMethod method, string url, object? body, string? version = null)
        {
            using var message = new HttpRequestMessage(method, url);
            if (body != null) message.Content = JsonContent.Create(body, options: new JsonSerializerOptions());
            if (version != null) message.Headers.TryAddWithoutValidation("If-Match", '"' + version + '"');
            return await Client.SendAsync(message);
        }
        internal async Task<AdminUserDto> User(string id = "target") => (await Client.GetFromJsonAsync<AdminUserDto>("/api/users/" + id))!;
        internal async Task<RoleMatrixDto> Matrix() => (await Client.GetFromJsonAsync<RoleMatrixDto>($"/api/roles/{TargetRole}/permissions"))!;
        public void Dispose() { Client.Dispose(); App.Dispose(); }
    }
    [Theory]
    [InlineData("/api/screens")] [InlineData("/api/users")] [InlineData("/api/roles")] [InlineData("/api/authorization/actions")]
    public async Task CatalogsRequireJwtAndCurrentGrant(string path)
    {
        using var f = new Fixture(); await f.Start(false);
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.Client.GetAsync(path)).StatusCode);
        f.Client.DefaultRequestHeaders.Authorization = new("Bearer", "invalid");
        Assert.Equal(HttpStatusCode.Unauthorized, (await f.Client.GetAsync(path)).StatusCode);
        f.Client.DefaultRequestHeaders.Authorization = null; await OrganizationApiTests.Login(f.Client, f.App);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.RoleDetails.ExecuteUpdateAsync(s => s.SetProperty(x => x.CanView, "N"));
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.GetAsync(path)).StatusCode); // live check rejects stale JWT
    }
    [Fact]
    public async Task ScreenCatalogIsActivePlatformFilteredPagedAndNotUserScoped()
    {
        using var f = new Fixture(); await f.Start();
        var list = (await f.Client.GetFromJsonAsync<HRM.API.Common.PageResult<AdminScreenDto>>("/api/screens?platform=MOBILE"))!;
        Assert.Single(list.Data); Assert.Equal("TEST_MOBILE", list.Data[0].Code);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.GetAsync("/api/screens?platform=DESKTOP")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.GetAsync("/api/screens?pageSize=101")).StatusCode);
        var all = (await f.Client.GetFromJsonAsync<HRM.API.Common.PageResult<AdminScreenDto>>("/api/screens"))!;
        Assert.DoesNotContain(all.Data, x => !x.IsActive); Assert.Contains(all.Data, x => x.Platform == "MOBILE");
        // An active catalog entry without a grant still appears for the catalog administrator.
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Add(new Screen { Code = "UNASSIGNED", Name = "Unassigned", IsActive = true }); await db.SaveChangesAsync();
        Assert.Contains((await f.Client.GetFromJsonAsync<HRM.API.Common.PageResult<AdminScreenDto>>("/api/screens"))!.Data, x => x.Code == "UNASSIGNED");
    }
    [Fact]
    public async Task ScreenWritesValidateUniqueCodeAndProtectReferencedIdentity()
    {
        using var f = new Fixture(); await f.Start();
        var request = new ScreenRequest { Code = "CREATED", Name = "Created" };
        var created = await f.Client.PostAsJsonAsync("/api/screens", request); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var screen = (await created.Content.ReadFromJsonAsync<AdminScreenDto>())!;
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/screens", request)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Send(HttpMethod.Patch, $"/api/screens/{screen.Id}/status", new { isActive = false }, screen.Version)).StatusCode);
        var referenced = (await f.Client.GetFromJsonAsync<AdminScreenDto>($"/api/screens/{f.Web}"))!;
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(HttpMethod.Put, $"/api/screens/{f.Web}", new ScreenRequest { Code = "RENAMED", Name = "Renamed" }, referenced.Version)).StatusCode);
    }
    [Fact]
    public async Task UserCreationUsesSharedHasherAndValidatesIdsEmailEmployeeRoles()
    {
        using var f = new Fixture(); await f.Start();
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        object Request(string id, string email, long[]? ids = null, int? employee = null) => new { userId = id, email, password = secret, roleIds = ids ?? [], employeeId = employee };
        var created = await f.Client.PostAsJsonAsync("/api/users", Request("created", "created@example.invalid", [f.TargetRole]));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var json = await created.Content.ReadAsStringAsync(); Assert.DoesNotContain(secret, json); Assert.DoesNotContain("salt", json, StringComparison.OrdinalIgnoreCase); Assert.DoesNotContain("password", json, StringComparison.OrdinalIgnoreCase);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/users", Request("created", "other@example.invalid"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/users", Request("other", "created@example.invalid"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users", Request("other", "other@example.invalid", [999999]))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users", Request("other", "other@example.invalid", employee: 99999))).StatusCode);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var u = await db.Set<User>().SingleAsync(x => x.UserId == "created");
        Assert.Equal(PasswordCheck.Success, scope.ServiceProvider.GetRequiredService<PasswordService>().Verify(secret, u.PasswordHash, u.Salt));
        Assert.Equal(32, Convert.FromBase64String(u.Salt!).Length);
    }
    [Fact]
    public async Task IfMatchRequiredStaleRejectedAndAuditContainsNoCredentials()
    {
        using var f = new Fixture(); await f.Start(); var u = await f.User();
        var request = new { email = "changed@example.invalid", employeeId = (int?)null };
        Assert.Equal((HttpStatusCode)428, (await f.Send(HttpMethod.Put, "/api/users/target", request)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Send(HttpMethod.Put, "/api/users/target", request, u.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await f.Send(HttpMethod.Put, "/api/users/target", request, u.Version)).StatusCode);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var log = await db.Set<AuditLog>().SingleAsync(); Assert.Contains("traceId", log.AfterJSON); Assert.DoesNotContain(f.App.Password, log.AfterJSON);
        Assert.DoesNotContain("passwordHash", log.AfterJSON!, StringComparison.OrdinalIgnoreCase);
    }
    [Fact]
    public async Task LastAdministratorCannotBeLockedAndSelfRoleEditsAreDenied()
    {
        using var f = new Fixture(); await f.Start(); var root = await f.User("api-user");
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(HttpMethod.Patch, "/api/users/api-user/status", new { status = "LOCKED" }, root.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Put, "/api/users/api-user/roles", new { roleIds = new[] { f.TargetRole } }, root.Version)).StatusCode);
        var roleId = root.Roles.First().Id;
        var matrix = (await f.Client.GetFromJsonAsync<RoleMatrixDto>($"/api/roles/{roleId}/permissions"))!;
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Put, $"/api/roles/{roleId}/permissions", new { screens = new object[] { new { screenCode = "TEST_WEB", standard = new { VIEW = false } } } }, matrix.Version)).StatusCode);
    }
    [Theory]
    [InlineData("VIEW")] [InlineData("NEW")] [InlineData("UPDATE")] [InlineData("DELETE")] [InlineData("APPROVE")] [InlineData("EXPORT")]
    [InlineData("SEND_USER")] [InlineData("SEND_GROUP")] [InlineData("SEND_ALL")] [InlineData("SCHEDULE")] [InlineData("CANCEL")]
    public async Task MatrixGrantsOnlyExplicitActionsAndPreservesExtendedOnStandardPatch(string action)
    {
        using var f = new Fixture(); await f.Start(); var before = await f.Matrix();
        var extended = action.StartsWith("SEND_") || action is "SCHEDULE" or "CANCEL";
        object patch = extended ? new { screenCode = "TEST_WEB", extendedActions = new[] { action } } : new { screenCode = "TEST_WEB", standard = new Dictionary<string, bool> { [action] = true } };
        var response = await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] { patch } }, before.Version);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var scope = f.App.Services.CreateScope(); var permissions = scope.ServiceProvider.GetRequiredService<HRM.API.Modules.Authorization.Services.IPermissionService>();
        Assert.True(await permissions.HasPermissionAsync("target", "TEST_WEB", action));
        Assert.False(await permissions.HasPermissionAsync("target", "TEST_MOBILE", action));
        var current = (await response.Content.ReadFromJsonAsync<RoleMatrixDto>())!;
        var updated = await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] { new { screenCode = "TEST_WEB", standard = new { VIEW = false } } } }, current.Version);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        if (extended) Assert.Contains(action, (await updated.Content.ReadFromJsonAsync<RoleMatrixDto>())!.Screens.Single().ExtendedActions);
    }
    [Fact]
    public async Task MatrixRejectsUnknownScreenActionAndDuplicateScreens()
    {
        using var f = new Fixture(); await f.Start(); var matrix = await f.Matrix();
        foreach (var patch in new object[] { new { screenCode = "ABSENT", standard = new { VIEW = true } }, new { screenCode = "TEST_WEB", standard = new { GOD = true } }, new { screenCode = "TEST_WEB", extendedActions = new[] { "UNKNOWN" } } })
            Assert.Equal(HttpStatusCode.BadRequest, (await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] { patch } }, matrix.Version)).StatusCode);
        var p = new { screenCode = "TEST_WEB", standard = new { VIEW = true } };
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] { p, p } }, matrix.Version)).StatusCode);
    }
    [Fact]
    public async Task PermissionRevocationInvalidatesExistingJwtAndNewLoginReflectsGrants()
    {
        using var f = new Fixture(); await f.Start(); var matrix = await f.Matrix();
        var grant = await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] { new { screenCode = "TEST_WEB", standard = new { VIEW = true } } } }, matrix.Version);
        Assert.Equal(HttpStatusCode.OK, grant.StatusCode);
        using var target = f.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        var login = await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = f.App.Password });
        target.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<HRM.API.Modules.Auth.DTOs.LoginResponse>())!.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await target.GetAsync("/api/auth/me")).StatusCode);
        var latest = await f.Matrix();
        Assert.Equal(HttpStatusCode.OK, (await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] { new { screenCode = "TEST_WEB", standard = new { VIEW = false } } } }, latest.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await target.GetAsync("/api/auth/me")).StatusCode);
        var renewed = await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = f.App.Password });
        Assert.Equal(HttpStatusCode.OK, renewed.StatusCode);
        Assert.Empty((await renewed.Content.ReadFromJsonAsync<HRM.API.Modules.Auth.DTOs.LoginResponse>())!.Permissions);
    }
    [Fact]
    public async Task ResetRequiresReauthenticationRevokesAccessAndRefreshAndDoesNotNotify()
    {
        using var f = new Fixture(); await f.Start(); var u = await f.User();
        using var target = f.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        var login = await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = f.App.Password });
        target.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<HRM.API.Modules.Auth.DTOs.LoginResponse>())!.AccessToken);
        using (var scope = f.App.Services.CreateScope())
        { var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); db.Add(new RefreshToken { UserID = "target", TokenHash = "test-digest", CreatedAt = DateTime.UtcNow, ExpiresAt = DateTime.UtcNow.AddDays(1) }); await db.SaveChangesAsync(); }
        var secret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Post, "/api/users/target/reset-password", new { currentPassword = "wrong", newPassword = secret }, u.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Send(HttpMethod.Post, "/api/users/target/reset-password", new { currentPassword = f.App.Password, newPassword = secret }, u.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await target.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = f.App.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = secret })).StatusCode);
        using var check = f.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.NotNull((await context.Set<RefreshToken>().SingleAsync()).RevokedAt);
        Assert.Empty(await context.Set<Notification>().ToListAsync());
        Assert.DoesNotContain(secret, (await context.Set<AuditLog>().SingleAsync()).AfterJSON);
    }
    [Fact]
    public async Task ResetRateLimitAppliesBeforePasswordHashing()
    {
        using var f = new Fixture(); await f.Start(); var u = await f.User();
        for (var i = 0; i < 5; i++) Assert.Equal(HttpStatusCode.Forbidden,
            (await f.Send(HttpMethod.Post, "/api/users/target/reset-password", new { currentPassword = "wrong", newPassword = f.App.Password }, u.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.TooManyRequests, (await f.Send(HttpMethod.Post, "/api/users/target/reset-password", new { currentPassword = "wrong", newPassword = f.App.Password }, u.Version)).StatusCode);
    }
    [Fact]
    public async Task DelegatedAdminCannotGrantOrTakeOverPrivilegesItDoesNotHave()
    {
        using var f = new Fixture(); await f.Start();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var role = await db.Set<Role>().SingleAsync(x => x.ID == f.TargetRole);
            foreach (var code in new[] { "WEB_USERS", "WEB_PERMISSIONS", "WEB_ROLES" })
            { var s = await db.Screens.SingleAsync(x => x.Code == code); db.Add(new RoleDetail { RoleID = role.ID, ScreenID = s.ID, CanView = "Y", CanNew = "Y", CanUpdate = "Y", CanApprove = "Y" }); }
            await db.SaveChangesAsync();
        }
        var root = await f.User("api-user"); var matrix = await f.Matrix();
        var login = await f.Client.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = f.App.Password });
        f.Client.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<HRM.API.Modules.Auth.DTOs.LoginResponse>())!.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Put, "/api/users/api-user/roles", new { roleIds = new[] { f.TargetRole } }, root.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Post, "/api/users/api-user/reset-password", new { currentPassword = f.App.Password, newPassword = f.App.Password }, root.Version)).StatusCode);
        var created = await f.Client.PostAsJsonAsync("/api/roles", new RoleRequest { Code = "EMPTY", Name = "Empty" }); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var roleView = (await created.Content.ReadFromJsonAsync<AdminRoleView>())!;
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Put, $"/api/roles/{roleView.Id}/permissions", new { screens = new object[] { new { screenCode = "TEST_WEB", standard = new { DELETE = true } } } }, roleView.Version)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users", new { userId = "escalated", email = "escalated@example.invalid", password = f.App.Password, roleIds = root.Roles.Select(x => x.Id).ToArray() })).StatusCode);
    }
    [Fact]
    public async Task RoleCrudStartsEmptyAndBlocksDeletionWhileAssigned()
    {
        using var f = new Fixture(); await f.Start();
        var created = await f.Client.PostAsJsonAsync("/api/roles", new RoleRequest { Code = "CREATED", Name = "Created" }); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var role = (await created.Content.ReadFromJsonAsync<AdminRoleView>())!;
        Assert.Empty((await f.Client.GetFromJsonAsync<RoleMatrixDto>($"/api/roles/{role.Id}/permissions"))!.Screens);
        var updated = await f.Send(HttpMethod.Put, $"/api/roles/{role.Id}", new RoleRequest { Code = "CREATED", Name = "Changed" }, role.Version);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode); var next = (await updated.Content.ReadFromJsonAsync<AdminRoleView>())!;
        Assert.Equal(HttpStatusCode.NoContent, (await f.Send(HttpMethod.Delete, $"/api/roles/{role.Id}", null, next.Version)).StatusCode);
        var assigned = (await f.Client.GetFromJsonAsync<AdminRoleView>($"/api/roles/{f.TargetRole}"))!;
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(HttpMethod.Delete, $"/api/roles/{f.TargetRole}", null, assigned.Version)).StatusCode);
        Assert.Single((await f.Client.GetFromJsonAsync<HRM.API.Common.PageResult<AdminUserDto>>($"/api/roles/{f.TargetRole}/users"))!.Data);
    }
    [Fact]
    public async Task FailedMatrixBatchRollsBackEarlierEntriesAndAudit()
    {
        using var f = new Fixture(); await f.Start(); var before = await f.Matrix();
        var response = await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] {
            new { screenCode = "TEST_WEB", standard = new { VIEW = true } },
            new { screenCode = "NOT_A_SCREEN", standard = new { VIEW = true } } } }, before.Version);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(before.Version, (await f.Matrix()).Version);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Set<AuditLog>().ToArrayAsync());
        Assert.Equal(0, (await db.Set<User>().SingleAsync(x => x.UserId == "target")).AuthVersion);
    }
    [Fact]
    public async Task MultipleRolesMergeAndAssignmentRevokesOldJwt()
    {
        using var f = new Fixture(); await f.Start();
        var granted = await f.Send(HttpMethod.Put, $"/api/roles/{f.TargetRole}/permissions", new { screens = new object[] {
            new { screenCode = "TEST_WEB", standard = new { VIEW = true } }, new { screenCode = "TEST_MOBILE", standard = new { EXPORT = true } } } }, (await f.Matrix()).Version);
        Assert.Equal(HttpStatusCode.OK, granted.StatusCode);
        var otherResponse = await f.Client.PostAsJsonAsync("/api/roles", new RoleRequest { Code = "SECOND", Name = "Second" });
        var other = (await otherResponse.Content.ReadFromJsonAsync<AdminRoleView>())!;
        Assert.Equal(HttpStatusCode.OK, (await f.Send(HttpMethod.Put, $"/api/roles/{other.Id}/permissions", new { screens = new object[] {
            new { screenCode = "TEST_WEB", standard = new { UPDATE = true } } } }, other.Version)).StatusCode);
        using var target = f.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        var login = await target.PostAsJsonAsync("/api/auth/login", new { userId = "target", password = f.App.Password });
        target.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<HRM.API.Modules.Auth.DTOs.LoginResponse>())!.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await f.Send(HttpMethod.Put, "/api/users/target/roles", new { roleIds = new[] { f.TargetRole, other.Id } }, (await f.User()).Version)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await target.GetAsync("/api/auth/me")).StatusCode);
        using var scope = f.App.Services.CreateScope(); var permissions = scope.ServiceProvider.GetRequiredService<HRM.API.Modules.Authorization.Services.IPermissionService>();
        Assert.True(await permissions.HasPermissionAsync("target", "TEST_WEB", "VIEW"));
        Assert.True(await permissions.HasPermissionAsync("target", "TEST_WEB", "UPDATE"));
        Assert.True(await permissions.HasPermissionAsync("target", "TEST_MOBILE", "EXPORT"));
        Assert.False(await permissions.HasPermissionAsync("target", "TEST_MOBILE", "VIEW"));
    }
    [Fact]
    public async Task DormantGrantCannotBeReactivatedToEscalateAndBootstrapScreenCannotBeDisabled()
    {
        using var f = new Fixture(); await f.Start();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var dormant = await db.Screens.SingleAsync(x => x.Code == "TEST_OFF");
            var rootRole = await db.Set<Role>().SingleAsync(x => x.Code == "HR");
            db.Add(new RoleDetail { RoleID = rootRole.ID, ScreenID = dormant.ID, CanDelete = "Y" }); await db.SaveChangesAsync();
        }
        var catalog = (await f.Client.GetFromJsonAsync<HRM.API.Common.PageResult<AdminScreenDto>>("/api/screens"))!;
        var bootstrap = catalog.Data.Single(x => x.Code == "WEB_PERMISSIONS");
        Assert.Equal(HttpStatusCode.Conflict, (await f.Send(HttpMethod.Patch, $"/api/screens/{bootstrap.Id}/status", new { isActive = false }, bootstrap.Version)).StatusCode);
        using var check = f.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        var off = await context.Screens.SingleAsync(x => x.Code == "TEST_OFF");
        var inactive = (await f.Client.GetFromJsonAsync<AdminScreenDto>($"/api/screens/{off.ID}"))!;
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Send(HttpMethod.Patch, $"/api/screens/{off.ID}/status", new { isActive = true }, inactive.Version)).StatusCode);
    }
    [Fact]
    public void SessionVersionRejectsMalformedAndOldClaims()
    {
        ClaimsPrincipal P(params string[] values) => new(new ClaimsIdentity(values.Select(x => new Claim("av", x)), "test"));
        Assert.True(AuthSessionVersion.Matches(P(), 0)); Assert.False(AuthSessionVersion.Matches(P(), 1));
        Assert.True(AuthSessionVersion.Matches(P("2"), 2)); Assert.False(AuthSessionVersion.Matches(P("1"), 2));
        Assert.False(AuthSessionVersion.Matches(P("-1"), 0)); Assert.False(AuthSessionVersion.Matches(P("2", "2"), 2));
        Assert.NotEqual(AuthSessionVersion.NotificationGroup("target", 1), AuthSessionVersion.NotificationGroup("target", 2));
    }
}
