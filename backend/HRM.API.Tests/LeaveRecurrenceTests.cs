using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Leave.Services;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class LeaveRecurrenceTests
{
    private static void Date(Fixture f, DateOnly date) => ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now = new(date.Year, date.Month, date.Day, 5, 0, 0, TimeSpan.Zero);
    private static async Task<long> Prepare(Fixture f, bool peer = false)
    {
        await OrganizationApiTests.Grant(f.H.App, "WEB_SYSTEM_SETTINGS"); await OrganizationApiTests.Login(f.H.Client, f.H.App);
        using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var position = new Position { Code = "RECURRENCE", Name = "Recurring leave", IsActive = true }; db.Add(position); await db.SaveChangesAsync();
        var employeeId = peer ? f.H.Peer : f.H.Self;
        await db.Employees.Where(e => e.Id == employeeId).ExecuteUpdateAsync(s => s.SetProperty(e => e.PositionId, position.ID)); return position.ID;
    }
    private static LeaveAccrualSettingsRequest Policy(long position, int every = 2, string unit = "MONTH") => new()
    {
        Settings = new() { Enabled = true, ScheduleVersion = 2,
            AccrualSchedule = new() { StartDate = new(2026, 11, 17), Interval = every, Unit = unit },
            Rules = [new() { PositionId = position, DaysPerCycle = 3 }] }
    };
    private static async Task<LeaveAccrualRunView> Run(Fixture f)
    {
        var response = await f.H.Client.PostAsync("/api/system-settings/leave-accrual/run", null); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<LeaveAccrualRunView>())!;
    }
    [Theory]
    [InlineData("2027-01-31", 1, "MONTH", "2027-02-28", "2027-02-28")]
    [InlineData("2027-01-31", 1, "MONTH", "2027-03-30", "2027-02-28")]
    [InlineData("2027-01-31", 1, "MONTH", "2027-03-31", "2027-03-31")]
    [InlineData("2026-11-17", 2, "MONTH", "2027-01-16", null)]
    [InlineData("2026-11-17", 2, "MONTH", "2027-01-17", "2027-01-17")]
    [InlineData("2028-02-29", 1, "YEAR", "2029-02-28", "2029-02-28")]
    [InlineData("2028-02-29", 1, "YEAR", "2032-02-29", "2032-02-29")]
    public void CalendarUsesFullIntervalsWithoutMonthEndDrift(string start, int interval, string unit, string today, string? expected)
    {
        var due = LeaveRecurrenceCalendar.Latest(new() { StartDate = DateOnly.Parse(start), Interval = interval, Unit = unit }, DateOnly.Parse(today));
        Assert.Equal(expected == null ? (DateOnly?)null : DateOnly.Parse(expected), due);
    }
    [Fact]
    public async Task TwoMonthScheduleStartsAfterTwoMonthsDefaultsToAnnualAndNeverCreditsTwice()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(position);
        var save = await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy); save.EnsureSuccessStatusCode();
        var settings = (await save.Content.ReadFromJsonAsync<LeaveAccrualSettingsView>())!;
        Assert.Equal(f.TypeId, settings.DefaultLeaveTypeId); Assert.Equal(f.TypeId, settings.Settings.Rules[0].LeaveTypeId);
        Assert.Equal(new DateOnly(2027, 1, 17), settings.FirstAccrualDate);
        Assert.Equal(0, (await Run(f)).CreditedBalances); Date(f, new(2026, 12, 17)); Assert.Equal(0, (await Run(f)).CreditedBalances);
        Date(f, new(2027, 1, 17)); Assert.Equal(1, (await Run(f)).CreditedBalances); Assert.True((await Run(f)).AccrualAlreadyProcessed);
        Date(f, new(2027, 3, 17)); Assert.Equal(1, (await Run(f)).CreditedBalances);
        var balance = Assert.Single((await f.H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?view=MY&year=2027"))!.Data); Assert.Equal(6, balance.EntitledDays);
    }
    [Fact]
    public async Task EmployeeWithoutQuotaIsSkippedAtResetAndCreatedOnlyWhenCreditIsDue()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f, peer: true); var policy = Policy(position);
        policy.Settings.ResetSchedule = new() { StartDate = new(2026, 11, 17), Interval = 1, Unit = "MONTH" };
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Date(f, new(2026, 12, 17)); var run = await Run(f); Assert.Equal(0, run.ExpiredBalances); Assert.Equal(0, run.CreditedBalances);
        using (var scope = f.H.App.Services.CreateScope()) Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveBalance>().AnyAsync(b => b.EmployeeID == f.H.Peer));
        Date(f, new(2027, 1, 17)); run = await Run(f); Assert.Equal(0, run.ExpiredBalances); Assert.Equal(1, run.CreditedBalances);
        using (var scope = f.H.App.Services.CreateScope()) Assert.Equal(3, (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveBalance>().SingleAsync(b => b.EmployeeID == f.H.Peer)).EntitledDays);
    }
    [Fact]
    public async Task YearlyGrantAndResetAreIndependentAndPreserveHistoricalAllocation()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(position, 1, "YEAR"); policy.Settings.Rules[0].DaysPerCycle = 12;
        policy.Settings.ResetSchedule = new() { StartDate = new(2026, 11, 17), Interval = 1, Unit = "YEAR" };
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Assert.Equal(0, (await Run(f)).ExpiredBalances); Date(f, new(2027, 11, 17)); var run = await Run(f); Assert.Equal(1, run.ExpiredBalances); Assert.Equal(1, run.CreditedBalances);
        Date(f, new(2028, 11, 17)); run = await Run(f); Assert.Equal(1, run.ExpiredBalances); Assert.Equal(1, run.CreditedBalances);
        using var scope = f.H.App.Services.CreateScope(); var balances = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveBalance>().Where(b => b.EmployeeID == f.H.Self).ToListAsync();
        var previous = balances.Single(b => b.YearNo == 2027); Assert.Equal(12, previous.EntitledDays); Assert.Equal(-12, previous.AdjustmentDays);
        Assert.Equal(12, balances.Single(b => b.YearNo == 2028).EntitledDays);
    }
    [Fact]
    public async Task ResetOnlyDoesNotRequireAnAccrualAmountAndDoesNotCreateRows()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(position);
        policy.Settings.AccrualSchedule = null; policy.Settings.Rules[0].DaysPerCycle = null;
        policy.Settings.ResetSchedule = new() { StartDate = new(2026, 11, 17), Interval = 1, Unit = "MONTH" };
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Assert.Equal(0, (await Run(f)).ExpiredBalances); Date(f, new(2026, 12, 17)); var run = await Run(f);
        Assert.Equal(1, run.ExpiredBalances); Assert.Equal(0, run.CreditedBalances); Assert.Equal(0, (await f.Balance()).AvailableDays);
    }
    [Fact]
    public async Task InvalidIntervalsAndMissingAnnualCatalogAreRejected()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(position);
        policy.Settings.AccrualSchedule!.Interval = 0;
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).StatusCode);
        policy.Settings.AccrualSchedule.Interval = 2;
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Date(f, new(2027, 1, 17)); policy.Version = 1; policy.Settings.AccrualSchedule.Interval = 1;
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        policy.Version = 2;
        Date(f, new(2026, 11, 17)); policy.Settings.AccrualSchedule.Interval = 2; policy.Settings.Rules[0].LeaveTypeId = null;
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveType>().Where(t => t.ID == f.TypeId).ExecuteUpdateAsync(s => s.SetProperty(t => t.Code, "OTHER"));
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).StatusCode);
    }
    [Fact]
    public async Task PastAnchorIsAllowedWhenItsFirstAnnualActivationIsStillFuture()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(position, 1, "YEAR");
        policy.Settings.AccrualSchedule!.StartDate = new(2026, 1, 1);
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Assert.Equal(0, (await Run(f)).CreditedBalances);
        Date(f, new(2027, 1, 1)); Assert.Equal(1, (await Run(f)).CreditedBalances);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task OverdueCycleCreatesMissingQuotaAndRetriesOldZeroReceipt(bool oldReceipt)
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f, peer: true); var policy = Policy(position, 1);
        policy.Settings.AccrualSchedule!.StartDate = new(2026, 10, 16);
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Employees.Where(e => e.Id == f.H.Peer).ExecuteUpdateAsync(s => s.SetProperty(e => e.PositionId, (long?)null));
            if (oldReceipt) { db.Add(new HRM.API.Modules.System.Entities.AuditLog { EntityType = "LeaveAutomation", EntityID = "accrual-cycle:20261116", Action = "LEAVE_ACCRUAL_COMPLETED", AfterJSON = "{\"creditedBalances\":0}", CreatedAt = DateTime.UtcNow }); await db.SaveChangesAsync(); }
        }
        var empty = await Run(f); Assert.Equal("NO_MATCHING_EMPLOYEES", empty.Status); Assert.Equal(new DateOnly(2026, 11, 16), empty.NextAccrualDate);
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Employees.Where(e => e.Id == f.H.Peer).ExecuteUpdateAsync(s => s.SetProperty(e => e.PositionId, position));
        var result = await Run(f); Assert.Equal(1, result.CreditedBalances); Assert.Equal(new DateOnly(2026, 11, 16), result.AccrualDueDate); Assert.Equal(new DateOnly(2026, 12, 16), result.NextAccrualDate);
        Assert.True((await Run(f)).AccrualAlreadyProcessed);
        var settings = (await f.H.Client.GetFromJsonAsync<LeaveAccrualSettingsView>("/api/system-settings/leave-accrual"))!;
        Assert.Equal(new DateOnly(2026, 10, 16), settings.Settings.AccrualSchedule!.StartDate); Assert.Equal(result.NextAccrualDate, settings.NextAccrualDate);
        using var check = f.H.App.Services.CreateScope(); Assert.Equal(3, (await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveBalance>().SingleAsync(b => b.EmployeeID == f.H.Peer)).EntitledDays);
    }

}
