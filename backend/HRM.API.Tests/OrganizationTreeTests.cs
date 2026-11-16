using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Data;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class OrganizationTreeTests
{
    private static async Task<int> Setup(EmployeeApiTests.Harness h)
    {
        await OrganizationApiTests.Grant(h.App, "WEB_DEPARTMENTS");
        await OrganizationApiTests.Grant(h.App, "WEB_TEAMS");
        await OrganizationApiTests.Grant(h.App, "WEB_ORGANIZATION");
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var employeeScreen = await db.Screens.SingleAsync(x => x.Code == "WEB_EMPLOYEES");
        var employeeScope = await db.Set<RoleScreenAction>().SingleAsync(x => x.ScreenID == employeeScreen.ID && x.ActionCode == "VIEW");
        var organizationScreen = await db.Screens.SingleAsync(x => x.Code == "WEB_ORGANIZATION");
        db.Add(new RoleScreenAction { RoleID = employeeScope.RoleID, ScreenID = organizationScreen.ID, ActionCode = "VIEW", DataScope = employeeScope.DataScope });
        var team = new Team { TeamCode = "TREE", TeamName = "Tree team", DepartmentId = h.Department };
        db.Add(team); await db.SaveChangesAsync();
        await db.Employees.Where(e => e.Id == h.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.TeamId, team.Id));
        team.LeadEmployeeId = h.Self;
        (await db.Departments.FindAsync(h.Department))!.ManagerEmployeeId = h.Peer;
        db.Add(new Department { DepartmentCode = "EMPTY", DepartmentName = "Empty" });
        await db.SaveChangesAsync(); await OrganizationApiTests.Login(h.Client, h.App); return team.Id;
    }
    [Theory]
    [InlineData("SELF", 1, 1, 0)]
    [InlineData("DEPARTMENT", 1, 2, 1)]
    [InlineData("ALL", 3, 2, 1)]
    public async Task TreeAndMembersRespectScope(string scope, int departments, int count, int unassigned)
    {
        await using var h = await EmployeeApiTests.Harness.Create(scope); var teamId = await Setup(h);
        var tree = (await h.Client.GetFromJsonAsync<List<OrganizationDepartment>>("/api/organization/tree"))!;
        Assert.Equal(departments, tree.Count);
        var department = Assert.Single(tree, d => d.Id == h.Department);
        Assert.Equal(count, department.EmployeeCount); Assert.Equal(unassigned, department.UnassignedCount);
        Assert.Equal(1, department.TeamCount); Assert.Equal(h.Self, Assert.Single(department.Teams).Lead!.Id);
        if (scope == "SELF") Assert.Null(department.Manager); else Assert.Equal(h.Peer, department.Manager!.Id);
        var members = (await h.Client.GetFromJsonAsync<PageResult<OrganizationMember>>($"/api/teams/{teamId}/members?pageSize=1"))!;
        Assert.Equal(1, members.Total); Assert.Equal(h.Self, Assert.Single(members.Data).Id);
        Assert.Empty((await h.Client.GetFromJsonAsync<PageResult<OrganizationMember>>($"/api/teams/{teamId}/members?pageSize=1&page=2"))!.Data);
        var loose = (await h.Client.GetFromJsonAsync<PageResult<OrganizationMember>>($"/api/departments/{h.Department}/unassigned-members"))!;
        Assert.Equal(unassigned, loose.Total);
        Assert.Equal(scope == "ALL" ? HttpStatusCode.OK : HttpStatusCode.NotFound,
            (await h.Client.GetAsync($"/api/departments/{h.OtherDepartment}/unassigned-members")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.GetAsync($"/api/teams/{teamId}/members?pageSize=101")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync("/api/teams/2147483647/members")).StatusCode);
    }
    [Fact]
    public async Task OrganizationViewAloneAllowsTreeAndBothMemberEndpoints()
    {
        await using var h = await EmployeeApiTests.Harness.Create("DEPARTMENT"); var teamId = await Setup(h);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var organizationId = await db.Screens.Where(x => x.Code == "WEB_ORGANIZATION").Select(x => x.ID).SingleAsync();
            await db.RoleDetails.Where(x => x.ScreenID != organizationId).ExecuteDeleteAsync();
            await db.Set<RoleScreenAction>().Where(x => x.ScreenID != organizationId).ExecuteDeleteAsync();
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        (await h.Client.GetAsync("/api/organization/tree")).EnsureSuccessStatusCode();
        (await h.Client.GetAsync($"/api/teams/{teamId}/members")).EnsureSuccessStatusCode();
        (await h.Client.GetAsync($"/api/departments/{h.Department}/unassigned-members")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/employees/{h.Self}")).StatusCode);
    }
    [Fact]
    public async Task TreeRequiresViewButMissingScopeDefaultsToSelf()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/organization/tree")).StatusCode);
        await Setup(h);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Set<HRM.API.Modules.Authorization.Entities.RoleScreenAction>().ExecuteDeleteAsync();
        var tree = (await h.Client.GetFromJsonAsync<List<OrganizationDepartment>>("/api/organization/tree"))!;
        var department = Assert.Single(tree);
        Assert.Equal(h.Department, department.Id); Assert.Equal(1, department.EmployeeCount);
        Assert.Null(department.Manager); Assert.Equal(h.Self, Assert.Single(department.Teams).Lead!.Id);
        // Other endpoints retain their existing explicit scope requirement.
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/teams/{department.Teams[0].Id}/members")).StatusCode);
        await db.Set<User>().Where(x => x.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(x => x.EmployeeId, (int?)null));
        Assert.Empty((await h.Client.GetFromJsonAsync<List<OrganizationDepartment>>("/api/organization/tree"))!);
        h.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/organization/tree")).StatusCode);
    }
    [Fact]
    public async Task ManagerAndLeadMustBelongToTheirGroupAndLeadCannotBeReassigned()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); var teamId = await Setup(h);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync($"/api/departments/{h.Department}",
            new { departmentCode = "D1", departmentName = "First", managerEmployeeId = h.Other })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync($"/api/teams/{teamId}",
            new { teamCode = "TREE", teamName = "Tree team", departmentId = h.Department, leadEmployeeId = h.Peer })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}",
            new { fullName = "Employee 1", email = "employee-1@example.invalid", teamId = (int?)null, employmentStatus = "ACTIVE" })).StatusCode);
    }
    [Fact]
    public async Task InvisibleTeamsReturn404AndOmittedAssignmentsArePreserved()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF"); var teamId = await Setup(h);
        int hiddenId;
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var hidden = new Team { TeamCode = "HIDDEN", TeamName = "Hidden team", DepartmentId = h.OtherDepartment };
            db.Add(hidden); await db.SaveChangesAsync(); hiddenId = hidden.Id;
        }
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/teams/{hiddenId}/members")).StatusCode);
        var treeJson = await h.Client.GetStringAsync("/api/organization/tree");
        Assert.DoesNotContain("Hidden team", treeJson); Assert.DoesNotContain("Employee 2", treeJson); Assert.DoesNotContain("E2", treeJson);
        var members = (await h.Client.GetFromJsonAsync<PageResult<OrganizationMember>>($"/api/teams/{teamId}/members"))!;
        Assert.Equal(20, members.PageSize);
        var payload = new { teamCode = "TREE", teamName = "Renamed", departmentId = h.Department };
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/teams/{teamId}", payload)).StatusCode);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(h.Self, (await db.Teams.FindAsync(teamId))!.LeadEmployeeId);
        }
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/teams/{teamId}",
            new { teamCode = "TREE", teamName = "Renamed", departmentId = h.Department, leadEmployeeId = (int?)null })).StatusCode);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.Null((await db.Teams.FindAsync(teamId))!.LeadEmployeeId);
        }
    }
    [Fact]
    public async Task TreeQueryCountDoesNotGrowWithDepartmentsAndDoesNotSelectEmployeeDetails()
    {
        var queries = new EmployeeReadQueries();
        await using var h = await EmployeeApiTests.Harness.Create("ALL", queries: queries); await Setup(h);
        queries.Commands.Clear();
        (await h.Client.GetAsync("/api/organization/tree")).EnsureSuccessStatusCode();
        var baseline = queries.Commands.Count;
        Assert.DoesNotContain(queries.Commands, sql => sql.Contains("\"Email\"") || sql.Contains("\"PhoneNumber\""));
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            for (var i = 0; i < 10; i++) db.Add(new Department { DepartmentCode = "N" + i, DepartmentName = "Extra" + i });
            await db.SaveChangesAsync();
        }
        queries.Commands.Clear(); (await h.Client.GetAsync("/api/organization/tree")).EnsureSuccessStatusCode();
        Assert.Equal(baseline, queries.Commands.Count);
    }
}
