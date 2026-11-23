using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Logging;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class TerminalLoggingApiTests
{
    private const string Url = "/api/system-settings/terminal-logging";
    private static TerminalLoggingRequest Request() => new() { Enabled = "Y", Users = new() { ["api-user"] = "Y", ["system"] = "N" }, Modules = new() { ["Employees"] = "Y" } };
    private static async Task Grant(AdministrationApiTests.Fixture f)
    { await OrganizationApiTests.Grant(f.App, "WEB_SYSTEM_SETTINGS"); await OrganizationApiTests.Login(f.Client, f.App); }
    [Fact]
    public async Task SettingsRequireScreenPermissionAndNoScopeAndPublishAfterCommit()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start();
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.GetAsync(Url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PutAsJsonAsync(Url, Request())).StatusCode);
        using var anon = f.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anon.GetAsync(Url)).StatusCode);
        await Grant(f);
        var initial = await f.Client.GetAsync(Url); initial.EnsureSuccessStatusCode();
        Assert.Equal("\"0\"", initial.Headers.ETag!.ToString());
        Assert.Equal(0, (await initial.Content.ReadFromJsonAsync<SettingsView<TerminalLoggingOptions>>())!.Version);
        Assert.Equal(HttpStatusCode.PreconditionRequired, (await f.Client.PutAsJsonAsync(Url, Request())).StatusCode);
        var saved = await f.Send(HttpMethod.Put, Url, Request(), "0"); saved.EnsureSuccessStatusCode();
        Assert.Equal("\"1\"", saved.Headers.ETag!.ToString());
        var state = f.App.Services.GetRequiredService<TerminalLoggingState>();
        Assert.True(state.Current.Allows("api-user", "Employees")); Assert.False(state.Current.Allows("system", "Employees"));
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, (await db.Set<SystemSetting>().SingleAsync(x => x.Key == TerminalLoggingState.Key)).Version);
        Assert.Single(await db.Set<AuditLog>().Where(x => x.EntityID == TerminalLoggingState.Key).ToListAsync());
        Assert.False(await db.Set<HRM.API.Modules.Authorization.Entities.RoleScreenAction>().AnyAsync(a => db.Screens.Any(s => s.ID == a.ScreenID && s.Code == "WEB_SYSTEM_SETTINGS")));
        var disabled = Request(); disabled.Enabled = "N";
        Assert.Equal(HttpStatusCode.PreconditionFailed, (await f.Send(HttpMethod.Put, Url, disabled, "0")).StatusCode);
        Assert.True(state.Current.Allows("api-user", "Employees"));
        (await f.Send(HttpMethod.Put, Url, disabled, "1")).EnsureSuccessStatusCode();
        Assert.False(state.Current.Allows("api-user", "Employees"));
        var persisted = (await f.Client.GetFromJsonAsync<SettingsView<TerminalLoggingOptions>>(Url))!;
        Assert.Equal(2, persisted.Version); Assert.Equal("N", persisted.Settings.Enabled);
    }
    [Fact]
    public async Task ReplicaRefreshLoadsPersistedPolicyWithoutApiRead()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start(); await Grant(f);
        (await f.Send(HttpMethod.Put, Url, Request(), "0")).EnsureSuccessStatusCode();
        var freshState = new TerminalLoggingState(f.App.Services.GetRequiredService<Microsoft.Extensions.Options.IOptionsMonitor<TerminalLoggingOptions>>());
        Assert.False(freshState.Current.Allows("api-user", "Employees"));
        using var worker = new TerminalLoggingRefreshWorker(f.App.Services.GetRequiredService<IServiceScopeFactory>(), freshState,
            Microsoft.Extensions.Options.Options.Create(new TerminalLoggingRefreshOptions()), Microsoft.Extensions.Logging.Abstractions.NullLogger<TerminalLoggingRefreshWorker>.Instance);
        await worker.StartAsync(default);
        try
        {
            for (var attempt = 0; attempt < 100 && !freshState.Current.Allows("api-user", "Employees"); attempt++) await Task.Delay(10);
            Assert.True(freshState.Current.Allows("api-user", "Employees"));
        }
        finally { await worker.StopAsync(default); }
    }
    [Theory]
    [InlineData("flag")] [InlineData("user")] [InlineData("module")] [InlineData("duplicate")]
    public async Task InvalidRulesNeverPublishOrWrite(string problem)
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start(); await Grant(f);
        var request = Request();
        switch(problem)
        {
            case "flag": request.Enabled = "true"; break;
            case "user": request.Users["missing-user"] = "Y"; break;
            case "module": request.Modules["not-a-module"] = "Y"; break;
            case "duplicate": request.Users["API-USER"] = "Y"; break;
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Send(HttpMethod.Put, Url, request, "0")).StatusCode);
        Assert.False(f.App.Services.GetRequiredService<TerminalLoggingState>().Current.Allows("api-user", "Employees"));
        using var scope = f.App.Services.CreateScope();var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Set<SystemSetting>().AnyAsync(x => x.Key == TerminalLoggingState.Key));
    }
    [Fact]
    public async Task ModuleCatalogMatchesRuntimeAndStaleReplicaCannotUndoNewerSetting()
    {
        using var f = new AdministrationApiTests.Fixture(); await f.Start(); await Grant(f);
        var catalog = await f.Client.GetFromJsonAsync<System.Text.Json.JsonElement>(Url + "/modules");
        Assert.Contains(catalog.GetProperty("modules").EnumerateArray(), x => x.GetString() == "Employees");
        Assert.Contains(catalog.GetProperty("modules").EnumerateArray(), x => x.GetString() == "Notifications");
        var state = f.App.Services.GetRequiredService<TerminalLoggingState>(); var first = Request();
        state.Publish(first, 1); var second = Request(); second.Enabled = "N"; state.Publish(second, 2);
        state.Publish(first, 1); Assert.False(state.Current.Allows("api-user", "Employees"));
        // State owns a copy: callers cannot mutate a published policy through their DTO.
        second.Enabled = "Y"; Assert.False(state.Current.Allows("api-user", "Employees"));
    }
}
