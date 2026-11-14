using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

internal sealed class FailNotificationInsertInterceptor(bool enabled) : DbCommandInterceptor
{
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
        CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
    {
        if (enabled && command.CommandText.Contains("INSERT INTO \"notifications\"", StringComparison.Ordinal))
            throw new InvalidOperationException("Test notification persistence failure.");
        return ValueTask.FromResult(result);
    }
}
public sealed class EmployeeApiTests
{
    [Fact]
    public async Task EmployeePositionSupportsCreateReadUpdateClearAndValidation()
    {
        await using var h = await Harness.Create("ALL");
        long firstId, secondId, inactiveId;
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var first = new Position { Code = "P1", Name = "First", IsActive = true };
            var second = new Position { Code = "P2", Name = "Second", IsActive = true };
            var inactive = new Position { Code = "P3", Name = "Inactive", IsActive = false };
            db.AddRange(first, second, inactive); await db.SaveChangesAsync();
            firstId = first.ID; secondId = second.ID; inactiveId = inactive.ID;
        }
        var create = Create(h.Department); create.PositionId = firstId;
        var createdResponse = await h.Client.PostAsJsonAsync("/api/employees", create);
        Assert.Equal(HttpStatusCode.Created, createdResponse.StatusCode);
        var created = (await createdResponse.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(firstId, created.PositionId);
        var url = $"/api/employees/{created.Id}";
        Assert.Equal(firstId, (await h.Client.GetFromJsonAsync<EmployeeDto>(url))!.PositionId);
        var list = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees?search=NEW01"))!;
        Assert.Equal(firstId, Assert.Single(list.Data).PositionId);
        var unlinked = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees/unlinked?search=NEW01"))!;
        Assert.Equal(firstId, Assert.Single(unlinked.Data).PositionId);
        var update = Profile(); update.PositionId = secondId;
        var updated = await h.Client.PutAsJsonAsync(url, update);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(secondId, (await updated.Content.ReadFromJsonAsync<EmployeeDto>())!.PositionId);
        foreach (var invalid in new[] { 0L, -1L, long.MaxValue, inactiveId })
        {
            update.PositionId = invalid;
            Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync(url, update)).StatusCode);
            create.EmployeeCode = "INVALID"; create.Email = "invalid@example.invalid"; create.PositionId = invalid;
            Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/employees", create)).StatusCode);
        }
        Assert.Equal(secondId, (await h.Client.GetFromJsonAsync<EmployeeDto>(url))!.PositionId);
        await OrganizationApiTests.Grant(h.App, "WEB_POSITIONS");
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.DeleteAsync($"/api/positions/{secondId}")).StatusCode);
        update.PositionId = null;
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync(url, update)).StatusCode);
        Assert.Null((await h.Client.GetFromJsonAsync<EmployeeDto>(url))!.PositionId);
    }

    [Theory]
    [InlineData("ALL", 2)]
    [InlineData("DEPARTMENT", 1)]
    [InlineData("SELF", 0)]
    public async Task UnlinkedEmployeesFiltersBeforePaginationAndRespectsScope(string scope, int expected)
    {
        await using var h = await Harness.Create(scope);
        var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees/unlinked?pageSize=1"))!;
        Assert.Equal(expected, page.Total);
        Assert.DoesNotContain(page.Data, x => x.Id == h.Self);
        if (expected > 0) Assert.Equal(h.Peer, Assert.Single(page.Data).Id);
        else Assert.Empty(page.Data);
        var other = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>($"/api/employees/unlinked?departmentId={h.OtherDepartment}"))!;
        Assert.Equal(scope == "ALL" ? 1 : 0, other.Total);
        var searched = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees/unlinked?search=E2&employmentStatus=ACTIVE"))!;
        Assert.Equal(scope == "SELF" ? 0 : 1, searched.Total);
        using var services = h.App.Services.CreateScope();
        var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Add(new User { UserId = "locked-linked", Email = "locked@example.invalid", EmployeeId = h.Peer, Status = "LOCKED", PasswordHash = "unused" });
        await db.SaveChangesAsync();
        var afterLink = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees/unlinked"))!;
        Assert.DoesNotContain(afterLink.Data, x => x.Id == h.Peer);
        Assert.Equal(scope == "ALL" ? 1 : 0, afterLink.Total);
    }

    [Fact]
    public async Task UnlinkedEmployeesRequiresAuthenticationAndViewGrant()
    {
        await using var h = await Harness.Create("ALL");
        h.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/employees/unlinked")).StatusCode);
        await OrganizationApiTests.Login(h.Client, h.App);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.RoleDetails.ExecuteUpdateAsync(x => x.SetProperty(d => d.CanView, "N"));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/employees/unlinked")).StatusCode);
    }

    [Fact]
    public async Task MissingScopeDeniesDespiteGrantedActionAndLegacyConfiguration()
    {
        await using var h = await Harness.Create("ALL");
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<RoleScreenAction>().ExecuteUpdateAsync(x => x.SetProperty(g => g.DataScope, (string?)null));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync("/api/employees")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Profile())).StatusCode);
    }

    [Fact]
    public async Task SelfIsReadOnlyAndCannotAccessOtherEmployeesEvenWithSpoofedScope()
    {
        await using var h = await Harness.Create(null);
        var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees?scope=ALL&userId=admin"))!;
        Assert.Equal(h.Self, Assert.Single(page.Data).Id);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/employees/{h.Other}")).StatusCode);
        Assert.Empty((await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>($"/api/employees?departmentId={h.OtherDepartment}"))!.Data);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}", Profile())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/employees/{h.Other}/contracts")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/employees/{h.Other}/history")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/employees", Create(h.Department))).StatusCode);
    }
    [Fact]
    public async Task DepartmentScopeFiltersBeforePaginationAndCannotTransferAcrossScope()
    {
        await using var h = await Harness.Create("DEPARTMENT");
        var page = (await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees?pageSize=1"))!;
        Assert.Equal(2, page.Total); Assert.Single(page.Data);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync($"/api/employees/{h.Other}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/employees/{h.Peer}", new
        {
            fullName = "Changed", email = "changed@example.invalid", employmentStatus = "ACTIVE",
            departmentId = h.OtherDepartment, userId = "admin", scope = "ALL"
        })).StatusCode);
        Assert.Equal(h.Department, (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Peer}"))!.DepartmentId);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PatchAsJsonAsync($"/api/employees/{h.Peer}/department",
            new { departmentId = h.OtherDepartment, effectiveDate = Today, reason = "Transfer" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/employees", Create(h.OtherDepartment))).StatusCode);
    }
    [Fact]
    public async Task AllScopeSupportsValidatedProfileCrudWithoutPhysicalDeletion()
    {
        await using var h = await Harness.Create("ALL");
        var response = await h.Client.PostAsJsonAsync("/api/employees", Create(h.Department));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode); var employee = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync("/api/employees", Create(h.Department))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/employees", new { fullName = "Missing" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"/api/employees/{employee.Id}", Profile())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.DeleteAsync($"/api/employees/{employee.Id}")).StatusCode);
        var inactive = (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{employee.Id}"))!;
        Assert.Equal("INACTIVE", inactive.EmploymentStatus);
        using var scope = h.App.Services.CreateScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<Employee>().AnyAsync(x => x.Id == employee.Id));
    }
    [Fact]
    public async Task TransferWritesHistoryActorAndExistingNotificationOutboxAtomically()
    {
        await using var h = await Harness.Create("ALL");
        var path = $"/api/employees/{h.Self}/department";
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PatchAsJsonAsync(path,
            new { departmentId = h.OtherDepartment, effectiveDate = Today.AddDays(1), reason = "Future" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PatchAsJsonAsync(path,
            new { departmentId = h.OtherDepartment, effectiveDate = Today, reason = "Transfer", changedByUserId = "admin" })).StatusCode);
        var history = (await h.Client.GetFromJsonAsync<PageResult<EmployeeHistoryDto>>($"/api/employees/{h.Self}/history"))!;
        var item = Assert.Single(history.Data); Assert.Equal("api-user", item.ChangedByUserId);
        Assert.Equal(h.Department, item.OldDepartmentId); Assert.Equal(h.OtherDepartment, item.NewDepartmentId);
        Assert.Equal(h.OtherDepartment, (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!.DepartmentId);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.Set<Notification>().ToListAsync()); Assert.Single(await db.Set<NotificationOutbox>().ToListAsync());
        Assert.Empty(await db.Set<NotificationRecipient>().ToListAsync());
        Assert.Contains(await db.Set<AuditLog>().ToListAsync(), x => x.Action == "EMPLOYEE_DEPARTMENT_CHANGED");
    }
    [Fact]
    public async Task NotificationPersistenceFailureRollsBackEmployeeHistoryAndAudit()
    {
        await using var h = await Harness.Create("ALL", failNotification: true);
        Assert.Equal(HttpStatusCode.InternalServerError, (await h.Client.PatchAsJsonAsync($"/api/employees/{h.Self}/department",
            new { departmentId = h.OtherDepartment, effectiveDate = Today, reason = "Transfer" })).StatusCode);
        Assert.Equal(h.Department, (await h.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{h.Self}"))!.DepartmentId);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Set<EmployeeHistory>().ToListAsync()); Assert.Empty(await db.Set<AuditLog>().ToListAsync());
        Assert.Empty(await db.Set<NotificationOutbox>().ToListAsync()); Assert.Empty(await db.Set<Notification>().ToListAsync());
    }
    [Fact]
    public async Task ContractValidatesDatesOverlapTransitionsAndKeepsClosedHistory()
    {
        await using var h = await Harness.Create("ALL"); var url = $"/api/employees/{h.Self}/contracts";
        var bad = Contract("BAD"); bad.EndDate = bad.StartDate.AddDays(-1);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync(url, bad)).StatusCode);
        var active = Contract("ACTIVE01"); active.Status = "ACTIVE";
        var created = await h.Client.PostAsJsonAsync(url, active); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var contract = (await created.Content.ReadFromJsonAsync<ContractDto>())!;
        Assert.Equal(HttpStatusCode.OK, (await h.Client.GetAsync(created.Headers.Location)).StatusCode);
        var overlap = Contract("ACTIVE02"); overlap.Status = "ACTIVE";
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsJsonAsync(url, overlap)).StatusCode);
        active.Status = "DRAFT";
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"{url}/{contract.Id}", active)).StatusCode);
        active.Status = "TERMINATED"; active.EndDate = Today;
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"{url}/{contract.Id}", active)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync($"{url}/{contract.Id}", active)).StatusCode);
        active.ContractType = "CHANGED";
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PutAsJsonAsync($"{url}/{contract.Id}", active)).StatusCode);
        Assert.Single((await h.Client.GetFromJsonAsync<PageResult<ContractDto>>(url))!.Data);
    }
    [Fact]
    public async Task RetriedIdenticalPutDoesNotDuplicateBusinessNotifications()
    {
        await using var h = await Harness.Create("ALL");
        var url = $"/api/employees/{h.Self}";
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync(url, Profile())).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PutAsJsonAsync(url, Profile())).StatusCode);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.Set<Notification>().ToListAsync()); Assert.Single(await db.Set<NotificationOutbox>().ToListAsync());
        Assert.Single(await db.Set<AuditLog>().Where(x => x.Action == "EMPLOYEE_UPDATED").ToListAsync());
    }
    [Fact]
    public async Task UnlinkedAdminStillHasNoImplicitDataScope()
    {
        await using var h = await Harness.Create(null);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<User>().Where(x => x.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(x => x.EmployeeId, (int?)null));
            await db.Set<Role>().Where(x => x.Code == "HR").ExecuteUpdateAsync(s => s.SetProperty(x => x.Code, "ADMIN"));
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        Assert.Empty((await h.Client.GetFromJsonAsync<PageResult<EmployeeDto>>("/api/employees"))!.Data);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/employees", Create(h.Department))).StatusCode);
    }
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static EmployeeProfileRequest Profile() => new() { FullName = "Updated", Email = "updated@example.invalid", EmploymentStatus = "ACTIVE" };
    private static EmployeeCreateRequest Create(int department) => new() { EmployeeCode = "NEW01", FullName = "New Employee", Email = "new@example.invalid", HireDate = new(2020, 1, 1), DepartmentId = department };
    private static ContractRequest Contract(string no) => new() { ContractNo = no, ContractType = "FIXED_TERM", StartDate = Today.AddDays(-1), EndDate = Today.AddDays(30) };
    private sealed class Harness : IAsyncDisposable
    {
        public AuthApiFactory App { get; private set; } = null!;
        public HttpClient Client { get; private set; } = null!;
        public int Self, Peer, Other, Department, OtherDepartment;
        public static async Task<Harness> Create(string? scope, bool failNotification = false)
        {
            var h = new Harness { App = new AuthApiFactory { EmployeeScope = scope, FailNotificationWrites = failNotification } };
            h.Client = h.App.CreateClient(new() { BaseAddress = new Uri("https://localhost") }); await h.App.PrepareAsync();
            await OrganizationApiTests.Grant(h.App, "WEB_EMPLOYEES"); await OrganizationApiTests.Grant(h.App, "WEB_CONTRACTS");
            using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var department = new Department { DepartmentCode = "D1", DepartmentName = "First" };
            var other = new Department { DepartmentCode = "D2", DepartmentName = "Other" }; db.AddRange(department, other); await db.SaveChangesAsync();
            var people = Enumerable.Range(1, 3).Select(i => new Employee { EmployeeCode = "E" + i, FullName = "Employee " + i,
                Email = $"employee-{i}@example.invalid", HireDate = new(2020, 1, 1), DepartmentId = i == 3 ? other.Id : department.Id }).ToArray();
            db.AddRange(people); await db.SaveChangesAsync();
            await db.Set<User>().Where(x => x.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(x => x.EmployeeId, people[0].Id));
            foreach (var detail in await db.RoleDetails.ToListAsync())
                foreach (var action in new[] { "VIEW", "NEW", "UPDATE", "DELETE" })
                    db.Add(new RoleScreenAction { RoleID = detail.RoleID, ScreenID = detail.ScreenID, ActionCode = action, DataScope = scope ?? "SELF" });
            await db.SaveChangesAsync();
            h.Self = people[0].Id; h.Peer = people[1].Id; h.Other = people[2].Id; h.Department = department.Id; h.OtherDepartment = other.Id;
            await OrganizationApiTests.Login(h.Client, h.App); return h;
        }
        public ValueTask DisposeAsync() { Client.Dispose(); App.Dispose(); return ValueTask.CompletedTask; }
    }
}
