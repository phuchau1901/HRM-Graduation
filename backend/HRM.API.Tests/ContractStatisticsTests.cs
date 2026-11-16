using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class ContractStatisticsTests
{
    private static readonly DateOnly Today = new(2026, 11, 16);
    private static AttendanceTestClock Clock() => new() { Now = new(2026, 11, 15, 17, 5, 0, TimeSpan.Zero) };
    private static Contract Row(int employee, string code, string status = "ACTIVE", int? end = null, int start = -10) => new()
    {
        EmployeeID = employee, ContractNo = code, ContractType = "STATS", Status = status,
        StartDate = Today.AddDays(start), EndDate = end.HasValue ? Today.AddDays(end.Value) : null
    };
    private static async Task Seed(EmployeeApiTests.Harness h, params Contract[] rows)
    {
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        if (!await db.Set<ContractType>().AnyAsync(t => t.Code == "STATS")) db.Add(new ContractType { Code = "STATS", Name = "Statistics" });
        db.AddRange(rows); await db.SaveChangesAsync();
    }
    private static async Task<ContractStatisticsDto> Read(EmployeeApiTests.Harness h, string suffix = "") =>
        (await h.Client.GetFromJsonAsync<ContractStatisticsResponse>("/api/contracts/statistics" + suffix))!.Data;

    [Fact]
    public async Task PartitionsDatesAndActualStatusesWithoutOverlapUsingVietnamDate()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: Clock());
        await Seed(h, Row(h.Self, "INDEFINITE"), Row(h.Self, "LONG", end: 31), Row(h.Self, "AT_CUTOFF", end: 30),
            Row(h.Self, "TODAY", end: 0), Row(h.Self, "OVERDUE_ACTIVE", end: -1), Row(h.Self, "EXPIRED", "EXPIRED", -1),
            Row(h.Self, "FUTURE", end: 30, start: 1), Row(h.Self, "DRAFT", "DRAFT", -1),
            Row(h.Self, "CANCELLED", "CANCELLED", -1), Row(h.Self, "TERMINATED", "TERMINATED", -1),
            Row(h.Self, "STARTS_TODAY", start: 0), Row(h.Self, "INVALID_EXPIRED_FUTURE", "EXPIRED", 10),
            Row(h.Self, "INVALID_EXPIRED_NO_END", "EXPIRED"), Row(h.Self, "UNKNOWN", "UNKNOWN", -1));
        var stats = await Read(h);
        Assert.Equal(new ContractStatisticsDto(3, 2, 2, 30, Today), stats);
        Assert.Equal(7, stats.Active + stats.ExpiringSoon + stats.Expired);
        using var json = JsonDocument.Parse(await h.Client.GetStringAsync("/api/contracts/statistics"));
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal("2026-11-16", json.RootElement.GetProperty("data").GetProperty("asOfDate").GetString());
        Assert.Contains("no-store", (await h.Client.GetAsync("/api/contracts/statistics")).Headers.CacheControl!.ToString());
    }
    [Theory]
    [InlineData(-1, 0, 0, 1)]
    [InlineData(0, 0, 1, 0)]
    [InlineData(1, 0, 1, 0)]
    [InlineData(2, 1, 0, 0)]
    public async Task OneDayWindowIncludesTodayAndTheCutoff(int end, int active, int soon, int expired)
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: Clock());
        await Seed(h, Row(h.Self, "BOUNDARY", end: end));
        Assert.Equal(new ContractStatisticsDto(active, soon, expired, 1, Today), await Read(h, "?expiringWithinDays=1"));
    }
    [Fact]
    public async Task VietnamMidnightChangesBusinessDayIndependentlyOfUtcDate()
    {
        var clock = Clock(); clock.Now = new(2026, 11, 15, 16, 59, 59, TimeSpan.Zero);
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: clock);
        await Seed(h, Row(h.Self, "MIDNIGHT", end: -1));
        var before = await Read(h); Assert.Equal(Today.AddDays(-1), before.AsOfDate); Assert.Equal(1, before.ExpiringSoon);
        clock.Now = new(2026, 11, 15, 17, 0, 0, TimeSpan.Zero);
        var after = await Read(h); Assert.Equal(Today, after.AsOfDate); Assert.Equal(1, after.Expired); Assert.Equal(0, after.ExpiringSoon);
    }
    [Fact]
    public async Task ContractWritesUseTheSameVietnamBusinessDateAsStatistics()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: Clock());
        await Seed(h);
        // SELF may read but cannot write, so grant the existing NEW action department scope.
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_CONTRACTS");
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "NEW")
                .ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "DEPARTMENT"));
        }
        var result = await h.Client.PostAsJsonAsync($"/api/employees/{h.Self}/contracts", new
        {
            contractNo = "VN_DATE", contractType = "STATS", startDate = Today, endDate = Today, status = "ACTIVE"
        });
        Assert.Equal(HttpStatusCode.Created, result.StatusCode);
        Assert.Equal(1, (await Read(h)).ExpiringSoon);
    }
    [Theory]
    [InlineData("SELF", 1)]
    [InlineData("DEPARTMENT", 2)]
    [InlineData("ALL", 3)]
    public async Task CountsUseContractViewScopeBeforeAggregation(string scope, int expected)
    {
        await using var h = await EmployeeApiTests.Harness.Create(scope, clock: Clock());
        await Seed(h, Row(h.Self, "SELF"), Row(h.Peer, "PEER"), Row(h.Other, "OTHER"));
        var result = await Read(h); Assert.Equal(expected, result.Active); Assert.Equal(0, result.Expired); Assert.Equal(0, result.ExpiringSoon);
    }
    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("366")]
    [InlineData("abc")]
    public async Task InvalidWindowReturns400(string value)
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock());
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.GetAsync("/api/contracts/statistics?expiringWithinDays=" + value)).StatusCode);
    }
    [Fact]
    public async Task EmptyVisibleSetReturnsRealZerosAndAccepts365Days()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock());
        Assert.Equal(new ContractStatisticsDto(0, 0, 0, 30, Today), await Read(h));
        Assert.Equal(new ContractStatisticsDto(0, 0, 0, 365, Today), await Read(h, "?expiringWithinDays=365"));
    }
    [Fact]
    public async Task RequiresJwtContractViewAndLiveDataScope()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock());
        h.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/contracts/statistics")).StatusCode);
        await OrganizationApiTests.Login(h.Client, h.App);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_CONTRACTS");
            await db.Set<RoleScreenAction>().Where(a => a.ScreenID == screen.ID && a.ActionCode == "VIEW").ExecuteDeleteAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/contracts/statistics")).StatusCode);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.RoleDetails.ExecuteUpdateAsync(s => s.SetProperty(d => d.CanView, "N"));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/contracts/statistics")).StatusCode);
    }
    [Fact]
    public async Task MultipleRolesBroadenOnlyThroughRolesGrantingContractViewAndDoNotDuplicateRows()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: Clock());
        await Seed(h, Row(h.Self, "SELF"), Row(h.Peer, "PEER"), Row(h.Other, "OTHER"));
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_CONTRACTS");
            var original = await db.Set<RoleScreenAction>().SingleAsync(g => g.ScreenID == screen.ID && g.ActionCode == "VIEW");
            var otherRole = await db.Set<Role>().FirstAsync(r => r.ID != original.RoleID);
            db.Add(new RoleDetail { RoleID = otherRole.ID, ScreenID = screen.ID, CanView = "N" });
            db.Add(new RoleScreenAction { RoleID = otherRole.ID, ScreenID = screen.ID, ActionCode = "VIEW", DataScope = "ALL" });
            await db.SaveChangesAsync();
        }
        Assert.Equal(1, (await Read(h)).Active);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.RoleDetails.Where(d => d.CanView == "N").ExecuteUpdateAsync(s => s.SetProperty(d => d.CanView, "Y"));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Equal(3, (await Read(h)).Active);
    }
    [Fact]
    public async Task UnlinkedSelfGetsZeroWithoutImplicitAdminAccess()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: Clock()); await Seed(h, Row(h.Self, "SELF"));
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<User>().Where(u => u.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(u => u.EmployeeId, (int?)null));
        }
        Assert.Equal(0, (await Read(h)).Active);
    }
    [Fact]
    public async Task UsesOneContractAggregateRegardlessOfContractCount()
    {
        var queries = new EmployeeReadQueries();
        await using var h = await EmployeeApiTests.Harness.Create("ALL", queries: queries, clock: Clock());
        await Seed(h, Row(h.Self, "ONE")); queries.Commands.Clear(); await Read(h);
        var first = queries.Commands.Count;
        var aggregate = Assert.Single(queries.Commands, s => s.Contains("\"contracts\""));
        Assert.Contains("COUNT", aggregate, StringComparison.OrdinalIgnoreCase); Assert.DoesNotContain("contract_no", aggregate);
        await Seed(h, Enumerable.Range(0, 30).Select(i => Row(h.Peer, "MANY" + i)).ToArray());
        queries.Commands.Clear(); Assert.Equal(31, (await Read(h)).Active); Assert.Equal(first, queries.Commands.Count);
    }
    [Fact]
    public void AggregateTranslatesForMySqlWithoutDatabaseAccess()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var sql = ContractStatisticsService.Aggregate(db.Set<Contract>().AsNoTracking(), Today, Today.AddDays(30)).ToQueryString();
        Assert.Contains("COUNT", sql, StringComparison.OrdinalIgnoreCase); Assert.Contains("GROUP BY", sql, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("contract_no", sql);
    }
}
