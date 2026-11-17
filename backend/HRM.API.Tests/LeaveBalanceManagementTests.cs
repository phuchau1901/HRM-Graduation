using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Leave.Services;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class LeaveBalanceManagementTests
{
    private static object Grant(Fixture f, Guid operation, string target = "ALL", int? employeeId = null, int? departmentId = null, decimal days = 12)
        => new { operationId = operation, target, employeeId, departmentId, leaveTypeId = f.TypeId, year = 2027, entitledDays = days, carriedOverDays = 2, reason = "Annual allocation" };
    private static async Task Scope(Fixture f, string view, string update)
    {
        using var services = f.H.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        var screen = await db.Screens.SingleAsync(s => s.Code == LeaveWorkflowService.Balances);
        await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "VIEW").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, view));
        await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "UPDATE").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, update));
    }
    [Fact]
    public async Task AllocationAdjustmentFormulasReasonVersionAndHistoryAreEnforced()
    {
        await using var f = await Fixture.Create(); var balance = await f.Balance();
        using (var scope = f.H.App.Services.CreateScope())
        {
            var expected = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Employees.Where(e => e.Id == f.H.Self).Select(e => e.EmployeeCode).SingleAsync();
            Assert.Equal(expected, balance.EmployeeCode); Assert.False(string.IsNullOrWhiteSpace(balance.EmployeeCode));
        }
        var response = await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 10, carriedOverDays = 3, version = balance.Version, reason = "Carryover approved" }); response.EnsureSuccessStatusCode();
        balance = (await response.Content.ReadFromJsonAsync<BalanceView>())!; Assert.Equal(13, balance.RemainingDays); Assert.Equal(13, balance.AvailableDays);
        response = await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = balance.Version, days = -1.5, reason = "Correct imported allocation" }); response.EnsureSuccessStatusCode();
        var adjusted = (await response.Content.ReadFromJsonAsync<BalanceView>())!; Assert.Equal(-1.5m, adjusted.AdjustmentDays); Assert.Equal(11.5m, adjusted.AvailableDays);
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = balance.Version, days = 1, reason = "Stale" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = adjusted.Version, days = 1, reason = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = adjusted.Version, days = 0, reason = "Noop" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = adjusted.Version, days = 0.001, reason = "Precision" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = adjusted.Version, days = -99, reason = "Too low" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 99, version = adjusted.Version })).StatusCode);
        var history = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceHistoryView>>($"/api/leave-balances/{balance.Id}/history?pageSize=1"))!;
        Assert.Equal(3, history.Total); Assert.Contains("Correct imported allocation", Assert.Single(history.Data).AfterJson);
        Assert.Equal(adjusted.Version, (await f.Balance()).Version);
    }
    [Fact]
    public async Task LeaveUsesCarryoverAndAdjustmentsAndRefundsExactlyOnce()
    {
        await using var f = await Fixture.Create(); var balance = await f.Balance();
        (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 0, carriedOverDays = 1, version = balance.Version, reason = "Transfer" })).EnsureSuccessStatusCode();
        balance = await f.Balance();
        (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = balance.Version, days = 1, reason = "Additional day" })).EnsureSuccessStatusCode();
        var request = await f.Submit(); balance = await f.Balance(); Assert.Equal(2, balance.ReservedDays); Assert.Equal(2, balance.RemainingDays); Assert.Equal(0, balance.AvailableDays);
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{balance.Id}/adjustments", new { version = balance.Version, days = -1, reason = "Reserved days cannot be removed" })).StatusCode);
        await f.ApproveAll(request.ApprovalId); balance = await f.Balance(); Assert.Equal(2, balance.UsedDays); Assert.Equal(0, balance.ReservedDays); Assert.Equal(0, balance.RemainingDays);
        var leave = (await f.H.Client.GetFromJsonAsync<LeaveView>($"/api/leave-requests/{request.Id}"))!;
        var cancel = await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = leave.Version, reason = "No longer required" }); cancel.EnsureSuccessStatusCode();
        var cancellation = (await cancel.Content.ReadFromJsonAsync<WorkflowReceipt>())!; await f.ApproveAll(cancellation.ApprovalId);
        Assert.Equal(2, (await f.Balance()).AvailableDays);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Decide(cancellation.ApprovalId, "hr")).StatusCode);
        var history = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceHistoryView>>($"/api/leave-balances/{balance.Id}/history"))!;
        Assert.Single(history.Data, h => h.Action == "LEAVE_BALANCE_USE"); Assert.Single(history.Data, h => h.Action == "LEAVE_BALANCE_REFUND");
    }
    [Fact]
    public async Task BulkGrantIsCreateOnlyIdempotentAndRejectsOperationReuseWithAnotherPayload()
    {
        await using var f = await Fixture.Create(); var operation = Guid.NewGuid(); var body = Grant(f, operation);
        var response = await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", body); response.EnsureSuccessStatusCode();
        var receipt = (await response.Content.ReadFromJsonAsync<BalanceGrantReceipt>())!; Assert.True(receipt.Created > 1); Assert.Equal(receipt.Selected, receipt.Created);
        var replay = await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", body); replay.EnsureSuccessStatusCode(); Assert.Equal(receipt, await replay.Content.ReadFromJsonAsync<BalanceGrantReceipt>());
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", Grant(f, operation, days: 20))).StatusCode);
        var second = await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", Grant(f, Guid.NewGuid(), days: 99)); second.EnsureSuccessStatusCode();
        var skipped = (await second.Content.ReadFromJsonAsync<BalanceGrantReceipt>())!; Assert.Equal(0, skipped.Created); Assert.Equal(receipt.Selected, skipped.Skipped);
        var balances = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?year=2027"))!; Assert.Equal(receipt.Selected, balances.Total); Assert.All(balances.Data, b => { Assert.Equal(12, b.EntitledDays); Assert.Equal(2, b.CarriedOverDays); Assert.Equal(14, b.AvailableDays); });
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", Grant(f, Guid.Empty))).StatusCode);
    }
    [Fact]
    public async Task DepartmentScopeBoundsBulkAndHistoryWhileSelfCannotWrite()
    {
        await using var f = await Fixture.Create(); var operation = Guid.NewGuid();
        await Scope(f, "DEPARTMENT", "DEPARTMENT");
        var grant = await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", Grant(f, operation)); grant.EnsureSuccessStatusCode();
        var receipt = (await grant.Content.ReadFromJsonAsync<BalanceGrantReceipt>())!;
        var balances = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?year=2027"))!; Assert.Equal(receipt.Selected, balances.Total); Assert.DoesNotContain(balances.Data, b => b.EmployeeId == f.H.Other);
        Assert.Equal(HttpStatusCode.NotFound, (await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", Grant(f, Guid.NewGuid(), "EMPLOYEE", f.H.Other))).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.H.Client.GetAsync("/api/leave-balances?year=2027&departmentId=" + f.H.Department + "&leaveTypeId=" + f.TypeId + "&search=Self")).StatusCode);
        var peer = balances.Data.First(b => b.EmployeeId != f.H.Self);
        await Scope(f, "SELF", "SELF");
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", Grant(f, operation))).StatusCode);
        var own = await f.Balance();
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync($"/api/leave-balances/{own.Id}/adjustments", new { version = own.Version, days = 1, reason = "Self" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 99, version = own.Version, reason = "Self" })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await f.H.Client.GetAsync($"/api/leave-balances/{peer.Id}/history")).StatusCode);
    }
    [Fact]
    public async Task IdempotencyReplayDoesNotDisclosePreviouslyBroaderScopeCounts()
    {
        await using var f = await Fixture.Create(); var operation = Guid.NewGuid(); var body = Grant(f, operation);
        (await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", body)).EnsureSuccessStatusCode();
        await Scope(f, "DEPARTMENT", "DEPARTMENT");
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/leave-balances/grants", body)).StatusCode);
    }
    [Fact]
    public async Task LeaveWithoutBalanceRequirementDoesNotCreateOrTouchBalance()
    {
        await using var f = await Fixture.Create();
        var response = await f.H.Client.PostAsJsonAsync("/api/leave-types", new { code = "UNPAID_BALANCE_TEST", name = "Unpaid", requiresBalance = false }); response.EnsureSuccessStatusCode();
        f.TypeId = (await response.Content.ReadFromJsonAsync<LeaveTypeView>())!.Id;
        var request = await f.Submit(); await f.ApproveAll(request.ApprovalId);
        using var scope = f.H.App.Services.CreateScope(); Assert.False(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<LeaveBalance>().AnyAsync(b => b.LeaveTypeID == f.TypeId));
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ConcurrentGrantAndAdjustmentCannotApplyTwice(bool adjustment)
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-balance-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            await using var f = await Fixture.Create(path); var balance = await f.Balance(); var operation = Guid.NewGuid();
            var url = adjustment ? $"/api/leave-balances/{balance.Id}/adjustments" : "/api/leave-balances/grants";
            object body = adjustment ? new { version = balance.Version, days = 1, reason = "Concurrent correction" } : Grant(f, operation);
            var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => f.H.Client.PostAsJsonAsync(url, body)));
            Assert.Contains(responses, r => r.StatusCode == HttpStatusCode.OK); Assert.All(responses, r => Assert.Contains(r.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict }));
            if (adjustment) { Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK); Assert.Equal(1, (await f.Balance()).AdjustmentDays); }
            else
            {
                (await f.H.Client.PostAsJsonAsync(url, body)).EnsureSuccessStatusCode();
                using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                Assert.Equal(1, await db.Set<AuditLog>().CountAsync(a => a.EntityType == "LeaveBalanceGrant" && a.EntityID == operation.ToString("N")));
                var groups = await db.Set<LeaveBalance>().Where(b => b.YearNo == 2027).GroupBy(b => new { b.EmployeeID, b.LeaveTypeID, b.YearNo }).Select(g => g.Count()).ToListAsync(); Assert.All(groups, n => Assert.Equal(1, n));
            }
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
}
