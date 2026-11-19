using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Work.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class WeeklyScheduleAutomationTests
{
    private static async Task<long> Setup(Fixture f, string status = "ACTIVE", DateOnly? end = null)
    {
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now = new(2026, 11, 21, 17, 0, 0, TimeSpan.Zero); // Sunday midnight in Vietnam
        using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        if (!await db.Set<ContractType>().AnyAsync(t => t.Code == "FIXED_TERM")) db.Add(new ContractType { Code = "FIXED_TERM", Name = "Fixed", Prefix = "HDLD" });
        var shift = new Shift { Code = "WEEKLY", Name = "Weekly", StartTime = new(8, 0), EndTime = new(17, 0), IsActive = true }; db.Add(shift); await db.SaveChangesAsync();
        db.Add(new Contract { EmployeeID = f.H.Self, ContractNo = "AUTO-SELF", ContractType = "FIXED_TERM", Status = status, StartDate = new(2026, 1, 1), EndDate = end });
        foreach (var day in Enumerable.Range(0, 5).Select(i => new DateOnly(2026, 11, 16).AddDays(i)))
        {
            var rules = AttendanceRules.Snapshot(shift, day, new AttendanceSettingsRequest(), 1);
            db.Add(new WorkSchedule { EmployeeID = f.H.Self, ShiftID = shift.ID, WorkDate = day, Status = "CLOSED", UniqueWorkKey = $"source:{f.H.Self}:{day:yyyyMMdd}", RulesSnapshotJson = JsonSerializer.Serialize(rules, SettingsDefaults.Json) });
        }
        await db.SaveChangesAsync(); return shift.ID;
    }
    private static async Task<ScheduleAutomationResult> Run(Fixture f)
    {
        using var scope = f.H.App.Services.CreateScope(); return await scope.ServiceProvider.GetRequiredService<WorkScheduleService>().RunAutomaticSchedules(default);
    }
    [Theory]
    [InlineData("2026-11-22", "2026-11-23")]
    [InlineData("2026-11-23", "2026-11-23")]
    [InlineData("2026-11-28", "2026-11-23")]
    [InlineData("2026-11-29", "2026-11-30")]
    [InlineData("2027-01-03", "2027-01-04")]
    public void VietnamWeeklyWindowStartsFollowingMonday(string today, string expected) => Assert.Equal(DateOnly.Parse(expected), WorkScheduleService.AutomaticWeek(DateOnly.Parse(today)));
    [Theory]
    [InlineData("2026-11-21T16:59:50Z", 10)]
    [InlineData("2026-11-21T17:00:00Z", 300)]
    [InlineData("2026-11-21T16:00:00Z", 300)]
    public void WorkerWakesAtVietnamSundayBoundary(string now, int seconds) => Assert.Equal(TimeSpan.FromSeconds(seconds), WorkScheduleWorker.NextDelay(DateTimeOffset.Parse(now), 300));
    [Fact]
    public async Task SundayCreatesMissingWeekAndReplayDoesNotDuplicateNotifications()
    {
        await using var f = await Fixture.Create(); await Setup(f);
        var result = await Run(f); Assert.Equal(new DateOnly(2026, 11, 23), result.WeekFrom); Assert.Equal(5, result.Created); Assert.Equal(1, result.Employees);
        Assert.Equal(0, (await Run(f)).Created);
        using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(10, await db.Set<WorkSchedule>().CountAsync()); Assert.Equal(1, await db.Set<AuditLog>().CountAsync(a => a.EntityType == "ScheduleAutomation"));
        Assert.Equal(1, await db.Set<Notification>().CountAsync(n => n.ReferenceType == "WORK_SCHEDULE")); Assert.Equal(1, await db.Set<NotificationOutbox>().CountAsync());
        Assert.All(await db.Set<WorkSchedule>().Where(s => s.WorkDate >= result.WeekFrom).ToListAsync(), s => { Assert.Equal("SCHEDULED", s.Status); Assert.Contains("WEEKLY", s.RulesSnapshotJson); });
    }
    [Theory]
    [InlineData("TERMINATED")]
    [InlineData("CANCELLED")]
    [InlineData("DRAFT")]
    [InlineData("EXPIRED")]
    public async Task NonActiveContractsAreExcluded(string status)
    {
        await using var f = await Fixture.Create(); await Setup(f, status); Assert.Equal(0, (await Run(f)).Created);
    }
    [Fact]
    public async Task ContractExpiryLimitsDaysAndInactiveEmployeesAreExcluded()
    {
        await using var f = await Fixture.Create(); await Setup(f, end: new(2026, 11, 24)); Assert.Equal(2, (await Run(f)).Created);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<Contract>().Where(c => c.EmployeeID == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(c => c.EndDate, (DateOnly?)null));
            await db.Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.EmploymentStatus, "INACTIVE"));
        }
        Assert.Equal(0, (await Run(f)).Created);
    }
    [Fact]
    public async Task ExistingCancelledDatesHolidaysAndApprovedLeaveAreNotRewritten()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new WorkSchedule { EmployeeID = f.H.Self, ShiftID = shift, WorkDate = new(2026, 11, 23), Status = "CANCELLED", UniqueWorkKey = "cancelled-intent" });
            var config = await db.Set<SystemSetting>().SingleAsync(s => s.Key == SettingsDefaults.AttendanceKey); var policy = SettingsDefaults.Read<AttendanceSettingsRequest>(config.JsonValue); policy.HolidayDates = [new(2026, 11, 24)]; config.JsonValue = JsonSerializer.Serialize(policy, SettingsDefaults.Json);
            db.Add(new LeaveRequest { EmployeeID = f.H.Self, LeaveTypeID = f.TypeId, FromDate = new(2026, 11, 25), ToDate = new(2026, 11, 25), Status = "APPROVED", RequestedDays = 1 }); await db.SaveChangesAsync();
        }
        Assert.Equal(2, (await Run(f)).Created);
        using var check = f.H.App.Services.CreateScope(); Assert.Equal("CANCELLED", (await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<WorkSchedule>().SingleAsync(s => s.UniqueWorkKey == "cancelled-intent")).Status);
    }
    [Fact]
    public async Task DisabledAndLockedPeriodsDoNotCreateRowsOrCompletionReceipts()
    {
        await using var f = await Fixture.Create(); await Setup(f);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var setting = await db.Set<SystemSetting>().SingleAsync(s => s.Key == SettingsDefaults.AttendanceKey);
            var config = SettingsDefaults.Read<AttendanceSettingsRequest>(setting.JsonValue); config.AutoScheduleEnabled = false; setting.JsonValue = JsonSerializer.Serialize(config, SettingsDefaults.Json); await db.SaveChangesAsync();
        }
        Assert.Equal("DISABLED", (await Run(f)).Status);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var setting = await db.Set<SystemSetting>().SingleAsync(s => s.Key == SettingsDefaults.AttendanceKey); var config = SettingsDefaults.Read<AttendanceSettingsRequest>(setting.JsonValue); config.AutoScheduleEnabled = true; setting.JsonValue = JsonSerializer.Serialize(config, SettingsDefaults.Json); db.Add(new TimesheetPeriod { PeriodKey = "2026-11", Status = "LOCKED" }); await db.SaveChangesAsync();
        }
        Assert.Equal(0, (await Run(f)).Created);
        using var check = f.H.App.Services.CreateScope(); Assert.False(await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<AuditLog>().AnyAsync(a => a.EntityType == "ScheduleAutomation"));
    }
    [Fact]
    public async Task StartupLateOnlyCreatesFutureUnstartedDaysOfCurrentWeek()
    {
        await using var f = await Fixture.Create(); await Setup(f);
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now = new(2026, 11, 24, 5, 0, 0, TimeSpan.Zero); // Tuesday noon Vietnam
        Assert.Equal(3, (await Run(f)).Created);
    }
    [Fact]
    public async Task FailsMidBatchRollsBackSchedulesReceiptsAndNotifications()
    {
        await using var f = await Fixture.Create(); await Setup(f);
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.ExecuteSqlRawAsync("CREATE TRIGGER fail_auto BEFORE INSERT ON work_schedules WHEN NEW.work_date = '2026-11-24' BEGIN SELECT RAISE(ABORT, 'injected failure'); END;");
        await Assert.ThrowsAsync<DbUpdateException>(() => Run(f));
        using var check = f.H.App.Services.CreateScope(); var db = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(5, await db.Set<WorkSchedule>().CountAsync()); Assert.False(await db.Set<AuditLog>().AnyAsync(a => a.EntityType == "ScheduleAutomation")); Assert.False(await db.Set<Notification>().AnyAsync(n => n.ReferenceType == "WORK_SCHEDULE"));
    }
    [Fact]
    public async Task EachEmployeeUsesOwnLatestWeekAndNoHistoryIsNotInvented()
    {
        await using var f = await Fixture.Create(); var shift = await Setup(f);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.AddRange(new Contract { EmployeeID = f.H.Peer, ContractNo = "AUTO-PEER", ContractType = "FIXED_TERM", Status = "ACTIVE", StartDate = new(2026, 1, 1) }, new Contract { EmployeeID = f.H.Other, ContractNo = "AUTO-NOSOURCE", ContractType = "FIXED_TERM", Status = "ACTIVE", StartDate = new(2026, 1, 1) });
            db.Add(new WorkSchedule { EmployeeID = f.H.Peer, ShiftID = shift, WorkDate = new(2026, 11, 9), Status = "CLOSED", UniqueWorkKey = "peer-old-week" }); await db.SaveChangesAsync();
        }
        Assert.Equal(6, (await Run(f)).Created);
        using var check = f.H.App.Services.CreateScope(); var db2 = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.True(await db2.Set<WorkSchedule>().AnyAsync(s => s.EmployeeID == f.H.Peer && s.WorkDate == new DateOnly(2026, 11, 23)));
        Assert.False(await db2.Set<WorkSchedule>().AnyAsync(s => s.EmployeeID == f.H.Other));
    }
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ExpiredOrNotYetStartedContractDoesNotGenerateSchedules(bool future)
    {
        await using var f = await Fixture.Create(); await Setup(f);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            if (future) await db.Set<Contract>().Where(c => c.EmployeeID == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(c => c.StartDate, new DateOnly(2026, 11, 23)));
            else await db.Set<Contract>().Where(c => c.EmployeeID == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(c => c.EndDate, (DateOnly?)new DateOnly(2026, 11, 21)));
        }
        Assert.Equal(0, (await Run(f)).Created);
    }
    [Fact]
    public async Task MultipleReplicasCannotDuplicateWeeklyRowsOrReceipts()
    {
        var path = Path.Combine(Path.GetTempPath(), "weekly-auto-" + Guid.NewGuid() + ".db");
        try
        {
            await using var f = await Fixture.Create(path); await Setup(f);
            async Task<(ScheduleAutomationResult? Result, Exception? Error)> TryRun()
            {
                try { return (await Run(f), null); } catch (Exception error) { return (null, error); }
            }
            var outcomes = await Task.WhenAll(TryRun(), TryRun());
            Assert.Contains(outcomes, o => o.Result?.Created == 5);
            Assert.All(outcomes.Where(o => o.Error != null), o => Assert.True(o.Error is global::System.Data.Common.DbException or DbUpdateException));
            Assert.Equal(0, (await Run(f)).Created);
            using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(10, await db.Set<WorkSchedule>().CountAsync()); Assert.Equal(1, await db.Set<AuditLog>().CountAsync(a => a.EntityType == "ScheduleAutomation")); Assert.Equal(1, await db.Set<Notification>().CountAsync(n => n.ReferenceType == "WORK_SCHEDULE"));
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }

}
