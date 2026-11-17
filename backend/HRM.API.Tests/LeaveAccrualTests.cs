using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Leave.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class LeaveAccrualTests
{
    private static void Date(Fixture f, DateOnly date) => ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now = new(date.Year, date.Month, date.Day, 5, 0, 0, TimeSpan.Zero);
    private static async Task<long> Prepare(Fixture f)
    {
        await OrganizationApiTests.Grant(f.H.App, "WEB_SYSTEM_SETTINGS"); await OrganizationApiTests.Login(f.H.Client, f.H.App);
        using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var position = new Position { Code = "ACCRUAL_TEST", Name = "Accrual position", IsActive = true }; db.Add(position); await db.SaveChangesAsync();
        await db.Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.PositionId, position.ID)); return position.ID;
    }
    private static LeaveAccrualSettingsRequest Policy(Fixture f, long position, DateOnly from, int day = 17) => new()
    {
        Version = 0, Settings = new() { Enabled = true, EffectiveFrom = from, AccrualDay = day,
            Rules = [new() { PositionId = position, LeaveTypeId = f.TypeId, DaysPerMonth = 1.5m }] }
    };
    private static async Task<LeaveAccrualRunView> Run(Fixture f)
    {
        var response = await f.H.Client.PostAsync("/api/system-settings/leave-accrual/run", null); response.EnsureSuccessStatusCode(); return (await response.Content.ReadFromJsonAsync<LeaveAccrualRunView>())!;
    }
    [Fact]
    public async Task MonthlyAccrualMatchesPositionAndRunsOnceAcrossRuleChangesAndYearReset()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(f, position, new(2026, 11, 17)); policy.Settings.ResetOn = new(2027, 1, 1);
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Assert.Equal(1, (await Run(f)).CreditedBalances); Assert.Equal(11.5m, (await f.Balance()).EntitledDays);
        Assert.True((await Run(f)).AccrualAlreadyProcessed);
        policy.Version = 1; policy.Settings.Rules[0].DaysPerMonth = 2;
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode(); Assert.Equal(0, (await Run(f)).CreditedBalances);
        Date(f, new(2026, 12, 17)); Assert.Equal(1, (await Run(f)).CreditedBalances); Assert.Equal(13.5m, (await f.Balance()).EntitledDays);
        Date(f, new(2027, 1, 17)); var run = await Run(f); Assert.Equal(1, run.ExpiredBalances); Assert.Equal(1, run.CreditedBalances);
        var balances = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?view=MY"))!.Data;
        Assert.Equal(0, balances.Single(b => b.Year == 2026).AvailableDays); Assert.Equal(13.5m, balances.Single(b => b.Year == 2026).EntitledDays);
        Assert.Equal(2, balances.Single(b => b.Year == 2027).AvailableDays);
        await using var scope = f.H.App.Services.CreateAsyncScope(); Assert.Equal(0, (await scope.ServiceProvider.GetRequiredService<LeaveWorkflowService>().RunScheduledAccrual(default)).CreditedBalances);
    }
    [Fact]
    public async Task CustomResetPreservesReservedAndUsedHistoryAndDoesNotRepeat()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(f, position, new(2026, 11, 17)); policy.Settings.ResetOn = new(2026, 11, 18); policy.Settings.RepeatResetYearly = false;
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode(); await Run(f);
        var workflow = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = workflow.Version, Routes = [new WorkflowRoute { RequestType = "LEAVE", Steps = [new WorkflowStepRule { ApproverType = "TEAM_LEAD" }] }] })).EnsureSuccessStatusCode();
        var approved = await f.Submit(); (await f.Decide(approved.ApprovalId, "lead")).EnsureSuccessStatusCode();
        (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody("2026-11-25", "2026-11-26"))).EnsureSuccessStatusCode();
        Date(f, new(2026, 11, 18)); Assert.Equal(1, (await Run(f)).ExpiredBalances);
        var balance = await f.Balance(); Assert.Equal(0, balance.AvailableDays); Assert.Equal(2, balance.ReservedDays); Assert.Equal(2, balance.RemainingDays); Assert.Equal(2, balance.UsedDays);
        Assert.True((await Run(f)).ResetAlreadyProcessed); Assert.Equal(balance.Version, (await f.Balance()).Version);
        var history = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceHistoryView>>($"/api/leave-balances/{balance.Id}/history"))!;
        Assert.Single(history.Data, h => h.Action == "LEAVE_BALANCE_EXPIRED");
    }
    [Theory]
    [InlineData("ACTIVE_ON_DATE", true)]
    [InlineData("ONE_MONTH", true)]
    [InlineData("TOO_NEW", false)]
    public async Task MonthEndClampingAndNewHireEligibilityAreConfigurable(string eligibility, bool expected)
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); Date(f, new(2027, 1, 31));
        using (var scope = f.H.App.Services.CreateScope()) await scope.ServiceProvider.GetRequiredService<AppDbContext>().Employees.Where(e => e.Id == f.H.Self).ExecuteUpdateAsync(s => s.SetProperty(e => e.HireDate, eligibility == "TOO_NEW" ? new DateOnly(2027, 2, 1) : new DateOnly(2027, 1, 31)));
        var policy = Policy(f, position, new(2027, 1, 31), 31); policy.Settings.NewHireEligibility = eligibility == "TOO_NEW" ? "ONE_MONTH" : eligibility;
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode(); Date(f, new(2027, 2, 28));
        Assert.Equal(expected ? 1 : 0, (await Run(f)).CreditedBalances);
    }
    [Fact]
    public async Task ResetDoesNotRetroactivelyCreditEarlierInTheSameMonth()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var policy = Policy(f, position, new(2026, 11, 17)); policy.Settings.ResetOn = new(2026, 11, 20);
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode(); Date(f, new(2026, 11, 21));
        var run = await Run(f); Assert.Equal(1, run.ExpiredBalances); Assert.Equal(0, run.CreditedBalances); Assert.Equal(0, (await f.Balance()).AvailableDays);
        Date(f, new(2026, 12, 17)); Assert.Equal(1, (await Run(f)).CreditedBalances); Assert.Equal(1.5m, (await f.Balance()).AvailableDays);
    }
    [Fact]
    public async Task SettingsRequireSystemPermissionAndGlobalBalanceAuthorityAndValidateVersion()
    {
        await using var f = await Fixture.Create(); Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.GetAsync("/api/system-settings/leave-accrual")).StatusCode);
        var position = await Prepare(f); var policy = Policy(f, position, new(2026, 11, 17));
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).StatusCode);
        policy.Version = 1; policy.Settings.Rules = [new() { PositionId = int.MaxValue, LeaveTypeId = f.TypeId, DaysPerMonth = 1 }];
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).StatusCode);
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(s => s.Code == "WEB_LEAVE_BALANCES");
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "UPDATE").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "DEPARTMENT"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsync("/api/system-settings/leave-accrual/run", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).StatusCode);
    }
    [Fact]
    public async Task DisabledPolicyDoesNotMutateBalancesAndConcurrentRunsOnlyCreditOnce()
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-accrual-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            await using var f = await Fixture.Create(path); var position = await Prepare(f); var policy = Policy(f, position, new(2026, 11, 17)); policy.Settings.Enabled = false;
            (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode(); Assert.Equal(0, (await Run(f)).CreditedBalances);
            policy.Version = 1; policy.Settings.Enabled = true; (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
            var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => f.H.Client.PostAsync("/api/system-settings/leave-accrual/run", null)));
            Assert.Contains(responses, r => r.StatusCode == HttpStatusCode.OK); Assert.All(responses, r => Assert.Contains(r.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }));
            await Run(f); Assert.Equal(11.5m, (await f.Balance()).EntitledDays);
            using var scope = f.H.App.Services.CreateScope(); Assert.Equal(1, await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<AuditLog>().CountAsync(a => a.EntityType == "LeaveAutomation" && a.EntityID == "accrual:202611"));
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
    [Fact]
    public async Task FailedCreditRollsBackResetReceiptsAndAllBalanceChanges()
    {
        await using var f = await Fixture.Create(); var position = await Prepare(f); var balance = await f.Balance();
        (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 99999, version = balance.Version, reason = "Boundary setup" })).EnsureSuccessStatusCode();
        var policy = Policy(f, position, new(2026, 11, 17)); policy.Settings.ResetOn = new(2026, 11, 17);
        (await f.H.Client.PutAsJsonAsync("/api/system-settings/leave-accrual", policy)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsync("/api/system-settings/leave-accrual/run", null)).StatusCode);
        balance = await f.Balance(); Assert.Equal(99999, balance.EntitledDays); Assert.Equal(0, balance.AdjustmentDays);
        using var scope = f.H.App.Services.CreateScope(); Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<AuditLog>().AnyAsync(a => a.EntityType == "LeaveAutomation"));
    }

}
