using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Policies;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace HRM.API.Tests;

// Explicitly registered only by the test host; these are not production business APIs.
[ApiController]
[Route("__test/permissions")]
public sealed class PermissionProbeController : ControllerBase
{
    [HttpGet] [ScreenPermission("WEB_EMPLOYEES", "VIEW")] public IActionResult ViewScreen() => Ok();
    [HttpPost("new")] [ScreenPermission("WEB_EMPLOYEES", "NEW")] public IActionResult NewItem() => Ok();
    [HttpPut] [ScreenPermission("WEB_EMPLOYEES", "UPDATE")] public IActionResult UpdateItem() => Ok();
    [HttpDelete] [ScreenPermission("WEB_EMPLOYEES", "DELETE")] public IActionResult DeleteItem() => Ok();
    [HttpPost("approve")] [ScreenPermission("WEB_EMPLOYEES", "APPROVE")] public IActionResult ApproveItem() => Ok();
    [HttpGet("export")] [ScreenPermission("WEB_EMPLOYEES", "EXPORT")] public IActionResult ExportItems() => Ok();
    [HttpGet("missing")] [ScreenPermission("UNKNOWN_SCREEN", "VIEW")] public IActionResult MissingScreen() => Ok();
}

public sealed class PermissionApiTests
{
    [Fact]
    public async Task JwtIsMandatoryAdminHasNoBypassAndLockedUserGets401()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/__test/permissions")).StatusCode);
        client.DefaultRequestHeaders.Authorization = new("Bearer", "invalid.jwt.token");
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/__test/permissions")).StatusCode);
        await Authenticate(client, app.Password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/__test/permissions")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/__test/permissions/missing")).StatusCode);
        using(var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<Role>().Where(x => x.Code == "HR").ExecuteUpdateAsync(s => s.SetProperty(x => x.Code, "ADMIN"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/__test/permissions")).StatusCode);
        using(var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<User>()
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "DISABLED"));
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/__test/permissions")).StatusCode);
    }

    [Fact]
    public async Task ViewGrantDoesNotGrantDeleteAndDeleteDoesNotRequireViewOrTrustRequestBody()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        await AddGrant(app, "HR", "VIEW"); await Authenticate(client, app.Password);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/__test/permissions")).StatusCode);
        var malicious = new HttpRequestMessage(HttpMethod.Delete, "/__test/permissions")
        {
            Content = JsonContent.Create(new { userId = "admin", role = "ADMIN", canDelete = true, permissions = new[] { "DELETE" } })
        };
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(malicious)).StatusCode);
        using(var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var screenId = await db.Set<Screen>().Where(x => x.Code == "WEB_EMPLOYEES").Select(x => x.ID).SingleAsync();
            await db.Set<RoleDetail>().Where(x => x.ScreenID == screenId)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.CanView, "N").SetProperty(x => x.CanDelete, "Y"));
        }
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/__test/permissions")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/__test/permissions")).StatusCode);
        await Authenticate(client, app.Password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/__test/permissions")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/__test/permissions")).StatusCode);
        var profile = (await client.GetFromJsonAsync<AuthProfileDto>("/api/auth/me"))!;
        Assert.DoesNotContain(profile.Permissions, p => p.Code == "WEB_EMPLOYEES");
        using(var scope = app.Services.CreateScope())
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<RoleDetail>()
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.CanDelete, "N"));
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("/__test/permissions")).StatusCode);
        await Authenticate(client, app.Password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/__test/permissions")).StatusCode);
    }

    [Theory]
    [InlineData("VIEW", "GET", "")] [InlineData("NEW", "POST", "/new")]
    [InlineData("UPDATE", "PUT", "")] [InlineData("DELETE", "DELETE", "")]
    [InlineData("APPROVE", "POST", "/approve")] [InlineData("EXPORT", "GET", "/export")]
    public async Task SecondRoleCanGrantEachActionInNewJwt(string action, string method, string suffix)
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync(); await Authenticate(client, app.Password);
        var path = "/__test/permissions" + suffix;
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path))).StatusCode);
        await AddGrant(app, "EMPLOYEE", action);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path))).StatusCode);
        await Authenticate(client, app.Password);
        Assert.Equal(HttpStatusCode.OK, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), path))).StatusCode);
    }

    private static async Task Authenticate(HttpClient client, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }
    private static async Task AddGrant(AuthApiFactory app, string roleCode, string action)
    {
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var screen = new Screen { Code = "WEB_EMPLOYEES", Name = "Employees", IsActive = true };
        db.Add(screen); await db.SaveChangesAsync();
        var roleId = await db.Set<Role>().Where(x => x.Code == roleCode).Select(x => x.ID).SingleAsync();
        var detail = new RoleDetail { RoleID = roleId, ScreenID = screen.ID };
        PermissionServiceTests.SetFlag(detail, action, "Y"); db.Add(detail); await db.SaveChangesAsync();
    }
}
