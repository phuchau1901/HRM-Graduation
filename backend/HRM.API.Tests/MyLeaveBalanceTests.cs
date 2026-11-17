using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class MyLeaveBalanceTests
{
    private static async Task<MyBalanceSummary> Get(Fixture f, string query = "")
    {
        var json = await f.H.Client.GetFromJsonAsync<JsonElement>("/api/leave-balances/me" + query);
        Assert.True(json.GetProperty("success").GetBoolean());
        return json.GetProperty("data").Deserialize<MyBalanceSummary>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
    }
    [Fact]
    public async Task CurrentBalanceOnlyIncludesSignedInEmployeeEvenWithAllScope()
    {
        await using var f = await Fixture.Create();
        (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Other, leaveTypeId = f.TypeId, year = 2026, entitledDays = 99, version = 0 })).EnsureSuccessStatusCode();
        var balance = await f.Balance();
        (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 10, carriedOverDays = 2, version = balance.Version, reason = "Approved transfer" })).EnsureSuccessStatusCode();
        var request = await f.Submit();
        var mine = await Get(f, "?employeeId=" + f.H.Other); Assert.Equal(f.H.Self, mine.EmployeeId); Assert.Equal(12, mine.TotalDays); Assert.Equal(0, mine.UsedDays); Assert.Equal(12, mine.RemainingDays); Assert.Equal(2, mine.ReservedDays); Assert.Equal(10, mine.AvailableDays);
        Assert.Equal(f.H.Self, Assert.Single(mine.Balances).EmployeeId);
        await f.ApproveAll(request.ApprovalId);
        mine = await Get(f); Assert.Equal(2, mine.UsedDays); Assert.Equal(10, mine.RemainingDays); Assert.Equal(10, mine.AvailableDays);
    }
    [Fact]
    public async Task SupportsYearAndLeaveTypeAndReturnsRealEmptyTotals()
    {
        await using var f = await Fixture.Create();
        var mine = await Get(f, "?year=2026&leaveTypeId=" + f.TypeId); Assert.Equal(10, mine.TotalDays);
        mine = await Get(f, "?year=2028"); Assert.Empty(mine.Balances); Assert.Equal(0, mine.TotalDays); Assert.Equal(0, mine.AvailableDays);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.GetAsync("/api/leave-balances/me?year=0")).StatusCode);
    }
    [Fact]
    public async Task DefaultYearUsesVietnamBusinessDateAndMissingEmployeeLinkIsForbidden()
    {
        await using var f = await Fixture.Create();
        (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2027, entitledDays = 5, version = 0 })).EnsureSuccessStatusCode();
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now = new(2026, 12, 31, 18, 0, 0, TimeSpan.Zero);
        var mine = await Get(f); Assert.Equal(2027, mine.Year); Assert.Equal(new DateOnly(2027, 1, 1), mine.AsOfDate); Assert.Equal(5, mine.TotalDays);
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<User>().Where(u => u.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(u => u.EmployeeId, (int?)null));
        var response = await f.H.Client.GetAsync("/api/leave-balances/me"); Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var failure = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("HRM_AUTH_006", failure.GetProperty("code").GetString());
        Assert.Equal("EMPLOYEE_LINK_REQUIRED", failure.GetProperty("error").GetString());
    }
    [Theory]
    [InlineData(null)]
    [InlineData("SELF")]
    [InlineData("DEPARTMENT")]
    [InlineData("ALL")]
    [InlineData("INVALID")]
    public async Task MeIgnoresDataScopeButStillRequiresLiveViewPermission(string? dataScope)
    {
        await using var f = await Fixture.Create();
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_LEAVE_BALANCES");
            var grants = db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "VIEW");
            if (dataScope == null) await grants.ExecuteDeleteAsync();
            else await grants.ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, dataScope));
        }
        var mine = await Get(f, "?employeeId=" + f.H.Other); Assert.Equal(f.H.Self, mine.EmployeeId); Assert.Equal(10, mine.TotalDays);
        Assert.All(mine.Balances, b => Assert.Equal(f.H.Self, b.EmployeeId));
        if (dataScope == null) Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.GetAsync("/api/leave-balances")).StatusCode);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_LEAVE_BALANCES");
            await db.Set<RoleDetail>().Where(d => d.ScreenID == screen.ID).ExecuteUpdateAsync(s => s.SetProperty(d => d.CanView, "N"));
        }
        var response = await f.H.Client.GetAsync("/api/leave-balances/me"); Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        var failure = await response.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("HRM_AUTH_003", failure.GetProperty("code").GetString());
        Assert.Equal("PERMISSION_DENIED", failure.GetProperty("error").GetString());
    }

}
