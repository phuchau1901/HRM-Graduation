using System.Collections.Concurrent;
using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

internal sealed class EmployeeReadQueries : DbCommandInterceptor
{
    public ConcurrentQueue<string> Commands { get; } = new();
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData data,
        InterceptionResult<DbDataReader> result, CancellationToken ct = default)
    { Commands.Enqueue(command.CommandText); return ValueTask.FromResult(result); }
}
public sealed class EmployeeReadApiTests
{
    private static async Task AssignCatalogs(EmployeeApiTests.Harness h)
    {
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        var team = new Team { TeamCode = "READ", TeamName = "Backend Team", DepartmentId = h.Department };
        var position = new Position { Code = "READ", Name = "Backend Position", IsActive = true }; db.AddRange(team, position); await db.SaveChangesAsync();
        await db.Employees.Where(x => x.Id == h.Self).ExecuteUpdateAsync(x => x.SetProperty(e => e.TeamId, team.Id).SetProperty(e => e.PositionId, position.ID));
    }
    [Fact]
    public async Task ListAndDetailReturnCatalogNamesWithExistingFieldsAndNullableAssignments()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await AssignCatalogs(h);
        var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees"))!;
        Assert.True(page.Success); Assert.Equal(3, page.Total); Assert.Equal(1, page.Page); Assert.Equal(30, page.PageSize);
        var self = Assert.Single(page.Data, x => x.Id == h.Self);
        Assert.Equal("First", self.DepartmentName); Assert.Equal("Backend Team", self.TeamName); Assert.Equal("Backend Position", self.PositionName);
        Assert.NotNull(self.TeamId); Assert.NotNull(self.PositionId); Assert.Equal("E1", self.EmployeeCode); Assert.Equal("ACTIVE", self.EmploymentStatus);
        var detail = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!; Assert.Equal(self, detail);
        var peer = Assert.Single(page.Data, x => x.Id == h.Peer); Assert.Equal("First", peer.DepartmentName);
        Assert.Null(peer.TeamId); Assert.Null(peer.TeamName); Assert.Null(peer.PositionId); Assert.Null(peer.PositionName);
        using var json = JsonDocument.Parse(await h.Client.GetStringAsync($"/api/employees/{h.Peer}"));
        foreach (var name in new[] { "id", "employeeCode", "fullName", "email", "departmentId", "departmentName", "teamId", "teamName", "positionId", "positionName", "employmentStatus", "dateOfBirth", "phoneNumber", "hireDate", "createdAt" })
            Assert.True(json.RootElement.TryGetProperty(name, out _), name);
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("positionName").ValueKind);
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("teamName").ValueKind);
    }
    [Fact]
    public async Task LeftJoinKeepsLegacyRowWhenDepartmentReferenceIsMissing()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            // Test-only simulation of legacy data before FK enforcement. Production FK/configuration stays unchanged.
            await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys=OFF;");
            try { await db.Employees.Where(x => x.Id == h.Peer).ExecuteUpdateAsync(x => x.SetProperty(e => e.DepartmentId, int.MaxValue)); }
            finally { await db.Database.ExecuteSqlRawAsync("PRAGMA foreign_keys=ON;"); }
        }
        var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees"))!;
        Assert.Equal(3, page.Total); Assert.Equal(3, page.Data.Count);
        Assert.Null(Assert.Single(page.Data, x => x.Id == h.Peer).DepartmentName);
        var detail = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Peer}"))!;
        Assert.Equal(int.MaxValue, detail.DepartmentId); Assert.Null(detail.DepartmentName);
    }

    [Fact]
    public async Task InactiveCatalogNamesRemainVisibleAndUnlinkedEndpointUsesSameProjection()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await AssignCatalogs(h);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<Department>().Where(x => x.Id == h.Department).ExecuteUpdateAsync(x => x.SetProperty(d => d.IsActive, false));
            await db.Set<Team>().ExecuteUpdateAsync(x => x.SetProperty(t => t.IsActive, false));
            await db.Set<Position>().ExecuteUpdateAsync(x => x.SetProperty(p => p.IsActive, false));
        }
        var detail = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!;
        Assert.Equal("First", detail.DepartmentName); Assert.Equal("Backend Team", detail.TeamName); Assert.Equal("Backend Position", detail.PositionName);
        var unlinked = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees/unlinked"))!;
        Assert.Equal(2, unlinked.Total); Assert.All(unlinked.Data, x => Assert.NotNull(x.DepartmentName));
    }
    [Theory]
    [InlineData("SELF", 1)]
    [InlineData("DEPARTMENT", 2)]
    [InlineData("ALL", 3)]
    public async Task ScopeFiltersBeforeCountAndPaginationWithStableOrder(string scope, int total)
    {
        await using var h = await EmployeeApiTests.Harness.Create(scope); await AssignCatalogs(h);
        var first = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees?pageSize=1&page=1"))!;
        Assert.Equal(total, first.Total); Assert.Equal(h.Self, Assert.Single(first.Data).Id);
        var second = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees?pageSize=1&page=2"))!;
        Assert.Equal(total, second.Total);
        if (total == 1) Assert.Empty(second.Data); else Assert.Equal(h.Peer, Assert.Single(second.Data).Id);
        var filtered = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>($"/api/employees?departmentId={h.OtherDepartment}&pageSize=1"))!;
        Assert.Equal(scope == "ALL" ? 1 : 0, filtered.Total);
        var searched = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees?search=E2&employmentStatus=ACTIVE"))!;
        Assert.Equal(scope == "SELF" ? 0 : 1, searched.Total);
        Assert.Equal(scope == "ALL" ? HttpStatusCode.OK : HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/employees/{h.Other}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync("/api/employees/2147483647")).StatusCode);
    }
    [Fact]
    public async Task BothReadEndpointsRequireJwtViewGrantAndValidScope()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        h.Client.DefaultRequestHeaders.Authorization = null;
        foreach (var path in new[] { "/api/employees", $"/api/employees/{h.Self}" }) Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync(path)).StatusCode);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_EMPLOYEES");
            await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(d => d.CanView, "N"));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        foreach (var path in new[] { "/api/employees", $"/api/employees/{h.Self}" }) Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(path)).StatusCode);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.RoleDetails.ExecuteUpdateAsync(x => x.SetProperty(d => d.CanView, "Y"));
            await db.Set<RoleScreenAction>().ExecuteUpdateAsync(x => x.SetProperty(action => action.DataScope, (string?)null));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        foreach (var path in new[] { "/api/employees", $"/api/employees/{h.Self}" }) Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(path)).StatusCode);
    }
    [Fact]
    public async Task ProjectionUsesOneJoinedReadRegardlessOfPageSizeAndDoesNotTrackCatalogs()
    {
        var queries = new EmployeeReadQueries(); await using var h = await EmployeeApiTests.Harness.Create("ALL", queries: queries); await AssignCatalogs(h);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AddRange(Enumerable.Range(0, 15).Select(i => new Employee { EmployeeCode = $"PAGE-{i}", FullName = $"Person {i}", Email = $"person-{i}@example.invalid", DepartmentId = h.Department, HireDate = new(2020, 1, 1) })); await db.SaveChangesAsync();
        }
        async Task<string[]> Read(int size)
        {
            queries.Commands.Clear();
            var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>($"/api/employees?pageSize={size}"))!;
            Assert.Equal(size, page.Data.Count); return queries.Commands.ToArray();
        }
        var small = await Read(1); var large = await Read(18); Assert.Equal(small.Length, large.Length);
        static bool Joined(string sql) => sql.Contains("LEFT JOIN \"departments\"") && sql.Contains("LEFT JOIN \"teams\"") && sql.Contains("LEFT JOIN \"positions\"");
        Assert.Single(small, Joined); Assert.Single(large, Joined);
        Assert.Single(large, sql => sql.Contains("COUNT(*)") && sql.Contains("\"employees\""));
        using var check = h.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>(); var service = check.ServiceProvider.GetRequiredService<EmployeeService>();
        queries.Commands.Clear(); await service.GetAsync("api-user", h.Self, default);
        Assert.Single(queries.Commands, Joined);
        Assert.Empty(context.ChangeTracker.Entries<Employee>()); Assert.Empty(context.ChangeTracker.Entries<Department>()); Assert.Empty(context.ChangeTracker.Entries<Team>()); Assert.Empty(context.ChangeTracker.Entries<Position>());
    }
    [Fact]
    public async Task CreateAndUpdateReturnSameNamesWithoutRequiringSeparateViewCatalogGrants()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await AssignCatalogs(h);
        var source = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!;
        var response = await h.Client.PostAsJsonAsync("/api/employees", new { fullName = "New", email = "new-read@example.invalid", hireDate = "2020-01-01", departmentId = h.Department, teamId = source.TeamId, positionId = source.PositionId });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode); var created = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(source.DepartmentName, created.DepartmentName); Assert.Equal(source.TeamName, created.TeamName); Assert.Equal(source.PositionName, created.PositionName);
        var updated = await h.Client.PutAsJsonAsync($"/api/employees/{created.Id}", new { fullName = "Updated", email = created.Email, positionId = source.PositionId, teamId = source.TeamId, employmentStatus = "ACTIVE" });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode); Assert.Equal(source.PositionName, (await updated.Content.ReadFromJsonAsync<EmployeeDto>())!.PositionName);
    }
}
