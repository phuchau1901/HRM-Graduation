using System.Net;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class AuditLogApiTests
{
    [Fact]
    public async Task RequiresDedicatedLivePermissionForListAndDetail()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/audit-logs")).StatusCode);
        await OrganizationApiTests.Login(client, app);
        await OrganizationApiTests.Grant(app, "WEB_SYSTEM_SETTINGS");
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/audit-logs")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/audit-logs/1")).StatusCode);
        await OrganizationApiTests.Grant(app, "WEB_AUDIT_LOGS"); await OrganizationApiTests.Login(client, app);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/audit-logs")).StatusCode);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var screenId = await db.Set<Screen>().Where(x => x.Code == "WEB_AUDIT_LOGS").Select(x => x.ID).SingleAsync();
        await db.Set<RoleDetail>().Where(x => x.ScreenID == screenId).ExecuteUpdateAsync(s => s.SetProperty(x => x.CanView, "N"));
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/audit-logs")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/audit-logs/1")).StatusCode);
    }
    [Fact]
    public async Task FiltersBeforePagingUsesStableOrderAndReturnsStructuredDetail()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync(); await OrganizationApiTests.Grant(app, "WEB_AUDIT_LOGS"); await OrganizationApiTests.Login(client, app);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var at = new DateTime(2026, 11, 15, 1, 0, 0, DateTimeKind.Utc);
        var rows = Enumerable.Range(1, 3).Select(i => new AuditLog { ActorUserID = "api-user", Action = "SETTINGS_UPDATED", EntityType = "System", EntityID = "PASSWORD_POLICY", CreatedAt = at, AfterJSON = "{\"minimumLength\":12}" }).ToArray();
        db.AddRange(rows); db.Add(new AuditLog { Action = "OTHER", EntityType = "Team", EntityID = "1", CreatedAt = at.AddDays(1) }); await db.SaveChangesAsync();
        var url = "/api/audit-logs?page=2&pageSize=1&actorUserId=api-user&action=SETTINGS_UPDATED&entityType=System&entityId=PASSWORD_POLICY&search=POLICY&fromUtc=2026-11-15T00:00:00Z&toUtc=2026-11-15T02:00:00Z";
        using var list = JsonDocument.Parse(await client.GetStringAsync(url)); var root = list.RootElement;
        Assert.True(root.GetProperty("success").GetBoolean()); Assert.Equal(3, root.GetProperty("total").GetInt32());
        Assert.Equal(2, root.GetProperty("page").GetInt32()); Assert.Equal(1, root.GetProperty("pageSize").GetInt32());
        var item = Assert.Single(root.GetProperty("data").EnumerateArray()); Assert.Equal(rows[1].ID, item.GetProperty("id").GetInt64());
        Assert.False(item.TryGetProperty("afterJson", out _)); Assert.EndsWith("Z", item.GetProperty("createdAt").GetString());
        var response = await client.GetAsync($"/api/audit-logs/{rows[0].ID}"); Assert.True(response.Headers.CacheControl!.NoStore);
        using var detail = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(JsonValueKind.Null, detail.RootElement.GetProperty("beforeJson").ValueKind);
        Assert.Equal(12, detail.RootElement.GetProperty("afterJson").GetProperty("minimumLength").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/audit-logs/9223372036854775807")).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.DeleteAsync($"/api/audit-logs/{rows[0].ID}")).StatusCode);
    }
    [Theory]
    [InlineData("page=0")]
    [InlineData("pageSize=101")]
    [InlineData("page=2147483647&pageSize=100")]
    [InlineData("fromUtc=2026-11-16T00:00:00Z&toUtc=2026-11-15T00:00:00Z")]
    [InlineData("fromUtc=invalid")]
    public async Task RejectsInvalidQueries(string query)
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync(); await OrganizationApiTests.Grant(app, "WEB_AUDIT_LOGS"); await OrganizationApiTests.Login(client, app);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/audit-logs?" + query)).StatusCode);
    }
}
