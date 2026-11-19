using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using System.Text.Json;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class AdjustmentSubmissionPermissionTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("SELF")]
    [InlineData("DEPARTMENT")]
    [InlineData("ALL")]
    [InlineData("INVALID")]
    public async Task CreationUsesLinkedEmployeeWithoutScope(string? dataScope)
    {
        await using var f = await Fixture.Create(); var attendanceId = await Attendance(f, f.H.Self);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_ATTENDANCE_ADJUSTMENTS");
            var grants = db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "NEW");
            if (dataScope == null) await grants.ExecuteDeleteAsync();
            else await grants.ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, dataScope));
        }
        var response = await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments", new { employeeId = f.H.Other, attendanceId, proposedCheckIn = "2026-11-16T08:00:00+07:00", proposedCheckOut = "2026-11-16T17:00:00+07:00", reason = "Personal adjustment" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        using var check = f.H.App.Services.CreateScope();
        Assert.Equal(f.H.Self, (await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<AttendanceAdjustment>().SingleAsync()).EmployeeID);
    }
    [Theory]
    [InlineData("permission")]
    [InlineData("link")]
    [InlineData("inactive")]
    public async Task CreationStillRequiresLiveNewPermissionAndActiveLinkedEmployee(string missing)
    {
        await using var f = await Fixture.Create(); var attendanceId = await Attendance(f, f.H.Self);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (missing == "permission")
            {
                var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_ATTENDANCE_ADJUSTMENTS");
                await db.Set<RoleDetail>().Where(d => d.ScreenID == screen.ID).ExecuteUpdateAsync(s => s.SetProperty(d => d.CanNew, "N"));
            }
            else if (missing == "link") await db.Set<User>().Where(u => u.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(u => u.EmployeeId, (int?)null));
            else await db.Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.EmploymentStatus, "INACTIVE"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments", new { attendanceId, proposedCheckIn = "2026-11-16T08:00:00+07:00", reason = "Permission test" })).StatusCode);
    }
    private static async Task<long> Attendance(Fixture f, int employeeId)
    {
        using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var shift = new Shift { Code = "ADJTEST", StartTime = new(8, 0), EndTime = new(17, 0), IsActive = true }; db.Add(shift); await db.SaveChangesAsync();
        var rules = AttendanceRules.Snapshot(shift, new(2026, 11, 16), new AttendanceSettingsRequest(), 1);
        var schedule = new WorkSchedule { EmployeeID = employeeId, ShiftID = shift.ID, WorkDate = rules.WorkDate, Status = "CLOSED", UniqueWorkKey = "submission-adjustment", Version = 1, RulesSnapshotJson = JsonSerializer.Serialize(rules, SettingsDefaults.Json) }; db.Add(schedule); await db.SaveChangesAsync();
        var attendance = new HRM.API.Modules.Attendance.Entities.Attendance { ScheduleID = schedule.ID, Status = "ABSENT" }; db.Add(attendance); await db.SaveChangesAsync(); return attendance.ID;
    }
    [Fact]
    public async Task CannotSubmitForAnotherEmployeesAttendanceEvenWithoutScope()
    {
        await using var f = await Fixture.Create(); var attendanceId = await Attendance(f, f.H.Other);
        var response = await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments", new { attendanceId, proposedCheckIn = "2026-11-16T08:00:00+07:00", reason = "Not mine" });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        using var scope = f.H.App.Services.CreateScope(); Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<AttendanceAdjustment>().AnyAsync());
    }

}
