using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class LeaveTypePermissionTests
{
    [Theory]
    [InlineData("WEB_LEAVE_TYPES", "VIEW", true)]
    [InlineData("WEB_LEAVE_REQUESTS", "VIEW", true)]
    [InlineData("WEB_OVERTIME_REQUESTS", "VIEW", true)]
    [InlineData("WEB_ATTENDANCE_ADJUSTMENTS", "VIEW", true)]
    [InlineData("WEB_LEAVE_REQUESTS", "NEW", false)]
    [InlineData("WEB_LEAVE_MANAGEMENT", "VIEW", false)]
    public async Task CatalogAcceptsAnyAllowedViewButDoesNotGrantWrites(string code, string action, bool allowed)
    {
        await using var f = await Fixture.Create();
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<RoleScreenAction>().ExecuteDeleteAsync();
            await db.Set<RoleDetail>().ExecuteDeleteAsync();
            var role = await db.Set<Role>().SingleAsync(r => r.Code == "HR");
            var screen = await db.Screens.SingleAsync(s => s.Code == code);
            db.Add(new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = action == "VIEW" ? "Y" : "N", CanNew = action == "NEW" ? "Y" : "N" });
            await db.SaveChangesAsync();
        }
        await OrganizationApiTests.Login(f.H.Client, f.H.App);
        Assert.Equal(allowed ? HttpStatusCode.OK : HttpStatusCode.Forbidden, (await f.H.Client.GetAsync("/api/leave-types")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/leave-types", new { code = "OTHER", name = "Other", requiresBalance = false, isActive = true })).StatusCode);
        if (allowed)
        {
            using var scope = f.H.App.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<RoleDetail>().ExecuteUpdateAsync(s => s.SetProperty(d => d.CanView, "N"));
            Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.GetAsync("/api/leave-types")).StatusCode);
        }
    }
}
