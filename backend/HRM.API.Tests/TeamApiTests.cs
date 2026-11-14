using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.Organization.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class TeamApiTests
{
    private static EmployeeProfileRequest Profile(int? teamId) => new() { FullName = "Employee", Email = "employee-update@example.invalid", TeamId = teamId };
    private static EmployeeCreateRequest NewEmployee(int departmentId, int? teamId) => new()
    { EmployeeCode = "TEAM-NEW", FullName = "New employee", Email = "team-new@example.invalid", HireDate = new(2020, 1, 1), DepartmentId = departmentId, TeamId = teamId };
    private static async Task<Team> AddTeam(EmployeeApiTests.Harness h, int departmentId, string code = "T1", bool active = true)
    {
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        var team = new Team { TeamCode = code, TeamName = "Team " + code, DepartmentId = departmentId, IsActive = active };
        db.Add(team); await db.SaveChangesAsync(); return team;
    }
    [Fact]
    public async Task CrudValidatesDepartmentCodesPagingAndReferencedDeletion()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        await OrganizationApiTests.Grant(h.App, "WEB_TEAMS"); await OrganizationApiTests.Grant(h.App, "WEB_DEPARTMENTS");
        await OrganizationApiTests.Login(h.Client, h.App);
        object Body(int departmentId, string code = "test", bool active = true) => new { departmentId, teamCode = code, teamName = "Test team", isActive = active };
        var response = await h.Client.PostAsJsonAsync("/api/teams", Body(h.Department));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var team = (await response.Content.ReadFromJsonAsync<TeamDto>())!;
        Assert.Equal("TEST", team.TeamCode); Assert.Equal("First", team.DepartmentName);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.GetAsync(response.Headers.Location)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync("/api/teams", Body(h.OtherDepartment, "TEST"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/teams", Body(int.MaxValue, "MISSING"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/teams", new { })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/teams", new { teamCode = "SPACE", teamName = "   ", departmentId = h.Department })).StatusCode);
        var inactiveDept = new Department { DepartmentCode = "INACTIVE", DepartmentName = "Inactive", IsActive = false };
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); db.Add(inactiveDept); await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/teams", Body(inactiveDept.Id, "BAD"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"/api/teams/{team.Id}", Body(h.OtherDepartment))).StatusCode);
        var page = (await h.Client.GetFromJsonAsync<PageResult<TeamDto>>($"/api/teams?departmentId={h.Department}&search=TEST&pageSize=1&isActive=true"))!;
        Assert.Equal(1, page.Total); Assert.Single(page.Data);
        Assert.Empty((await h.Client.GetFromJsonAsync<PageResult<TeamDto>>($"/api/teams?departmentId={h.OtherDepartment}"))!.Data);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.GetAsync("/api/teams?pageSize=101")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.DeleteAsync($"/api/departments/{h.Department}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", Profile(team.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.DeleteAsync($"/api/teams/{team.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/teams/{team.Id}", Body(h.Department, active: false))).StatusCode);
        Assert.False((await h.Client.GetFromJsonAsync<TeamDto>($"/api/teams/{team.Id}"))!.IsActive);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/employees", NewEmployee(h.Department, team.Id))).StatusCode);
        // Existing assignments survive deactivation and old clients omitting teamId.
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", new { fullName = "Kept", email = "kept@example.invalid", employmentStatus = "ACTIVE" })).StatusCode);
        Assert.Equal(team.Id, (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Peer}"))!.TeamId);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", Profile(null))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.DeleteAsync($"/api/teams/{team.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/teams/{team.Id}")).StatusCode);
    }
    [Fact]
    public async Task EveryTeamEndpointRequiresItsOwnGrantAndNeverGrantsEmployeeAccess()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF");
        var team = await AddTeam(h, h.OtherDepartment);
        var url = $"/api/teams/{team.Id}";
        var body = new { teamCode = "T1", teamName = "Team", departmentId = h.OtherDepartment };
        h.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/teams")).StatusCode);
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/teams")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/teams", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PutAsJsonAsync(url, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.DeleteAsync(url)).StatusCode);
        await OrganizationApiTests.Grant(h.App, "WEB_TEAMS");
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var id = await db.Screens.Where(x => x.Code == "WEB_TEAMS").Select(x => x.ID).SingleAsync();
            await db.RoleDetails.Where(x => x.ScreenID == id).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanNew, "N").SetProperty(r => r.CanUpdate, "N").SetProperty(r => r.CanDelete, "N"));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/teams", body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PutAsJsonAsync(url, body)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.DeleteAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/employees/{h.Other}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Profile(team.Id))).StatusCode);
    }
    [Fact]
    public async Task EmployeeCreateUpdateReadAndDepartmentTransferKeepTeamConsistentAndAuditChanges()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        var team = await AddTeam(h, h.Department); var other = await AddTeam(h, h.OtherDepartment, "T2");
        var inactive = await AddTeam(h, h.Department, "OLD", false);
        foreach (var invalid in new[] { other.Id, inactive.Id, int.MaxValue, 0 })
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/employees", NewEmployee(h.Department, invalid))).StatusCode);
            Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", Profile(invalid))).StatusCode);
        }
        var createdResponse = await h.Client.PostAsJsonAsync("/api/employees", NewEmployee(h.Department, team.Id));
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var employee = (await createdResponse.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(team.Id, employee.TeamId); Assert.Equal(team.TeamName, employee.TeamName);
        var detail = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{employee.Id}"))!;
        Assert.Equal(team.TeamName, detail.TeamName);
        var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>($"/api/employees/unlinked?teamId={team.Id}"))!;
        Assert.Equal(team.TeamName, Assert.Single(page.Data).TeamName);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", Profile(team.Id))).StatusCode);
        object Transfer(int department, int? targetTeam) => new { departmentId = department, teamId = targetTeam, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), reason = "Transfer" };
        var transferUrl = $"/api/employees/{h.Peer}/department";
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PatchAsJsonAsync(transferUrl, Transfer(h.OtherDepartment, team.Id))).StatusCode);
        Assert.Equal(team.Id, (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Peer}"))!.TeamId);
        var transfer = await h.Client.PatchAsJsonAsync(transferUrl, Transfer(h.OtherDepartment, other.Id));
        Assert.Equal(HttpStatusCode.OK, transfer.StatusCode);
        var moved = (await transfer.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(other.Id, moved.TeamId); Assert.Equal(other.TeamName, moved.TeamName);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PatchAsJsonAsync(transferUrl, new { departmentId = h.Department, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), reason = "Legacy transfer" })).StatusCode);
        Assert.Null((await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Peer}"))!.TeamId);
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        var audit = await db.Set<AuditLog>().Where(x => x.Action == "EMPLOYEE_TEAM_CHANGED").OrderBy(x => x.ID).ToListAsync();
        Assert.Equal(3, audit.Count);
        using var before = JsonDocument.Parse(audit[1].BeforeJSON!); using var after = JsonDocument.Parse(audit[1].AfterJSON!);
        Assert.Equal(team.Id, before.RootElement.GetProperty("teamId").GetInt32());
        Assert.Equal(other.Id, after.RootElement.GetProperty("teamId").GetInt32());
        Assert.All(audit, x => Assert.Equal("api-user", x.ActorUserID));
    }
    [Fact]
    public async Task CompositeForeignKeyRejectsCrossDepartmentAndUnknownTeamsOutsideApi()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        var other = await AddTeam(h, h.OtherDepartment);
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        var employee = await db.Employees.SingleAsync(x => x.Id == h.Peer);
        employee.TeamId = other.Id;
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear(); employee = await db.Employees.SingleAsync(x => x.Id == h.Peer);
        employee.TeamId = int.MaxValue;
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
        db.ChangeTracker.Clear(); employee = await db.Employees.SingleAsync(x => x.Id == h.Peer);
        employee.TeamId = null; await db.SaveChangesAsync();
    }
    [Fact]
    public async Task TeamChangeAuditRollsBackWhenNotificationFails()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", failNotification: true);
        var team = await AddTeam(h, h.Department);
        Assert.Equal(HttpStatusCode.InternalServerError, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Profile(team.Id))).StatusCode);
        Assert.Null((await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!.TeamId);
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Set<AuditLog>().AnyAsync(x => x.Action == "EMPLOYEE_TEAM_CHANGED"));
    }
    [Fact]
    public async Task DepartmentScopeCannotUseTeamToReadOrWriteAcrossDepartments()
    {
        await using var h = await EmployeeApiTests.Harness.Create("DEPARTMENT");
        var other = await AddTeam(h, h.OtherDepartment);
        Assert.Empty((await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>($"/api/employees?teamId={other.Id}"))!.Data);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Other}", Profile(other.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", Profile(other.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PatchAsJsonAsync($"/api/employees/{h.Peer}/department", new { departmentId = h.OtherDepartment, teamId = other.Id, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), reason = "Cross scope" })).StatusCode);
    }
}
