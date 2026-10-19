using System.Net;
using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using HRM.API.Data;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

namespace HRM.API.Tests;

public sealed class AuthenticationApiTests
{
    [Fact]
    public async Task LoginIssuesJwtAndProtectedEndpointsReturnCurrentPermissions()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "api-user", password = app.Password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("passwordHash", json); Assert.DoesNotContain("salt", json); Assert.DoesNotContain(app.Password, json);
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        Assert.Equal("Bearer", login.TokenType); Assert.Equal(2, login.Roles.Count);
        var permission = Assert.Single(login.Permissions);
        Assert.Equal("Y", permission.CanView); Assert.Equal("Y", permission.CanUpdate); Assert.Equal("N", permission.CanDelete);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/auth/me/permissions")).StatusCode);
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<RoleDetail>().ExecuteUpdateAsync(s => s.SetProperty(x => x.CanView, "N"));
        }
        var current = (await client.GetFromJsonAsync<List<ScreenPermissionDto>>("/api/auth/me/permissions"))!;
        Assert.Empty(current);
        using (var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<UserRole>().ExecuteDeleteAsync();
        var withoutRoles = (await client.GetFromJsonAsync<AuthProfileDto>("/api/auth/me"))!;
        Assert.Empty(withoutRoles.Roles);
        Assert.Empty(withoutRoles.Permissions);
        using (var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<User>().ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "DISABLED"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task StringUserIdAndLegacyUsernameBothAuthenticateWithoutSeparateUsername()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        var modern = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password });
        Assert.Equal(HttpStatusCode.OK, modern.StatusCode);
        var payload = await modern.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.Equal("api-user", payload!.User.UserId);
        Assert.Equal("api-user", new JwtSecurityTokenHandler().ReadJwtToken(payload.AccessToken).Subject);
        var raw = await modern.Content.ReadAsStringAsync();
        Assert.Contains("\"userId\":\"api-user\"", raw);
        Assert.DoesNotContain("username", raw, StringComparison.OrdinalIgnoreCase);
        var legacy = await client.PostAsJsonAsync("/api/auth/login", new { username = "api-user", password = app.Password });
        Assert.Equal(HttpStatusCode.OK, legacy.StatusCode);
        var sameAliases = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", username = "api-user", password = app.Password });
        Assert.Equal(HttpStatusCode.OK, sameAliases.StatusCode);
        var conflicting = await client.PostAsJsonAsync("/api/auth/login", new { userId = "missing", username = "api-user", password = app.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, conflicting.StatusCode);
        var tooLong = await client.PostAsJsonAsync("/api/auth/login", new { userId = new string('x', 101), password = app.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, tooLong.StatusCode);
    }

    [Fact]
    public async Task MissingTamperedAndForeignJwtAreRejected()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me/permissions")).StatusCode);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "api-user", password = app.Password });
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        var parts = login.AccessToken.Split('.'); parts[2] = (parts[2][0] == 'A' ? "B" : "A") + parts[2][1..];
        client.DefaultRequestHeaders.Authorization = new("Bearer", string.Join('.', parts));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
        using var foreign = new AuthApiFactory(); using var foreignClient = foreign.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await foreign.PrepareAsync(); foreignClient.DefaultRequestHeaders.Authorization = new("Bearer", login.AccessToken);
        Assert.Equal(HttpStatusCode.Unauthorized, (await foreignClient.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task BusinessApiEnforcesScreenPermissionAndRevocationOnBackend()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/departments")).StatusCode);
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "api-user", password = app.Password });
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        var sub = new JwtSecurityTokenHandler().ReadJwtToken(login.AccessToken).Subject;
        Assert.Equal(login.User.UserId, sub);
        client.DefaultRequestHeaders.Authorization = new("Bearer", login.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/departments")).StatusCode);
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = new Screen { Code = "WEB_DEPARTMENTS", Name = "Departments", IsActive = true };
            db.Add(screen); await db.SaveChangesAsync();
            db.Add(new RoleDetail { RoleID = login.Roles.First().Id, ScreenID = screen.ID, CanView = "Y" });
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/departments")).StatusCode);
        var renewed = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password });
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await renewed.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/departments")).StatusCode);
        using (var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<RoleDetail>()
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.CanView, "N"));
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/departments")).StatusCode);
        renewed = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password });
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await renewed.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/departments")).StatusCode);
    }

    [Theory]
    [InlineData("issuer")] [InlineData("audience")] [InlineData("expired")] [InlineData("future")] [InlineData("unsigned")]
    public async Task JwtValidationRejectsInvalidClaimsLifetimeAndUnsignedTokens(string kind)
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        using var scope = app.Services.CreateScope();
        var id = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<User>().Select(x => x.UserId).SingleAsync();
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(kind == "issuer" ? "other" : "hrm-test", kind == "audience" ? "other" : "hrm-test-client",
            new[] { new Claim("sub", id) },
            kind == "future" ? now.AddMinutes(5) : now.AddMinutes(-10),
            kind == "expired" ? now.AddMinutes(-5) : now.AddMinutes(15),
            kind == "unsigned" ? null : new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(app.SigningKey)), SecurityAlgorithms.HmacSha256));
        client.DefaultRequestHeaders.Authorization = new("Bearer", new JwtSecurityTokenHandler().WriteToken(token));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task WrongAndUnknownCredentialsHaveSameResponseAndSixthAttemptIsLimited()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        var wrong = await client.PostAsJsonAsync("/api/auth/login", new { username = "api-user", password = "" });
        var unknown = await client.PostAsJsonAsync("/api/auth/login", new { username = "missing", password = app.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode); Assert.Equal(wrong.StatusCode, unknown.StatusCode);
        using var wrongJson = System.Text.Json.JsonDocument.Parse(await wrong.Content.ReadAsStringAsync());
        using var unknownJson = System.Text.Json.JsonDocument.Parse(await unknown.Content.ReadAsStringAsync());
        Assert.Equal(wrongJson.RootElement.GetProperty("error").GetString(), unknownJson.RootElement.GetProperty("error").GetString());
        Assert.Equal(wrongJson.RootElement.GetProperty("message").GetString(), unknownJson.RootElement.GetProperty("message").GetString());
        for (var i = 0; i < 3; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("/api/auth/login", new { username = "missing", password = app.Password })).StatusCode);
        var limited = await client.PostAsJsonAsync("/api/auth/login", new { username = "api-user", password = app.Password });
        Assert.Equal(HttpStatusCode.TooManyRequests, limited.StatusCode); Assert.NotNull(limited.Headers.RetryAfter);
    }
}

