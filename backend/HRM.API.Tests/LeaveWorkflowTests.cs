using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Leave.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Notifications.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
namespace HRM.API.Tests;
public sealed class LeaveWorkflowTests
{
    internal sealed class Fixture : IAsyncDisposable
    {
        internal EmployeeApiTests.Harness H = null!;
        internal long TypeId;
        private readonly Dictionary<string, string> tokens = new();
        internal static async Task<Fixture> Create(string? path = null)
        {
            var f = new Fixture { H = await EmployeeApiTests.Harness.Create("ALL", clock: new AttendanceTestClock { Now = new(2026, 11, 17, 5, 0, 0, TimeSpan.Zero) }, sqlitePath: path) };
            foreach (var code in new[] { LeaveWorkflowService.Leave, LeaveWorkflowService.Types, LeaveWorkflowService.Balances, LeaveWorkflowService.Overtime, LeaveWorkflowService.Approvals, LeaveWorkflowService.Adjustments, LeaveWorkflowService.Configuration })
                await OrganizationApiTests.Grant(f.H.App, code);
            using (var services = f.H.App.Services.CreateScope())
            {
                var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); var passwords = services.ServiceProvider.GetRequiredService<PasswordService>();
                var root = await db.Set<Role>().SingleAsync(r => r.Code == "HR");
                foreach (var screen in await db.Screens.Where(s => s.Code.StartsWith("WEB_")).ToListAsync())
                    foreach (var action in new[] { "VIEW", "NEW", "UPDATE", "APPROVE" })
                        if (!await db.Set<RoleScreenAction>().AnyAsync(g => g.RoleID == root.ID && g.ScreenID == screen.ID && g.ActionCode == action)) db.Add(new RoleScreenAction { RoleID = root.ID, ScreenID = screen.ID, ActionCode = action, DataScope = "ALL" });
                var manager = new Employee { EmployeeCode = "MANAGER", FullName = "Manager", Email = "manager@example.invalid", DepartmentId = f.H.Department, HireDate = new(2020, 1, 1) };
                var team = new Team { TeamCode = "WORKFLOW", TeamName = "Workflow", DepartmentId = f.H.Department, LeadEmployeeId = f.H.Peer };
                db.AddRange(manager, team); await db.SaveChangesAsync();
                await db.Employees.Where(e => e.Id == f.H.Self || e.Id == f.H.Peer).ExecuteUpdateAsync(s => s.SetProperty(e => e.TeamId, team.Id));
                await db.Departments.Where(d => d.Id == f.H.Department).ExecuteUpdateAsync(s => s.SetProperty(d => d.ManagerEmployeeId, manager.Id));
                var approvalScreen = await db.Screens.SingleAsync(s => s.Code == LeaveWorkflowService.Approvals);
                foreach (var (userId, employee, roleCode, dataScope) in new[] { ("lead", (int?)f.H.Peer, "LEAD", "DEPARTMENT"), ("manager", (int?)manager.Id, "MANAGER", "DEPARTMENT"), ("hr", (int?)null, "HR_APPROVER", "ALL") })
                {
                    var role = new Role { Code = roleCode, Name = roleCode }; var hash = passwords.Hash(f.H.App.Password);
                    db.AddRange(role, new User { UserId = userId, Email = userId + "@example.invalid", EmployeeId = employee, Status = "ACTIVE", PasswordHash = hash.PasswordHash, Salt = hash.Salt }); await db.SaveChangesAsync();
                    db.AddRange(new UserRole { UserID = userId, RoleID = role.ID }, new RoleDetail { RoleID = role.ID, ScreenID = approvalScreen.ID, CanView = "Y", CanApprove = "Y" },
                        new RoleScreenAction { RoleID = role.ID, ScreenID = approvalScreen.ID, ActionCode = "VIEW", DataScope = dataScope }, new RoleScreenAction { RoleID = role.ID, ScreenID = approvalScreen.ID, ActionCode = "APPROVE", DataScope = dataScope });
                }
                await db.SaveChangesAsync();
            }
            await OrganizationApiTests.Login(f.H.Client, f.H.App);
            var type = await f.H.Client.PostAsJsonAsync("/api/leave-types", new { code = "ANNUAL", name = "Annual leave", paid = true, requiresBalance = true }); type.EnsureSuccessStatusCode();
            f.TypeId = (await type.Content.ReadFromJsonAsync<LeaveTypeView>())!.Id;
            (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 10, version = 0 })).EnsureSuccessStatusCode();
            var steps = new[] { new WorkflowStepRule { ApproverType = "TEAM_LEAD" }, new WorkflowStepRule { ApproverType = "DEPARTMENT_MANAGER" }, new WorkflowStepRule { ApproverType = "HR", UserId = "hr", RoleCode = "HR_APPROVER" } };
            (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = 0, Routes = new[] { "LEAVE", "OVERTIME", "ATTENDANCE_ADJUSTMENT" }.Select(kind => new WorkflowRoute { RequestType = kind, Steps = steps }).ToArray() })).EnsureSuccessStatusCode();
            return f;
        }
        internal object LeaveBody(string from = "2026-11-23", string to = "2026-11-24") => new { leaveTypeId = TypeId, fromDate = from, toDate = to, reason = "Family" };
        internal async Task<WorkflowReceipt> Submit()
        { var response = await H.Client.PostAsJsonAsync("/api/leave-requests", LeaveBody()); Assert.Equal(HttpStatusCode.Created, response.StatusCode); return (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!; }
        internal async Task<HttpClient> As(string user)
        {
            var client = H.App.CreateClient(new() { BaseAddress = new("https://localhost") });
            if (user == "api-user") { client.DefaultRequestHeaders.Authorization = H.Client.DefaultRequestHeaders.Authorization; return client; }
            if (tokens.TryGetValue(user, out var token)) { client.DefaultRequestHeaders.Authorization = new("Bearer", token); return client; }
            var login = await client.PostAsJsonAsync("/api/auth/login", new { userId = user, password = H.App.Password }); login.EnsureSuccessStatusCode();
            tokens[user] = (await login.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken;
            client.DefaultRequestHeaders.Authorization = new("Bearer", tokens[user]); return client;
        }
        internal async Task<HttpResponseMessage> Decide(long id, string user, bool approve = true)
        {
            using var client = await As(user);
            var detail = (await client.GetFromJsonAsync<ApprovalDetail>($"/api/approvals/{id}"))!;
            return await client.PostAsJsonAsync($"/api/approvals/{id}/{(approve ? "approve" : "reject")}", new { version = detail.Request.Version, reason = approve ? "Approved" : "Rejected" });
        }
        internal async Task ApproveAll(long id) { foreach (var user in new[] { "lead", "manager", "hr" }) (await Decide(id, user)).EnsureSuccessStatusCode(); }
        internal async Task<BalanceView> Balance() => Assert.Single((await H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?view=MY&year=2026"))!.Data);
        public ValueTask DisposeAsync() => H.DisposeAsync();
    }
    [Fact]
    public async Task ReservesAtSubmissionUsesBalanceOnlyAfterFinalDecisionAndNotifiesInOrder()
    {
        await using var f = await Fixture.Create(); var request = await f.Submit();
        var balance = await f.Balance(); Assert.Equal(2, balance.ReservedDays); Assert.Equal(0, balance.UsedDays);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Decide(request.ApprovalId, "manager")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Decide(request.ApprovalId, "api-user")).StatusCode);
        (await f.Decide(request.ApprovalId, "lead")).EnsureSuccessStatusCode(); Assert.Equal(0, (await f.Balance()).UsedDays);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Decide(request.ApprovalId, "lead")).StatusCode);
        (await f.Decide(request.ApprovalId, "manager")).EnsureSuccessStatusCode(); (await f.Decide(request.ApprovalId, "hr")).EnsureSuccessStatusCode();
        balance = await f.Balance(); Assert.Equal(2, balance.UsedDays); Assert.Equal(0, balance.ReservedDays);
        Assert.Equal(HttpStatusCode.Conflict, (await f.Decide(request.ApprovalId, "hr")).StatusCode);
        var history = (await f.H.Client.GetFromJsonAsync<PageResult<ApprovalHistoryView>>($"/api/approvals/{request.ApprovalId}/history"))!; Assert.Equal(4, history.Total);
        using var services = f.H.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(4, await db.Set<Notification>().CountAsync(n => n.Source == "WORKFLOW"));
        Assert.Equal(4, await db.Set<NotificationOutbox>().CountAsync());
    }
    [Fact]
    public async Task OverlapAndInsufficientBalanceAreRejectedWithoutExtraReservations()
    {
        await using var f = await Fixture.Create(); await f.Submit();
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody("2026-11-25", "2026-11-20"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody("2026-12-01", "2026-12-31"))).StatusCode);
        Assert.Equal(2, (await f.Balance()).ReservedDays);
    }
    [Fact]
    public async Task RejectAndPendingCancelReleaseReservationsAndCannotRunTwice()
    {
        await using var f = await Fixture.Create(); var request = await f.Submit();
        (await f.Decide(request.ApprovalId, "lead", false)).EnsureSuccessStatusCode(); Assert.Equal(0, (await f.Balance()).ReservedDays);
        request = await f.Submit();
        var response = await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = request.Version, reason = "Changed plans" }); response.EnsureSuccessStatusCode();
        Assert.Equal(0, (await f.Balance()).ReservedDays); Assert.Equal(0, (await f.Balance()).UsedDays);
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = request.Version, reason = "Again" })).StatusCode);
    }
    [Fact]
    public async Task ApprovedLeaveCancellationUsesAnotherFullWorkflowBeforeRefund()
    {
        await using var f = await Fixture.Create(); var request = await f.Submit(); await f.ApproveAll(request.ApprovalId);
        var leave = (await f.H.Client.GetFromJsonAsync<LeaveView>($"/api/leave-requests/{request.Id}"))!;
        var response = await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = leave.Version, reason = "No longer needed" }); response.EnsureSuccessStatusCode();
        var cancellation = (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!;
        Assert.NotEqual(request.ApprovalId, cancellation.ApprovalId); Assert.Equal(2, (await f.Balance()).UsedDays);
        await f.ApproveAll(cancellation.ApprovalId); Assert.Equal(0, (await f.Balance()).UsedDays);
        Assert.Equal("CANCELLED", (await f.H.Client.GetFromJsonAsync<LeaveView>($"/api/leave-requests/{request.Id}"))!.Status);
    }
    [Fact]
    public async Task OvertimeHoursAreDerivedAndNeverApprovedWhilePending()
    {
        await using var f = await Fixture.Create();
        var response = await f.H.Client.PostAsJsonAsync("/api/overtime-requests", new { startAt = "2026-11-24T18:00:00+07:00", endAt = "2026-11-24T20:30:00+07:00", reason = "Release" }); response.EnsureSuccessStatusCode();
        var request = (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!;
        var row = (await f.H.Client.GetFromJsonAsync<OvertimeView>($"/api/overtime-requests/{request.Id}"))!;
        Assert.Equal(2.5m, row.RequestedHours); Assert.Null(row.ApprovedHours);
        Assert.Equal(HttpStatusCode.Conflict, (await f.H.Client.PostAsJsonAsync("/api/overtime-requests", new { startAt = "2026-11-24T19:00:00+07:00", endAt = "2026-11-24T21:00:00+07:00", reason = "Overlap" })).StatusCode);
        await f.ApproveAll(request.ApprovalId);
        Assert.Equal(2.5m, (await f.H.Client.GetFromJsonAsync<OvertimeView>($"/api/overtime-requests/{request.Id}"))!.ApprovedHours);
    }
    [Fact]
    public async Task MissingApproverAndSelfApprovalFailClosedWithoutReservingLeave()
    {
        await using var f = await Fixture.Create();
        using (var services = f.H.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Teams.ExecuteUpdateAsync(s => s.SetProperty(t => t.LeadEmployeeId, f.H.Self));
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody())).StatusCode);
        Assert.Equal(0, (await f.Balance()).ReservedDays);
        using var scope = f.H.App.Services.CreateScope(); var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await context.Set<LeaveRequest>().ToListAsync());
    }
    [Fact]
    public async Task CrossYearRequiresBothBalancesAndCancellationReleasesBothSnapshots()
    {
        await using var f = await Fixture.Create();
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody("2026-12-31", "2027-01-01"))).StatusCode);
        Assert.Equal(0, (await f.Balance()).ReservedDays);
        (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2027, entitledDays = 5, version = 0 })).EnsureSuccessStatusCode();
        var response = await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody("2026-12-31", "2027-01-01")); response.EnsureSuccessStatusCode();
        var request = (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!;
        var balances = (await f.H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?view=MY"))!;
        Assert.All(balances.Data, b => Assert.Equal(1, b.ReservedDays));
        (await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = request.Version, reason = "Cancel" })).EnsureSuccessStatusCode();
        Assert.All((await f.H.Client.GetFromJsonAsync<PageResult<BalanceView>>("/api/leave-balances?view=MY"))!.Data, b => Assert.Equal(0, b.ReservedDays));
    }
    [Fact]
    public async Task ConcurrentDecisionOnlyAdvancesOnce()
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-workflow-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            await using var f = await Fixture.Create(path); var request = await f.Submit(); using var client = await f.As("lead");
            var responses = await Task.WhenAll(Enumerable.Range(0, 2).Select(_ => client.PostAsJsonAsync($"/api/approvals/{request.ApprovalId}/approve", new { version = 1, reason = "Approved" })));
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.OK); Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
            var detail = (await f.H.Client.GetFromJsonAsync<ApprovalDetail>($"/api/approvals/{request.ApprovalId}"))!;
            Assert.Equal(2, detail.Request.CurrentStepNo); Assert.Equal(2, detail.Request.Version);
            using var scope = f.H.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(2, await db.Set<Notification>().CountAsync(n => n.Source == "WORKFLOW"));
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
    [Fact]
    public async Task ScopeFiltersReadsAndViewAllDoesNotAuthorizeApprovingOrCancellingOthers()
    {
        await using var f = await Fixture.Create(); var request = await f.Submit();
        using (var services = f.H.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new LeaveRequest { EmployeeID = f.H.Other, LeaveTypeID = f.TypeId, FromDate = new(2026, 12, 1), ToDate = new(2026, 12, 1), RequestedDays = 1, Reason = "Private", Status = "APPROVED", CreatedAt = DateTime.UtcNow });
            var screen = await db.Screens.SingleAsync(s => s.Code == LeaveWorkflowService.Leave);
            await db.Set<RoleScreenAction>().Where(g => g.ScreenID == screen.ID && g.ActionCode == "VIEW").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "SELF"));
            await db.SaveChangesAsync();
        }
        var list = (await f.H.Client.GetFromJsonAsync<PageResult<LeaveView>>("/api/leave-requests"))!; Assert.Equal(1, list.Total);
        Assert.Equal(f.H.Self, Assert.Single(list.Data).EmployeeId);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Decide(request.ApprovalId, "api-user")).StatusCode);
        using var lead = await f.As("lead");
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = 1, reason = "Not mine" })).StatusCode);
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AttendanceCorrectionWaitsForFinalApprovalAndKeepsBeforeAfterHistory(bool changedAfterSubmission)
    {
        await using var f = await Fixture.Create(); long attendanceId;
        using (var services = f.H.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var shift = new Shift { Code = "DAYTEST", StartTime = new(8, 0), EndTime = new(17, 0), IsActive = true }; db.Add(shift); await db.SaveChangesAsync();
            var rules = AttendanceRules.Snapshot(shift, new(2026, 11, 16), new AttendanceSettingsRequest(), 1);
            var schedule = new WorkSchedule { EmployeeID = f.H.Self, ShiftID = shift.ID, WorkDate = rules.WorkDate, Status = "CLOSED", UniqueWorkKey = "workflow-attendance", Version = 1, RulesSnapshotJson = JsonSerializer.Serialize(rules, SettingsDefaults.Json) }; db.Add(schedule); await db.SaveChangesAsync();
            var attendance = new AttendanceEntity { ScheduleID = schedule.ID, Status = "ABSENT" }; db.Add(attendance); await db.SaveChangesAsync(); attendanceId = attendance.ID;
        }
        var response = await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments", new { attendanceId, proposedCheckIn = "2026-11-16T08:00:00+07:00", proposedCheckOut = "2026-11-16T17:00:00+07:00", reason = "Missed device" }); response.EnsureSuccessStatusCode();
        var request = (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!;
        using (var services = f.H.App.Services.CreateScope()) Assert.Equal("ABSENT", (await services.ServiceProvider.GetRequiredService<AppDbContext>().Set<AttendanceEntity>().FindAsync(attendanceId))!.Status);
        if (changedAfterSubmission)
        {
            using (var services = f.H.App.Services.CreateScope())
                await services.ServiceProvider.GetRequiredService<AppDbContext>().Set<AttendanceEntity>().Where(a => a.ID == attendanceId).ExecuteUpdateAsync(s => s.SetProperty(a => a.Status, "MISSING_CHECK_OUT"));
            (await f.Decide(request.ApprovalId, "lead")).EnsureSuccessStatusCode(); (await f.Decide(request.ApprovalId, "manager")).EnsureSuccessStatusCode();
            Assert.Equal(HttpStatusCode.Conflict, (await f.Decide(request.ApprovalId, "hr")).StatusCode);
            var unchanged = (await f.H.Client.GetFromJsonAsync<ApprovalDetail>($"/api/approvals/{request.ApprovalId}"))!;
            Assert.Equal("PENDING", unchanged.Request.Status); Assert.Equal(3, unchanged.Request.Version);
            Assert.Equal("PENDING", unchanged.Steps.Last().Decision); return;
        }
        await f.ApproveAll(request.ApprovalId);
        using (var services = f.H.App.Services.CreateScope()) Assert.Equal("COMPLETE", (await services.ServiceProvider.GetRequiredService<AppDbContext>().Set<AttendanceEntity>().FindAsync(attendanceId))!.Status);
        var history = (await f.H.Client.GetFromJsonAsync<PageResult<ApprovalHistoryView>>($"/api/approvals/{request.ApprovalId}/history"))!;
        var change = Assert.Single(history.Data, h => h.Action == "ATTENDANCE_ADJUSTED"); Assert.Contains("ABSENT", change.BeforeJson); Assert.Contains("COMPLETE", change.AfterJson);
    }
    [Fact]
    public async Task RejectedApprovedCancellationPreservesUsedBalanceAndCanBeRequestedAgain()
    {
        await using var f = await Fixture.Create(); var request = await f.Submit(); await f.ApproveAll(request.ApprovalId);
        var leave = (await f.H.Client.GetFromJsonAsync<LeaveView>($"/api/leave-requests/{request.Id}"))!;
        var response = await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = leave.Version, reason = "Change" }); response.EnsureSuccessStatusCode();
        var cancellation = (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!;
        (await f.Decide(cancellation.ApprovalId, "lead", false)).EnsureSuccessStatusCode();
        Assert.Equal(2, (await f.Balance()).UsedDays);
        leave = (await f.H.Client.GetFromJsonAsync<LeaveView>($"/api/leave-requests/{request.Id}"))!; Assert.Equal("APPROVED", leave.Status);
        (await f.H.Client.PostAsJsonAsync($"/api/leave-requests/{request.Id}/cancel", new { version = leave.Version, reason = "Request again" })).EnsureSuccessStatusCode();
    }
    [Fact]
    public async Task ApprovalPermissionAndItsLiveActionScopeAreRequired()
    {
        await using var f = await Fixture.Create(); var request = await f.Submit(); using var lead = await f.As("lead");
        using (var services = f.H.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.Set<Role>().SingleAsync(r => r.Code == "LEAD");
            await db.Set<RoleScreenAction>().Where(g => g.RoleID == role.ID && g.ActionCode == "APPROVE").ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "SELF"));
        }
        Assert.Equal(HttpStatusCode.NotFound, (await lead.PostAsJsonAsync($"/api/approvals/{request.ApprovalId}/approve", new { version = 1, reason = "Outside action scope" })).StatusCode);
        using var anonymous = f.H.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/leave-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await lead.GetAsync("/api/leave-types")).StatusCode);
        var detail = (await f.H.Client.GetFromJsonAsync<ApprovalDetail>($"/api/approvals/{request.ApprovalId}"))!; Assert.Equal(1, detail.Request.Version);
    }
    [Fact]
    public async Task ConcurrentSubmissionsCannotOverReserveAvailableBalance()
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-workflow-balance-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            await using var f = await Fixture.Create(path); var balance = await f.Balance();
            (await f.H.Client.PutAsJsonAsync("/api/leave-balances", new { employeeId = f.H.Self, leaveTypeId = f.TypeId, year = 2026, entitledDays = 2, version = balance.Version, reason = "Reduce allocation for concurrency test" })).EnsureSuccessStatusCode();
            var responses = await Task.WhenAll(f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody()), f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody("2026-11-25", "2026-11-26")));
            Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created); Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
            Assert.Equal(2, (await f.Balance()).ReservedDays);
            using var services = f.H.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(1, await db.Set<LeaveRequest>().CountAsync()); Assert.Equal(1, await db.Set<Notification>().CountAsync(n => n.Source == "WORKFLOW"));
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }

    [Theory]
    [InlineData("lead", true)]
    [InlineData("api-user", false)]
    [InlineData("unknown", false)]
    public async Task ExplicitUserApproverDoesNotNeedHrRoleAndStillHonorsSelfPolicy(string user, bool valid)
    {
        await using var f = await Fixture.Create();
        var config = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        var response = await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = config.Version, Routes = [new WorkflowRoute { RequestType = "LEAVE", Steps = [new WorkflowStepRule { ApproverType = "USER", EmployeeId = user == "lead" ? f.H.Peer : user == "api-user" ? f.H.Self : int.MaxValue }] }] });
        if (user == "unknown") { Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode); return; }
        response.EnsureSuccessStatusCode();
        if (!valid)
        {
            Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PostAsJsonAsync("/api/leave-requests", f.LeaveBody())).StatusCode);
            Assert.Equal(0, (await f.Balance()).ReservedDays); return;
        }
        var request = await f.Submit();
        var detail = (await f.H.Client.GetFromJsonAsync<ApprovalDetail>($"/api/approvals/{request.ApprovalId}"))!;
        Assert.Equal(user, Assert.Single(detail.Steps).ApproverUserId);
        Assert.Equal(f.H.Peer, detail.Steps[0].ApproverEmployeeId);
        (await f.Decide(request.ApprovalId, user)).EnsureSuccessStatusCode();
        Assert.Equal(2, (await f.Balance()).UsedDays);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    [InlineData(false, false)]
    public async Task SettingsUseTheirOwnViewAndUpdateActionsWithoutEmployeeLinkOrDataScope(bool view, bool update)
    {
        await using var f = await Fixture.Create();
        var config = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        using (var services = f.H.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.Set<Role>().SingleAsync(r => r.Code == "LEAD");
            var screen = await db.Screens.SingleAsync(s => s.Code == LeaveWorkflowService.Configuration);
            await db.Set<RoleDetail>().Where(d => d.RoleID == role.ID).ExecuteDeleteAsync();
            await db.Set<RoleScreenAction>().Where(g => g.RoleID == role.ID).ExecuteDeleteAsync();
            db.Add(new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = view ? "Y" : "N", CanUpdate = update ? "Y" : "N" });
            // A configuration administrator need not be an employee or an approver.
            await db.Set<User>().Where(u => u.UserId == "lead").ExecuteUpdateAsync(s => s.SetProperty(u => u.EmployeeId, (int?)null));
            await db.SaveChangesAsync();
        }
        using var client = await f.As("lead");
        Assert.Equal(view ? HttpStatusCode.OK : HttpStatusCode.Forbidden, (await client.GetAsync("/api/approval-workflow-settings")).StatusCode);
        Assert.Equal(update ? HttpStatusCode.OK : HttpStatusCode.Forbidden, (await client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = config.Version, Routes = config.Routes.ToArray() })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/leave-requests")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/approvals")).StatusCode);
        var after = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        Assert.Equal(config.Version + (update ? 1 : 0), after.Version);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AssignedApproverCannotDecideAfterEmployeeLinkChanges(bool unlink)
    {
        await using var f = await Fixture.Create();
        var config = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = config.Version, Routes = [new WorkflowRoute { RequestType = "LEAVE", Steps = [new WorkflowStepRule { ApproverType = "USER", EmployeeId = f.H.Peer }] }] })).EnsureSuccessStatusCode();
        var request = await f.Submit(); using var lead = await f.As("lead");
        using (var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<User>().Where(u => u.UserId == "lead").ExecuteUpdateAsync(s => s.SetProperty(u => u.EmployeeId, unlink ? (int?)null : f.H.Other));
            var role = await db.Set<Role>().SingleAsync(r => r.Code == "LEAD");
            await db.Set<RoleScreenAction>().Where(g => g.RoleID == role.ID).ExecuteUpdateAsync(s => s.SetProperty(g => g.DataScope, "ALL"));
        }
        foreach (var action in new[] { "approve", "reject" })
            Assert.Equal(HttpStatusCode.Forbidden, (await lead.PostAsJsonAsync($"/api/approvals/{request.ApprovalId}/{action}", new { version = 1, reason = "Old account assignment" })).StatusCode);
        var detail = (await f.H.Client.GetFromJsonAsync<ApprovalDetail>($"/api/approvals/{request.ApprovalId}"))!;
        Assert.Equal("PENDING", detail.Request.Status); Assert.Equal(1, detail.Request.Version);
        Assert.Equal(f.H.Peer, Assert.Single(detail.Steps).ApproverEmployeeId);
        Assert.Equal(0, (await f.Balance()).UsedDays);
    }
    [Fact]
    public async Task UserStepRequiresEmployeeIdAndChangingSettingsDoesNotReassignPendingSteps()
    {
        await using var f = await Fixture.Create();
        var config = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = config.Version, Routes = [new WorkflowRoute { RequestType = "LEAVE", Steps = [new WorkflowStepRule { ApproverType = "USER", UserId = "lead" }] }] })).StatusCode);
        (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = config.Version, Routes = [new WorkflowRoute { RequestType = "LEAVE", Steps = [new WorkflowStepRule { ApproverType = "USER", EmployeeId = f.H.Peer }] }] })).EnsureSuccessStatusCode();
        var request = await f.Submit();
        int managerId;
        using (var scope = f.H.App.Services.CreateScope()) managerId = (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<User>().SingleAsync(u => u.UserId == "manager")).EmployeeId!.Value;
        (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = config.Version + 1, Routes = [new WorkflowRoute { RequestType = "LEAVE", Steps = [new WorkflowStepRule { ApproverType = "USER", EmployeeId = managerId }] }] })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Decide(request.ApprovalId, "manager")).StatusCode);
        (await f.Decide(request.ApprovalId, "lead")).EnsureSuccessStatusCode();
    }

}
