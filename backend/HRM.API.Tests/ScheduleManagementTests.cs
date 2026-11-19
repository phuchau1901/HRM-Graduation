using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class ScheduleManagementTests
{
    private static async Task<long> Setup(Fixture f)
    {
        foreach (var code in new[] { SystemScreens.Schedules, SystemScreens.Shifts }) await OrganizationApiTests.Grant(f.H.App, code);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.Set<Role>().SingleAsync(r => r.Code == "HR"); var screen = await db.Screens.SingleAsync(s => s.Code == SystemScreens.Schedules);
            foreach (var action in new[] { "VIEW", "NEW", "UPDATE", "DELETE", "EXPORT" }) db.Add(new RoleScreenAction { RoleID = role.ID, ScreenID = screen.ID, ActionCode = action, DataScope = "ALL" });
            await db.RoleDetails.Where(d => d.ScreenID == screen.ID).ExecuteUpdateAsync(s => s.SetProperty(d => d.CanExport, "Y"));
            await db.SaveChangesAsync();
        }
        await OrganizationApiTests.Login(f.H.Client, f.H.App);
        var response = await f.H.Client.PostAsJsonAsync("/api/shifts", new ShiftRequest { Code = "BULK", Name = "Bulk Day", StartTime = new(8, 0), EndTime = new(17, 0), BreakMinutes = 60 }); response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<ShiftView>())!.Id;
    }
    private static ScheduleBulkRequest Request(Fixture f, long shift) => new() { OperationId = Guid.NewGuid(), Target = "EMPLOYEE", EmployeeIds = [f.H.Self], ShiftId = shift, From = new(2026, 11, 23), To = new(2026, 11, 25), Weekdays = [1, 2, 3, 4, 5] };
    private static async Task<SchedulePreview> Preview(Fixture f, ScheduleBulkRequest request)
    {
        var response = await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk/preview", request); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<SchedulePreview>())!;
    }
    private static async Task<ScheduleBatchResult> Assign(Fixture f, ScheduleBulkRequest request, bool copy = false)
    {
        request.PreviewToken = (await Preview(f, request)).PreviewToken;
        var response = await f.H.Client.PostAsJsonAsync(copy ? "/api/work-schedules/copy" : "/api/work-schedules/bulk", request); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<ScheduleBatchResult>())!;
    }
    [Fact]
    public async Task BatchSnapshotsAuditGroupedNotificationAndReplayAreAtomic()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var request = Request(f, shift);
        var result = await Assign(f, request); Assert.Equal(3, result.Created);
        var replay = await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request); replay.EnsureSuccessStatusCode(); Assert.Equal(result.Created, (await replay.Content.ReadFromJsonAsync<ScheduleBatchResult>())!.Created);
        using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(3, await db.Set<WorkSchedule>().CountAsync()); Assert.All(await db.Set<WorkSchedule>().ToListAsync(), s => Assert.Contains("BULK", s.RulesSnapshotJson));
        Assert.Equal(1, await db.Set<Notification>().CountAsync(n => n.ReferenceType == "WORK_SCHEDULE")); Assert.Equal(1, await db.Set<NotificationOutbox>().CountAsync());
        Assert.Equal(1, await db.Set<AuditLog>().CountAsync(a => a.EntityType == "ScheduleBatch"));
        request.To = request.To.AddDays(1); Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request)).StatusCode);
    }
    [Fact]
    public async Task PreviewSkipsHireDateHolidaysLeaveLockedPeriodAndInactiveEmployees()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var request = Request(f, shift); request.To = new(2026, 12, 1);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.HireDate, new DateOnly(2026, 11, 24)));
            var setting = await db.Set<SystemSetting>().SingleAsync(s => s.Key == SettingsDefaults.AttendanceKey); var config = SettingsDefaults.Read<AttendanceSettingsRequest>(setting.JsonValue); config.HolidayDates = [new(2026, 11, 25)]; setting.JsonValue = JsonSerializer.Serialize(config, SettingsDefaults.Json);
            db.Add(new LeaveRequest { EmployeeID = f.H.Self, LeaveTypeID = f.TypeId, FromDate = new(2026, 11, 26), ToDate = new(2026, 11, 26), RequestedDays = 1, Status = "APPROVED" });
            db.Add(new TimesheetPeriod { PeriodKey = "2026-12", Status = "LOCKED" }); await db.SaveChangesAsync();
        }
        var preview = await Preview(f, request); Assert.Contains(preview.Items, p => p.Outcome == "BEFORE_HIRE"); Assert.Contains(preview.Items, p => p.Outcome == "HOLIDAY"); Assert.Contains(preview.Items, p => p.Outcome == "APPROVED_LEAVE"); Assert.Contains(preview.Items, p => p.Outcome == "PERIOD_LOCKED");
        request.ExcludeHolidays = false; Assert.Contains((await Preview(f, request)).Items, p => p.WorkDate == new DateOnly(2026, 11, 25) && p.Outcome == "READY");
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.EmploymentStatus, "INACTIVE"));
        Assert.All((await Preview(f, request)).Items, p => Assert.Equal("INACTIVE", p.Outcome));
    }
    [Fact]
    public async Task StalePreviewRequiresReconfirmationAndCannotOverwriteAttendance()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var request = Request(f, shift);
        request.PreviewToken = (await Preview(f, request)).PreviewToken;
        var single = await f.H.Client.PostAsJsonAsync("/api/work-schedules", new ScheduleRequest { EmployeeId = f.H.Self, ShiftId = shift, WorkDate = request.From }); single.EnsureSuccessStatusCode();
        var row = (await single.Content.ReadFromJsonAsync<ScheduleView>())!;
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request)).StatusCode);
        using (var scope = f.H.App.Services.CreateScope()) { var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); db.Add(new HRM.API.Modules.Attendance.Entities.Attendance { ScheduleID = row.Id, Status = "ABSENT" }); await db.SaveChangesAsync(); }
        request.Overwrite = true; var preview = await Preview(f, request); Assert.Equal("ATTENDANCE_OR_CLOSED", preview.Items.Single(p => p.WorkDate == request.From).Outcome);
        Assert.Equal(2, (await Assign(f, request)).Created);
    }
    [Fact]
    public async Task CopyCreatesFreshSnapshotsAndDoesNotMutateSource()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var source = Request(f, shift); await Assign(f, source);
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<Shift>().Where(s => s.ID == shift).ExecuteUpdateAsync(s => s.SetProperty(s => s.Name, "Changed").SetProperty(s => s.Version, s => s.Version + 1));
        var copy = Request(f, shift); copy.CopyFrom = source.From; copy.From = source.From.AddDays(7); copy.To = source.To.AddDays(7); copy.ShiftId = null;
        Assert.Equal(3, (await Assign(f, copy, true)).Created);
        using var scope2 = f.H.App.Services.CreateScope(); var rows = await scope2.ServiceProvider.GetRequiredService<AppDbContext>().Set<WorkSchedule>().OrderBy(s => s.WorkDate).ToListAsync();
        Assert.Equal(6, rows.Count); Assert.Equal(source.From, SettingsDefaults.Read<AttendanceRuleSnapshot>(rows[0].RulesSnapshotJson!).WorkDate); Assert.Equal(copy.From, SettingsDefaults.Read<AttendanceRuleSnapshot>(rows[3].RulesSnapshotJson!).WorkDate);
    }
    [Fact]
    public async Task ActionScopesAreIndependentAndCalendarDoesNotRequireEmployeeOrShiftScreen()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var request = Request(f, shift);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(s => s.Code == SystemScreens.Schedules);
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID).ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "DEPARTMENT"));
            var extra = await db.Screens.Where(s => s.Code == "WEB_EMPLOYEES" || s.Code == "WEB_SHIFTS").Select(s => s.ID).ToArrayAsync(); await db.RoleDetails.Where(d => extra.Contains(d.ScreenID)).ExecuteDeleteAsync();
        }
        await OrganizationApiTests.Login(f.H.Client, f.H.App);
        var calendar = (await f.H.Client.GetFromJsonAsync<ScheduleCalendar>("/api/work-schedules/calendar?from=2026-11-23&to=2026-11-29"))!;
        Assert.DoesNotContain(calendar.Employees, e => e.Id == f.H.Other); Assert.Contains(calendar.Employees, e => e.Id == f.H.Self); Assert.Contains(calendar.Shifts, s => s.Id == shift);
        request.EmployeeIds = [f.H.Other]; Assert.Equal(HttpStatusCode.NotFound, (await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk/preview", request)).StatusCode);
        request.EmployeeIds = [f.H.Self]; request.Overwrite = true;
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(s => s.Code == SystemScreens.Schedules);
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "UPDATE").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "SELF"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk/preview", request)).StatusCode);
    }
    [Fact]
    public async Task SingleEndpointsAlsoRejectApprovedLeaveAndLockedPeriods()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); db.Add(new TimesheetPeriod { PeriodKey = "2026-11", Status = "LOCKED" }); await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/work-schedules", new ScheduleRequest { EmployeeId = f.H.Self, ShiftId = shift, WorkDate = new(2026, 11, 23) })).StatusCode);
    }
    [Fact]
    public async Task OverwriteUsesUpdateScopeKeepsSnapshotAndNotifiesOnce()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var first = Request(f, shift); await Assign(f, first);
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<Shift>().Where(s => s.ID == shift).ExecuteUpdateAsync(s => s.SetProperty(s => s.Code, "NEWCODE").SetProperty(s => s.Version, s => s.Version + 1));
        var next = Request(f, shift); next.Overwrite = true; var result = await Assign(f, next); Assert.Equal(3, result.Updated);
        using var check = f.H.App.Services.CreateScope(); var db = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(3, await db.Set<WorkSchedule>().CountAsync()); Assert.All(await db.Set<WorkSchedule>().ToListAsync(), r => { Assert.Equal(2, r.Version); Assert.Contains("NEWCODE", r.RulesSnapshotJson); });
        Assert.Equal(2, await db.Set<Notification>().CountAsync(n => n.ReferenceType == "WORK_SCHEDULE"));
    }
    [Fact]
    public async Task ConcurrentRetryCannotCreateDuplicateSchedulesOrNotifications()
    {
        var path = Path.Combine(Path.GetTempPath(), "schedule-concurrent-" + Guid.NewGuid() + ".db");
        try
        {
            await using var f = await Fixture.Create(path); var shift = await Setup(f); var request = Request(f, shift); request.PreviewToken = (await Preview(f, request)).PreviewToken;
            var results = await Task.WhenAll(f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request), f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request));
            Assert.Contains(results, r => r.StatusCode == HttpStatusCode.OK);
            Assert.All(results, r => Assert.Contains(r.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }));
            (await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request)).EnsureSuccessStatusCode();
            using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(3, await db.Set<WorkSchedule>().CountAsync()); Assert.Equal(1, await db.Set<AuditLog>().CountAsync(a => a.EntityType == "ScheduleBatch")); Assert.Equal(1, await db.Set<Notification>().CountAsync(n => n.ReferenceType == "WORK_SCHEDULE"));
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
    [Fact]
    public async Task FailureWhileSavingBatchRollsBackRowsAuditAndNotifications()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var request = Request(f, shift); request.PreviewToken = (await Preview(f, request)).PreviewToken;
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_schedule_batch BEFORE INSERT ON work_schedules WHEN NEW.work_date = '2026-11-24' BEGIN SELECT RAISE(ABORT, 'injected scheduling failure'); END;");
        var response = await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request); Assert.False(response.IsSuccessStatusCode);
        using var check = f.H.App.Services.CreateScope(); var db = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Set<WorkSchedule>().AnyAsync()); Assert.False(await db.Set<AuditLog>().AnyAsync(a => a.EntityType == "ScheduleBatch")); Assert.False(await db.Set<Notification>().AnyAsync(n => n.ReferenceType == "WORK_SCHEDULE"));
    }
    [Fact]
    public async Task OverlappingOvernightShiftIsSkippedAndExportUsesItsOwnScope()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var night = new Shift { Code = "NIGHT", StartTime = new(22, 0), EndTime = new(10, 0), IsActive = true }; db.Add(night); await db.SaveChangesAsync();
            var rules = AttendanceRules.Snapshot(night, new(2026, 11, 23), new AttendanceSettingsRequest(), 1);
            db.Add(new WorkSchedule { EmployeeID = f.H.Self, ShiftID = night.ID, WorkDate = rules.WorkDate, Status = "SCHEDULED", UniqueWorkKey = "night-schedule", RulesSnapshotJson = JsonSerializer.Serialize(rules, SettingsDefaults.Json) }); await db.SaveChangesAsync();
        }
        var request = Request(f, shift); request.From = new(2026, 11, 24); request.To = request.From;
        Assert.Equal("OVERLAP_OR_LEGACY", Assert.Single((await Preview(f, request)).Items).Outcome);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(s => s.Code == SystemScreens.Schedules);
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "EXPORT").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "SELF"));
        }
        var export = await f.H.Client.GetAsync("/api/work-schedules/export?from=2026-11-23&to=2026-11-29"); export.EnsureSuccessStatusCode(); Assert.Equal("text/csv", export.Content.Headers.ContentType!.MediaType); Assert.Contains("NIGHT", await export.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ReplayCannotReturnEmployeesOutsideReducedCurrentScope()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f); var request = Request(f, shift); request.Target = "ALL"; request.EmployeeIds = [];
        await Assign(f, request);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(s => s.Code == SystemScreens.Schedules);
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "NEW").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "DEPARTMENT"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/work-schedules/bulk", request)).StatusCode);
    }

}