internal sealed class AuthApiFactory : WebApplicationFactory<Program>
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    public string? NotificationOrigin { get; init; }
    public string Password { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));
    public string SigningKey { get; } = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        _connection.Open();
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:DefaultConnection", "Server=localhost;Database=unused;User=unused");
        builder.UseSetting("Jwt:Issuer", "hrm-test"); builder.UseSetting("Jwt:Audience", "hrm-test-client");
        builder.UseSetting("Jwt:SigningKey", SigningKey);
        builder.UseSetting("AuthSeed:Enabled", "false");
        builder.UseSetting("Notifications:WorkerEnabled", "false");
        if (NotificationOrigin is not null) builder.UseSetting("Notifications:AllowedOrigins:0", NotificationOrigin);
        builder.ConfigureTestServices(services =>
        {
            services.AddControllers().AddApplicationPart(typeof(PermissionProbeController).Assembly);
            services.RemoveAll<AppDbContext>();
            services.AddScoped<AppDbContext>(_ => new AuthorizationTestContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).Options));
        });
    }
    public async Task PrepareAsync()
    {
        using var scope = Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureCreatedAsync();
        var c = scope.ServiceProvider.GetRequiredService<PasswordService>().Hash(Password);
        var user = new User { UserId = "api-user", Email = "api@example.invalid", Status = "ACTIVE", PasswordHash = c.PasswordHash, Salt = c.Salt };
        var role = new Role { Code = "HR", Name = "HR" }; var other = new Role { Code = "EMPLOYEE", Name = "Employee" };
        var screen = new Screen { Code = "EMPLOYEES", Name = "Employees", IsActive = true };
        db.AddRange(user, role, other, screen, new Screen { Code = "DISABLED", Name = "Disabled", IsActive = false });
        await db.SaveChangesAsync();
        db.AddRange(new UserRole { UserID = user.UserId, RoleID = role.ID }, new UserRole { UserID = user.UserId, RoleID = other.ID },
            new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = "Y" },
            new RoleDetail { RoleID = other.ID, ScreenID = screen.ID, CanUpdate = "Y" });
        await db.SaveChangesAsync();
    }
    protected override void Dispose(bool disposing) { base.Dispose(disposing); if (disposing) _connection.Dispose(); }
}

internal sealed class AuthorizationTestContext(DbContextOptions<AppDbContext> options) : AppDbContext(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        var keep = new[] { typeof(User), typeof(Role), typeof(UserRole), typeof(RoleDetail), typeof(Screen), typeof(Department), typeof(RoleScreenAction),
            typeof(HRM.API.Modules.Employees.Entities.Employee), typeof(HRM.API.Modules.System.Entities.Notification),
            typeof(HRM.API.Modules.System.Entities.AuditLog), typeof(HRM.API.Modules.Notifications.Entities.NotificationTarget),
            typeof(HRM.API.Modules.Notifications.Entities.NotificationRecipient), typeof(HRM.API.Modules.Notifications.Entities.NotificationOutbox) };
        foreach (var entity in builder.Model.GetEntityTypes().Where(x => !keep.Contains(x.ClrType)).ToArray()) builder.Ignore(entity.ClrType);
        SqliteTestModel.UseSqliteIdentityTypes(builder);
    }
}
