using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class LeaveSubmissionPermissionTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("SELF")]
    [InlineData("DEPARTMENT")]
    [InlineData("ALL")]
    [InlineData("INVALID")]
    public async Task CreationUsesLinkedEmployeeWithoutScope(string? dataScope)
    {
        await using var f = await Fixture.Create();
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_LEAVE_REQUESTS");
            var grants = db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "NEW");
            if (dataScope == null) await grants.ExecuteDeleteAsync();
            else await grants.ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, dataScope));
        }
        var response = await f.H.Client.PostAsJsonAsync("/api/leave-requests", new { employeeId = f.H.Other, leaveTypeId = f.TypeId, fromDate = "2026-11-23", toDate = "2026-11-23", reason = "Personal leave" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var check = f.H.App.Services.CreateScope();
        Assert.Equal(f.H.Self, (await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveRequest>().SingleAsync()).EmployeeID);
    }
    [Theory]
    [InlineData("permission")]
    [InlineData("link")]
    [InlineData("inactive")]
    public async Task CreationStillRequiresLiveNewPermissionAndActiveLinkedEmployee(string missing)
    {
        await using var f = await Fixture.Create();
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (missing == "permission")
            {
                var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_LEAVE_REQUESTS");
                await db.Set<RoleDetail>().Where(d => d.ScreenID == screen.ID).ExecuteUpdateAsync(s => s.SetProperty(d => d.CanNew, "N"));
            }
            else if (missing == "link") await db.Set<User>().Where(u => u.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(u => u.EmployeeId, (int?)null));
            else await db.Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.EmploymentStatus, "INACTIVE"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", new { leaveTypeId = f.TypeId, fromDate = "2026-11-23", toDate = "2026-11-23", reason = "Permission test" })).StatusCode);
    }
}
