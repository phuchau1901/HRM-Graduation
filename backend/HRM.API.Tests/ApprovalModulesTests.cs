using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture = HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class ApprovalModulesTests
{
    [Fact]
    public async Task ParentListAndLeaveChildFilterDoNotMixOvertimeAndKeepScopedHistory()
    {
        await using var f = await Fixture.Create(); var leave = await f.Submit();
        var response = await f.H.Client.PostAsJsonAsync("/api/overtime-requests", new { startAt = "2026-11-24T18:00:00+07:00", endAt = "2026-11-24T20:00:00+07:00", reason = "Release" }); response.EnsureSuccessStatusCode();
        var overtime = (await response.Content.ReadFromJsonAsync<WorkflowReceipt>())!;
        var all = (await f.H.Client.GetFromJsonAsync<PageResult<ApprovalView>>("/api/approvals"))!; Assert.Equal(2, all.Total);
        var child = (await f.H.Client.GetFromJsonAsync<PageResult<ApprovalView>>("/api/approvals?module=LEAVE"))!; Assert.Equal(leave.ApprovalId, Assert.Single(child.Data).Id);
        child = (await f.H.Client.GetFromJsonAsync<PageResult<ApprovalView>>("/api/approvals?module=OVERTIME"))!; Assert.Equal(overtime.ApprovalId, Assert.Single(child.Data).Id);
        Assert.Equal(HttpStatusCode.BadRequest, (await f.H.Client.GetAsync("/api/approvals?module=UNKNOWN")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Decide(leave.ApprovalId, "api-user")).StatusCode);
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task RegisteredNonLeaveModuleUsesSharedEngineAndRollsBackHandlerFailures(bool fail)
    {
        await using var f = await Fixture.Create();
        using var scope = f.H.App.Services.CreateScope(); var services = scope.ServiceProvider; var db = services.GetRequiredService<AppDbContext>();
        var extension = new TravelModule(db, fail);
        var engine = new ApprovalWorkflowService(db, services.GetRequiredService<EmployeeDataScope>(), services.GetRequiredService<IPermissionService>(), services.GetRequiredService<NotificationService>(), services.GetRequiredService<TimeProvider>(), services.GetServices<IApprovalModule>().Append(extension));
        var settings = await engine.GetSettings("api-user", default);
        // The four existing request types plus a fifth registered type must be configurable.
        var routes = settings.Routes.Concat([new WorkflowRoute { RequestType = "LEAVE_CANCELLATION", Steps = [new() { ApproverType = "TEAM_LEAD" }] }, new WorkflowRoute { RequestType = "TRAVEL_REQUEST", Steps = [new() { ApproverType = "TEAM_LEAD" }] }]).ToArray();
        Assert.Equal(5, routes.Length);
        await engine.SaveSettings("api-user", new() { Version = settings.Version, Routes = routes }, default);
        long id;
        await using (var tx = await db.Database.BeginTransactionAsync())
        {
            var employee = await db.Employees.SingleAsync(e => e.Id == f.H.Self);
            id = (await engine.StartAsync("api-user", employee, "TRAVEL_REQUEST", 500, default)).ID;
            await db.SaveChangesAsync(); await tx.CommitAsync();
        }
        var action = new WorkflowActionRequest { Version = 1, Reason = "Checked" };
        if (fail) Assert.Equal(409, (await Assert.ThrowsAsync<BusinessException>(() => engine.Decide("lead", id, action, true, default))).Status);
        else
        {
            var result = await engine.Decide("lead", id, action, true, default); Assert.Equal("APPROVED", result.Status);
            var detail = await engine.ApprovalGet("api-user", id, default); Assert.IsType<TravelDetails>(detail.Details);
        }
        using var verifyScope = f.H.App.Services.CreateScope(); var verify = verifyScope.ServiceProvider.GetRequiredService<AppDbContext>();
        var approval = await verify.Set<ApprovalRequest>().SingleAsync(a => a.ID == id);
        Assert.Equal(fail ? "PENDING" : "APPROVED", approval.Status); Assert.Equal(fail ? 1 : 2, approval.Version);
        Assert.Equal(fail ? 0 : 1, await verify.Set<AuditLog>().CountAsync(a => a.EntityType == "TravelRequest"));
    }
    [Fact]
    public async Task UnregisteredRequestTypesCannotBeConfigured()
    {
        await using var f = await Fixture.Create(); var before = (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
        var response = await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings", new WorkflowSettingsRequest { Version = before.Version, Routes = [new() { RequestType = "UNREGISTERED", Steps = [new() { ApproverType = "TEAM_LEAD" }] }] });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(before.Version, (await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!.Version);
    }
    [Fact]
    public void MovingApprovalTypesDoesNotRequireSchemaMigration()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        Assert.False(db.Database.HasPendingModelChanges());
        Assert.Equal("approval_requests", db.Model.FindEntityType(typeof(ApprovalRequest))!.GetTableName());
        Assert.Equal("approval_steps", db.Model.FindEntityType(typeof(ApprovalStep))!.GetTableName());
        Assert.StartsWith("HRM.API.Modules.Approvals.", typeof(ApprovalRequest).FullName);
        Assert.DoesNotContain(typeof(ApprovalWorkflowService).GetConstructors().Single().GetParameters(), p => p.ParameterType.Name == "LeaveWorkflowService");
    }
    private sealed record TravelDetails(long ReferenceId);
    private sealed class TravelModule(AppDbContext db, bool fail) : IApprovalModule
    {
        public string Code => "TRAVEL";
        public IReadOnlyCollection<string> RequestTypes => ["TRAVEL_REQUEST"];
        public Task<object?> GetDetailsAsync(ApprovalRequest approval, CancellationToken ct) => Task.FromResult<object?>(new TravelDetails(approval.ReferenceID));
        public async Task CompleteAsync(ApprovalRequest approval, bool approved, string actor, CancellationToken ct)
        {
            db.Add(new AuditLog { ActorUserID = actor, EntityType = "TravelRequest", EntityID = approval.ReferenceID.ToString(), Action = approved ? "APPROVED" : "REJECTED", CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
            if (fail) throw BusinessException.Conflict("Test handler failure.");
        }
    }
}
