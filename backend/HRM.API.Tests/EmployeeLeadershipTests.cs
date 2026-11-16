using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class EmployeeLeadershipTests
{
    private static Dictionary<string, object?> Payload(bool? manager = null, bool? lead = null) => new()
    {
        ["fullName"] = "Employee 1", ["email"] = "employee-1@example.invalid", ["employmentStatus"] = "ACTIVE",
        ["isDepartmentManager"] = manager, ["isTeamLead"] = lead
    };
    private static async Task<int> Setup(EmployeeApiTests.Harness h, bool grants = true)
    {
        if (grants) { await OrganizationApiTests.Grant(h.App, "WEB_DEPARTMENTS"); await OrganizationApiTests.Grant(h.App, "WEB_TEAMS"); }
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var team = new Team { TeamCode = "LEADERS", TeamName = "Leaders", DepartmentId = h.Department };
        db.Add(team); await db.SaveChangesAsync();
        await db.Employees.Where(e => e.Id == h.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.TeamId, team.Id));
        await OrganizationApiTests.Login(h.Client, h.App); return team.Id;
    }
    [Theory]
    [InlineData("ALL")]
    [InlineData("DEPARTMENT")]
    public async Task AssignReadPreserveAndRemoveBothRolesWithAudit(string dataScope)
    {
        await using var h = await EmployeeApiTests.Harness.Create(dataScope); var teamId = await Setup(h);
        var response = await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Payload(true, true));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var employee = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.True(employee.IsDepartmentManager); Assert.True(employee.IsTeamLead);
        var read = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!;
        Assert.True(read.IsDepartmentManager); Assert.True(read.IsTeamLead);
        var omitted = Payload(); omitted.Remove("isDepartmentManager"); omitted.Remove("isTeamLead");
        var unchanged = await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", omitted); unchanged.EnsureSuccessStatusCode();
        Assert.True((await unchanged.Content.ReadFromJsonAsync<EmployeeDto>())!.IsTeamLead);
        var removed = await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Payload(false, false)); removed.EnsureSuccessStatusCode();
        employee = (await removed.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.False(employee.IsDepartmentManager); Assert.False(employee.IsTeamLead);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Null((await db.Departments.FindAsync(h.Department))!.ManagerEmployeeId);
        Assert.Null((await db.Teams.FindAsync(teamId))!.LeadEmployeeId);
        Assert.Equal(2, await db.Set<AuditLog>().CountAsync(a => a.Action == "DEPARTMENT_MANAGER_CHANGED"));
        Assert.Equal(2, await db.Set<AuditLog>().CountAsync(a => a.Action == "TEAM_LEAD_CHANGED"));
    }
    [Fact]
    public async Task OccupiedTeamRollsBackDepartmentAssignmentAndProfileChanges()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); var teamId = await Setup(h);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Employees.Where(e => e.Id == h.Peer).ExecuteUpdateAsync(s => s.SetProperty(e => e.TeamId, teamId));
            await db.Teams.Where(t => t.Id == teamId).ExecuteUpdateAsync(s => s.SetProperty(t => t.LeadEmployeeId, h.Peer));
        }
        var payload = Payload(true, true); payload["fullName"] = "Should rollback";
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", payload)).StatusCode);
        using var services = h.App.Services.CreateScope(); var context = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Null((await context.Departments.FindAsync(h.Department))!.ManagerEmployeeId);
        Assert.Equal(h.Peer, (await context.Teams.FindAsync(teamId))!.LeadEmployeeId);
        Assert.Equal("Employee 1", (await context.Employees.FindAsync(h.Self))!.FullName);
        Assert.False(await context.Set<AuditLog>().AnyAsync(a => a.Action == "DEPARTMENT_MANAGER_CHANGED"));
    }
    [Fact]
    public async Task CannotReplaceAnotherDepartmentManagerOrRemoveTheirAssignment()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await Setup(h);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Departments.Where(d => d.Id == h.Department).ExecuteUpdateAsync(s => s.SetProperty(d => d.ManagerEmployeeId, h.Peer));
        }
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Payload(true))).StatusCode);
        (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Payload(false))).EnsureSuccessStatusCode();
        using var services = h.App.Services.CreateScope(); var context = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(h.Peer, (await context.Departments.FindAsync(h.Department))!.ManagerEmployeeId);
    }
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task LeadershipChangesRequireCorrespondingOrganizationUpdate(bool manager, bool lead)
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await Setup(h, grants: false);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Payload(manager ? true : null, lead ? true : null))).StatusCode);
    }
    [Theory]
    [InlineData("SELF", false)]
    [InlineData("DEPARTMENT", true)]
    public async Task CannotBypassEmployeeWriteScope(string dataScope, bool targetOtherDepartment)
    {
        await using var h = await EmployeeApiTests.Harness.Create(dataScope); await Setup(h);
        var id = targetOtherDepartment ? h.Other : h.Self;
        var status = (await h.Client.PutAsJsonAsync($"/api/employees/{id}", Payload(true, true))).StatusCode;
        Assert.Equal(targetOtherDepartment ? HttpStatusCode.NotFound : HttpStatusCode.Forbidden, status);
    }
    [Fact]
    public async Task TeamLeadCanMoveOrClearExplicitlyButCannotLeadWithoutTeamOrCrossDepartment()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); var oldTeamId = await Setup(h);
        (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Payload(lead: true))).EnsureSuccessStatusCode();
        int nextTeamId, otherTeamId;
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var next = new Team { TeamCode = "NEXT", TeamName = "Next", DepartmentId = h.Department };
            var other = new Team { TeamCode = "OTHER", TeamName = "Other", DepartmentId = h.OtherDepartment };
            db.AddRange(next, other); await db.SaveChangesAsync(); nextTeamId = next.Id; otherTeamId = other.Id;
        }
        var payload = Payload(); payload["teamId"] = nextTeamId;
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", payload)).StatusCode);
        payload["isTeamLead"] = true;
        (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", payload)).EnsureSuccessStatusCode();
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Null((await db.Teams.FindAsync(oldTeamId))!.LeadEmployeeId);
            Assert.Equal(h.Self, (await db.Teams.FindAsync(nextTeamId))!.LeadEmployeeId);
        }
        payload["teamId"] = otherTeamId;
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", payload)).StatusCode);
        payload["teamId"] = null;
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", payload)).StatusCode);
        payload["isTeamLead"] = false;
        (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", payload)).EnsureSuccessStatusCode();
        var employee = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!;
        Assert.Null(employee.TeamId); Assert.False(employee.IsTeamLead);
    }
    private static object CreatePayload(int departmentId, int? teamId, bool? manager = null, bool? lead = null) => new
    {
        fullName = "New leader", email = "new-leader@example.invalid", departmentId, teamId,
        hireDate = "2020-01-01", employmentStatus = "ACTIVE", isDepartmentManager = manager, isTeamLead = lead
    };
    [Theory]
    [InlineData("ALL", true, false)]
    [InlineData("ALL", false, true)]
    [InlineData("ALL", true, true)]
    [InlineData("DEPARTMENT", true, true)]
    public async Task CreateEmployeeCanAssignLeadershipInSameTransaction(string dataScope, bool manager, bool lead)
    {
        await using var h = await EmployeeApiTests.Harness.Create(dataScope); var teamId = await Setup(h);
        var response = await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.Department, teamId, manager, lead));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var employee = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(manager, employee.IsDepartmentManager); Assert.Equal(lead, employee.IsTeamLead);
        Assert.False(string.IsNullOrEmpty(employee.EmployeeCode));
        var read = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{employee.Id}"))!;
        Assert.Equal(employee, read);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(manager ? employee.Id : (int?)null, (await db.Departments.FindAsync(h.Department))!.ManagerEmployeeId);
        Assert.Equal(lead ? employee.Id : (int?)null, (await db.Teams.FindAsync(teamId))!.LeadEmployeeId);
        Assert.Equal(manager ? 1 : 0, await db.Set<AuditLog>().CountAsync(a => a.Action == "DEPARTMENT_MANAGER_CHANGED"));
        Assert.Equal(lead ? 1 : 0, await db.Set<AuditLog>().CountAsync(a => a.Action == "TEAM_LEAD_CHANGED"));
    }
    [Fact]
    public async Task CreateConflictRollsBackNewEmployeeAndEarlierManagerAssignment()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); var teamId = await Setup(h);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Teams.Where(t => t.Id == teamId).ExecuteUpdateAsync(s => s.SetProperty(t => t.LeadEmployeeId, h.Self));
        }
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.Department, teamId, true, true))).StatusCode);
        using var services = h.App.Services.CreateScope(); var context = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await context.Employees.AnyAsync(e => e.Email == "new-leader@example.invalid"));
        Assert.Null((await context.Departments.FindAsync(h.Department))!.ManagerEmployeeId);
        Assert.Equal(h.Self, (await context.Teams.FindAsync(teamId))!.LeadEmployeeId);
        Assert.False(await context.Set<AuditLog>().AnyAsync(a => a.Action == "DEPARTMENT_MANAGER_CHANGED" || a.Action == "EMPLOYEE_CREATED"));
    }
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task CreateLeadershipRequiresCorrespondingUpdatePermission(bool manager, bool lead)
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); var teamId = await Setup(h, grants: false);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.Department, teamId, manager, lead))).StatusCode);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Employees.AnyAsync(e => e.Email == "new-leader@example.invalid"));
    }
    [Fact]
    public async Task CreateWithFalseFlagsPreservesOtherManagersWithoutOrganizationPermissions()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); var teamId = await Setup(h, grants: false);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Departments.Where(d => d.Id == h.Department).ExecuteUpdateAsync(s => s.SetProperty(d => d.ManagerEmployeeId, h.Self));
            await db.Teams.Where(t => t.Id == teamId).ExecuteUpdateAsync(s => s.SetProperty(t => t.LeadEmployeeId, h.Self));
        }
        var response = await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.Department, teamId, false, false));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var employee = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.False(employee.IsDepartmentManager); Assert.False(employee.IsTeamLead);
        using var services = h.App.Services.CreateScope(); var context = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(h.Self, (await context.Departments.FindAsync(h.Department))!.ManagerEmployeeId);
        Assert.Equal(h.Self, (await context.Teams.FindAsync(teamId))!.LeadEmployeeId);
    }
    [Fact]
    public async Task CreateLeadRequiresValidTeamInEmployeesDepartment()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await Setup(h);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.Department, null, lead: true))).StatusCode);
        int otherTeamId;
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var other = new Team { TeamCode = "OTHERCREATE", TeamName = "Other", DepartmentId = h.OtherDepartment };
            db.Add(other); await db.SaveChangesAsync(); otherTeamId = other.Id;
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.Department, otherTeamId, lead: true))).StatusCode);
        using var services = h.App.Services.CreateScope(); var context = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await context.Employees.AnyAsync(e => e.Email == "new-leader@example.invalid"));
    }
    [Theory]
    [InlineData("SELF")]
    [InlineData("DEPARTMENT")]
    public async Task CreateLeadershipCannotBypassEmployeeNewScope(string dataScope)
    {
        await using var h = await EmployeeApiTests.Harness.Create(dataScope); await Setup(h);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/employees", CreatePayload(h.OtherDepartment, null, manager: true))).StatusCode);
    }

}
