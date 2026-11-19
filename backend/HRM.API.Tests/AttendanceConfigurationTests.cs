using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Work.DTOs;
using HRM.API.Modules.Work.Services;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class AttendanceConfigurationTests
{
    private sealed class Fixture : IDisposable
    {
        internal readonly AttendanceTestClock Clock = new(); internal readonly AdministrationApiTests.Fixture Base;
        internal HttpClient Client => Base.Client; internal AuthApiFactory App => Base.App; internal int Employee;
        internal Fixture() => Base = new(new AuthApiFactory { TestClock = Clock });
        internal async Task Start(AttendanceSettingsRequest? config = null)
        {
            await Base.Start();
            foreach (var code in new[] { "WEB_SYSTEM_SETTINGS", WorkScreens.Shifts, WorkScreens.Schedules, AttendanceScreens.Attendance, AttendanceScreens.Qr }) await OrganizationApiTests.Grant(App, code);
            using var scope = App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var department = new Department { DepartmentCode = "ATT", DepartmentName = "Attendance" }; db.Add(department); await db.SaveChangesAsync();
            var employee = new Employee { EmployeeCode = "ATT-1", FullName = "Employee", Email = "att@example.invalid", DepartmentId = department.Id }; db.Add(employee); await db.SaveChangesAsync(); Employee = employee.Id;
            await db.Set<User>().Where(x => x.UserId == "api-user").ExecuteUpdateAsync(x => x.SetProperty(u => u.EmployeeId, Employee));
            var role = await db.Set<Role>().SingleAsync(x => x.Code == "HR");
            foreach (var code in new[] { WorkScreens.Schedules, AttendanceScreens.Attendance })
            {
                var screen = await db.Screens.SingleAsync(x => x.Code == code);
                await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanApprove, "Y"));
                foreach (var action in new[] { "VIEW", "NEW", "UPDATE", "DELETE", "APPROVE" }) db.Add(new RoleScreenAction { RoleID = role.ID, ScreenID = screen.ID, ActionCode = action, DataScope = "ALL" });
            }
            if (config is not null) await db.Set<SystemSetting>().Where(x => x.Key == SettingsDefaults.AttendanceKey).ExecuteUpdateAsync(x => x.SetProperty(s => s.JsonValue, JsonSerializer.Serialize(config, SettingsDefaults.Json)));
            await db.SaveChangesAsync(); await OrganizationApiTests.Login(Client, App);
        }
        internal async Task<(ShiftView Shift, ScheduleView Schedule)> Schedule()
        {
            var shiftResponse = await Client.PostAsJsonAsync("/api/shifts", new ShiftRequest { Code = "DAY", Name = "Day", StartTime = new(8, 0), EndTime = new(17, 0), BreakMinutes = 60 });
            Assert.Equal(HttpStatusCode.Created, shiftResponse.StatusCode); var shift = (await shiftResponse.Content.ReadFromJsonAsync<ShiftView>())!;
            var scheduleResponse = await Client.PostAsJsonAsync("/api/work-schedules", new ScheduleRequest { EmployeeId = Employee, ShiftId = shift.Id, WorkDate = new(2026, 11, 16) });
            Assert.Equal(HttpStatusCode.Created, scheduleResponse.StatusCode); return (shift, (await scheduleResponse.Content.ReadFromJsonAsync<ScheduleView>())!);
        }
        public void Dispose() => Base.Dispose();
    }
    [Fact]
    public async Task ServerClockSnapshotsAndIdempotencyProtectAttendanceHistory()
    {
        using var f = new Fixture(); await f.Start(); var (shift, schedule) = await f.Schedule(); var rules = schedule.Rules!;
        using var change = new HttpRequestMessage(HttpMethod.Put, $"/api/shifts/{shift.Id}") { Content = JsonContent.Create(new ShiftRequest { Code = shift.Code, Name = "Changed", StartTime = new(9, 0), EndTime = new(18, 0), BreakMinutes = 90, LateGraceMinutes = 30 }) };
        change.Headers.TryAddWithoutValidation("If-Match", $"\"{shift.Version}\""); Assert.Equal(HttpStatusCode.OK, (await f.Client.SendAsync(change)).StatusCode);
        using var settingsChange = new HttpRequestMessage(HttpMethod.Put, "/api/system-settings/attendance") { Content = JsonContent.Create(new AttendanceSettingsRequest { Timezone = "UTC", EarlyLeaveGraceMinutes = 60 }) };
        settingsChange.Headers.TryAddWithoutValidation("If-Match", "\"1\""); Assert.Equal(HttpStatusCode.OK, (await f.Client.SendAsync(settingsChange)).StatusCode);
        var frozen = (await f.Client.GetFromJsonAsync<ScheduleView>($"/api/work-schedules/{schedule.Id}"))!; Assert.Equal(rules.StartAtUtc, frozen.Rules!.StartAtUtc); Assert.Equal("Asia/Ho_Chi_Minh", frozen.Rules.Timezone);
        f.Clock.Now = new DateTimeOffset(rules.StartAtUtc.AddMinutes(6));
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", new { scheduleId = schedule.Id, requestKey = "forged", checkInAt = "2020-01-01T00:00:00Z" })).StatusCode);
        var punch = new PunchRequest { ScheduleId = schedule.Id, RequestKey = "check-in" };
        var response = await f.Client.PostAsJsonAsync("/api/attendances/check-in", punch); Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var attendance = (await response.Content.ReadFromJsonAsync<AttendanceView>())!; Assert.Equal(f.Clock.Now.UtcDateTime, attendance.CheckInAtUtc); Assert.Equal(1, attendance.LateMinutes);
        Assert.Equal(HttpStatusCode.OK, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", punch)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", new PunchRequest { ScheduleId = schedule.Id, RequestKey = "another-key" })).StatusCode);
        f.Clock.Now = new DateTimeOffset(rules.EndAtUtc.AddMinutes(-6));
        var checkout = await f.Client.PostAsJsonAsync("/api/attendances/check-out", new PunchRequest { ScheduleId = schedule.Id, RequestKey = "check-out" }); Assert.Equal(HttpStatusCode.OK, checkout.StatusCode);
        var completed = (await checkout.Content.ReadFromJsonAsync<AttendanceView>())!; Assert.Equal(1, completed.EarlyMinutes); Assert.Equal(468, completed.WorkedMinutes); Assert.Equal("COMPLETE", completed.Status);
        using var rewrite = new HttpRequestMessage(HttpMethod.Put, $"/api/work-schedules/{schedule.Id}") { Content = JsonContent.Create(new ScheduleRequest { EmployeeId = f.Employee, ShiftId = shift.Id, WorkDate = schedule.WorkDate }) };
        rewrite.Headers.TryAddWithoutValidation("If-Match", $"\"{schedule.Version}\""); Assert.Equal(HttpStatusCode.Conflict, (await f.Client.SendAsync(rewrite)).StatusCode);
        var list = (await f.Client.GetFromJsonAsync<PageResult<AttendanceView>>("/api/attendances"))!; Assert.Equal(1, list.Total);
    }
    [Fact]
    public async Task QrGpsAreEnforcedTogetherAndSecretsNeverAppearInAuditOrLists()
    {
        var config = new AttendanceSettingsRequest { RequireGps = true, RequireQr = true, Locations = [new() { Code = "HQ", Name = "Office", Latitude = 10, Longitude = 106, RadiusMeters = 100 }] };
        using var f = new Fixture(); await f.Start(config); var (_, schedule) = await f.Schedule(); f.Clock.Now = new DateTimeOffset(schedule.Rules!.StartAtUtc);
        var qrResponse = await f.Client.PostAsJsonAsync("/api/qr-sessions", new QrCreateRequest { LocationCode = "HQ" }); Assert.Equal(HttpStatusCode.Created, qrResponse.StatusCode); var qr = (await qrResponse.Content.ReadFromJsonAsync<QrCreated>())!;
        var body = new PunchRequest { ScheduleId = schedule.Id, RequestKey = "gps", QrSessionId = qr.Session.Id, QrToken = "invalid", Latitude = 10, Longitude = 106 };
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", body)).StatusCode);
        body.QrToken = qr.Token; body.Latitude = 11;
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", body)).StatusCode);
        body.Latitude = 10; Assert.Equal(HttpStatusCode.OK, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", body)).StatusCode);
        var json = await f.Client.GetStringAsync("/api/qr-sessions"); Assert.DoesNotContain(qr.Token, json); Assert.DoesNotContain("nonceHash", json);
        using var scope = f.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var hash = (await db.Set<QRSession>().SingleAsync()).NonceHash;
        Assert.All(await db.Set<AuditLog>().ToListAsync(), log => { Assert.DoesNotContain(qr.Token, log.AfterJSON ?? ""); Assert.DoesNotContain(hash, log.AfterJSON ?? ""); });
    }
    [Theory]
    [InlineData(MissingPunchRules.Reject, HttpStatusCode.Conflict)]
    [InlineData(MissingPunchRules.Incomplete, HttpStatusCode.OK)]
    public async Task MissingCheckInRuleAndCloseAreBasedOnSnapshot(string rule, HttpStatusCode expected)
    {
        using var f = new Fixture(); await f.Start(new AttendanceSettingsRequest { MissingPunchRule = rule }); var (_, schedule) = await f.Schedule(); f.Clock.Now = new DateTimeOffset(schedule.Rules!.EndAtUtc);
        Assert.Equal(expected, (await f.Client.PostAsJsonAsync("/api/attendances/check-out", new PunchRequest { ScheduleId = schedule.Id, RequestKey = "missing-in" })).StatusCode);
        f.Clock.Now = new DateTimeOffset(schedule.Rules.CheckOutCloseUtc.AddMinutes(1));
        var closed = await f.Client.PostAsync($"/api/work-schedules/{schedule.Id}/close", null); Assert.Equal(HttpStatusCode.OK, closed.StatusCode);
        Assert.Equal(rule == MissingPunchRules.Reject ? "ABSENT" : "MISSING_CHECK_IN", (await closed.Content.ReadFromJsonAsync<AttendanceView>())!.Status);
    }
    [Fact]
    public async Task EmployeeScopeRestrictsSchedulesAndPunchingWhileGlobalSettingsStayGlobal()
    {
        using var f = new Fixture(); await f.Start(); var (shift, own) = await f.Schedule();
        int otherId;
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var department = await db.Set<Department>().SingleAsync();
            var other = new Employee { EmployeeCode = "ATT-OTHER", FullName = "Other", Email = "other-att@example.invalid", DepartmentId = department.Id }; db.Add(other); await db.SaveChangesAsync(); otherId = other.Id;
        }
        var otherResponse = await f.Client.PostAsJsonAsync("/api/work-schedules", new ScheduleRequest { EmployeeId = otherId, ShiftId = shift.Id, WorkDate = own.WorkDate });
        Assert.Equal(HttpStatusCode.Created, otherResponse.StatusCode); var otherSchedule = (await otherResponse.Content.ReadFromJsonAsync<ScheduleView>())!;
        f.Clock.Now = new DateTimeOffset(own.Rules!.StartAtUtc);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", new PunchRequest { ScheduleId = otherSchedule.Id, RequestKey = "proxy" })).StatusCode);
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); await db.Set<RoleScreenAction>().ExecuteUpdateAsync(x => x.SetProperty(r => r.DataScope, "SELF"));
        }
        var visible = (await f.Client.GetFromJsonAsync<PageResult<ScheduleView>>("/api/work-schedules"))!; Assert.Equal(1, visible.Total); Assert.Equal(own.Id, Assert.Single(visible.Data).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await f.Client.GetAsync($"/api/work-schedules/{otherSchedule.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Client.GetAsync("/api/system-settings/attendance")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", new PunchRequest { ScheduleId = own.Id, RequestKey = "own-self" })).StatusCode);
    }

    [Fact]
    public async Task ExistingNightShiftCanBeDeactivatedAfterOvernightIsDisabled()
    {
        using var f = new Fixture(); await f.Start();
        var created = await f.Client.PostAsJsonAsync("/api/shifts", new ShiftRequest { Code = "NIGHT", Name = "Night", StartTime = new(22, 0), EndTime = new(6, 0), BreakMinutes = 60 });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode); var shift = (await created.Content.ReadFromJsonAsync<ShiftView>())!;
        using var config = new HttpRequestMessage(HttpMethod.Put, "/api/system-settings/attendance") { Content = JsonContent.Create(new AttendanceSettingsRequest { AllowOvernightShifts = false }) };
        config.Headers.TryAddWithoutValidation("If-Match", "\"1\""); Assert.Equal(HttpStatusCode.OK, (await f.Client.SendAsync(config)).StatusCode);
        using var disable = new HttpRequestMessage(HttpMethod.Put, $"/api/shifts/{shift.Id}") { Content = JsonContent.Create(new ShiftRequest { Code = shift.Code, Name = shift.Name, StartTime = shift.StartTime, EndTime = shift.EndTime, BreakMinutes = shift.BreakMinutes, LateGraceMinutes = shift.LateGraceMinutes, IsActive = false }) };
        disable.Headers.TryAddWithoutValidation("If-Match", $"\"{shift.Version}\"");
        Assert.Equal(HttpStatusCode.OK, (await f.Client.SendAsync(disable)).StatusCode);
    }

    [Fact]
    public async Task MissingScopeAndLegacySnapshotFailClosedWithoutModifyingOldAttendance()
    {
        using var f = new Fixture(); await f.Start(); var (_, schedule) = await f.Schedule();
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); await db.Set<WorkSchedule>().ExecuteUpdateAsync(x => x.SetProperty(s => s.RulesSnapshotJson, (string?)null));
        }
        f.Clock.Now = new DateTimeOffset(schedule.Rules!.StartAtUtc);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/attendances/check-in", new PunchRequest { ScheduleId = schedule.Id, RequestKey = "legacy" })).StatusCode);
        using (var scope = f.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); await db.Set<RoleScreenAction>().ExecuteUpdateAsync(x => x.SetProperty(s => s.DataScope, (string?)null));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.GetAsync("/api/work-schedules")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.GetAsync("/api/attendances")).StatusCode);
    }
}
