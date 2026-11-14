using System.Data.Common;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

internal sealed class FailCreationInterceptor(string stage) : DbCommandInterceptor
{
    public bool Enabled { get; set; }
    private void Check(DbCommand command)
    {
        if (Enabled && ((stage == "code" && command.CommandText.Contains("UPDATE \"employees\"") && command.CommandText.Contains("\"EmployeeCode\" =")) ||
            (stage == "user" && command.CommandText.Contains("INSERT INTO \"users\""))))
            throw new InvalidOperationException("Simulated creation persistence failure.");
    }
    public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData data, InterceptionResult<DbDataReader> result, CancellationToken ct = default)
    { Check(command); return ValueTask.FromResult(result); }
    public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command, CommandEventData data, InterceptionResult<int> result, CancellationToken ct = default)
    { Check(command); return ValueTask.FromResult(result); }
}
public sealed class EmployeeCreationTests
{
    private static EmployeeCreateRequest Employee(int department, string email = "created@example.invalid") => new()
    { FullName = "Created employee", Email = email, DepartmentId = department, HireDate = new(2020, 1, 1) };
    private static UserCreateRequest User(int department) => new()
    { UserId = "created-user", Email = "account@example.invalid", Password = "Password-test-2026!", CreateEmployee = true, Employee = Employee(department) };
    private static async Task<(int Department, int Other)> Prepare(AdministrationApiTests.Fixture f, string scope = "ALL")
    {
        await f.Start(); await OrganizationApiTests.Grant(f.App, "WEB_EMPLOYEES");
        using var services = f.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        var department = new Department { DepartmentCode = "CREATE", DepartmentName = "Creation" };
        var other = new Department { DepartmentCode = "OTHER", DepartmentName = "Other" }; db.AddRange(department, other);
        var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_EMPLOYEES"); var root = await db.Set<Role>().SingleAsync(x => x.Code == "HR");
        foreach (var action in new[] { "NEW", "VIEW", "UPDATE", "DELETE" })
            db.Add(new RoleScreenAction { RoleID = root.ID, ScreenID = screen.ID, ActionCode = action, DataScope = scope });
        await db.SaveChangesAsync(); await OrganizationApiTests.Login(f.Client, f.App); return (department.Id, other.Id);
    }
    [Theory]
    [InlineData(1, "NV000001")]
    [InlineData(123, "NV000123")]
    [InlineData(1000000, "NV1000000")]
    [InlineData(int.MaxValue, "NV2147483647")]
    public void CodesUseInvariantIdentityWithAtLeastSixDigits(int id, string code) => Assert.Equal(code, EmployeeCodeGenerator.Format(id));

    [Fact]
    public async Task FirstAndSubsequentEmployeeCodesAreGeneratedWithoutRequestField()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        var response = await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var first = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!; Assert.Equal("NV000001", first.EmployeeCode);
        var second = (await (await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department, "second@example.invalid"))).Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal("NV000002", second.EmployeeCode); Assert.NotEqual(first.EmployeeCode, second.EmployeeCode);
        using var services = f.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.Employees.AnyAsync(x => x.EmployeeCode == "" || x.EmployeeCode.StartsWith("~")));
    }
    [Fact]
    public async Task ManualCodeIsIgnoredAndCodesStayReadOnlyOnProfileAndDepartmentTeamPositionChanges()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        var response = await f.Client.PostAsJsonAsync("/api/employees", new { employeeCode = "FORGED", fullName = "Employee", email = "employee@example.invalid", hireDate = "2020-01-01", departmentId = departments.Department });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode); var employee = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal("NV000001", employee.EmployeeCode);
        long positionId; int teamId;
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var position = new Position { Code = "POSITION", Name = "Position", IsActive = true }; var team = new Team { TeamCode = "TEAM", TeamName = "Team", DepartmentId = departments.Department };
            db.AddRange(position, team); await db.SaveChangesAsync(); positionId = position.ID; teamId = team.Id;
        }
        var updated = await f.Client.PutAsJsonAsync($"/api/employees/{employee.Id}", new { employeeCode = "HACKED", fullName = "Updated", email = employee.Email, positionId, teamId, employmentStatus = "ACTIVE" });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode); Assert.Equal(employee.EmployeeCode, (await updated.Content.ReadFromJsonAsync<EmployeeDto>())!.EmployeeCode);
        var moved = await f.Client.PatchAsJsonAsync($"/api/employees/{employee.Id}/department", new { employeeCode = "HACKED", departmentId = departments.Other, effectiveDate = DateOnly.FromDateTime(DateTime.UtcNow), reason = "Transfer" });
        Assert.Equal(HttpStatusCode.OK, moved.StatusCode); Assert.Equal(employee.EmployeeCode, (await moved.Content.ReadFromJsonAsync<EmployeeDto>())!.EmployeeCode);
        Assert.Equal(HttpStatusCode.NoContent, (await f.Client.DeleteAsync($"/api/employees/{employee.Id}")).StatusCode);
        var next = (await (await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department))).Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.Equal("NV000002", next.EmployeeCode);
    }
    [Fact]
    public async Task IssuedCodeIsNotReusedEvenAfterDeletionAndGeneratorRejectsMissingTransaction()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await Assert.ThrowsAsync<InvalidOperationException>(() => services.ServiceProvider.GetRequiredService<EmployeeCodeGenerator>().AddAsync(new Employee(), default));
            Assert.Empty(await db.Employees.ToListAsync());
        }
        var firstResponse = await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department));
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);
        var first = (await firstResponse.Content.ReadFromJsonAsync<EmployeeDto>())!;
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            // Test-only hard deletion verifies the identity high-water mark; production DELETE is deactivation.
            db.Remove(await db.Employees.SingleAsync(x => x.Id == first.Id)); await db.SaveChangesAsync();
        }
        var secondResponse = await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department));
        Assert.Equal(HttpStatusCode.Created, secondResponse.StatusCode);
        var second = (await secondResponse.Content.ReadFromJsonAsync<EmployeeDto>())!;
        Assert.True(second.Id > first.Id); Assert.NotEqual(first.EmployeeCode, second.EmployeeCode);
    }

    [Fact]
    public async Task ExistingLegacyCodesArePreservedAndOccupiedIdentityCodesAreSkipped()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new Employee { EmployeeCode = "NV000002", FullName = "Legacy", Email = "legacy@example.invalid", DepartmentId = departments.Department }); await db.SaveChangesAsync();
        }
        var response = await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var employee = (await response.Content.ReadFromJsonAsync<EmployeeDto>())!; Assert.Equal(3, employee.Id); Assert.Equal("NV000003", employee.EmployeeCode);
        using var check = f.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal("NV000002", (await context.Employees.SingleAsync(x => x.Id == 1)).EmployeeCode);
        Assert.Equal(2, await context.Employees.CountAsync());
    }
    [Fact]
    public async Task ConcurrentRequestsOnSeparateDatabaseConnectionsNeverDuplicateCodes()
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-concurrent-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            using var f = new AdministrationApiTests.Fixture(new AuthApiFactory { SqliteDatabasePath = path }); var departments = await Prepare(f);
            using (var setupServices = f.App.Services.CreateScope())
                await setupServices.ServiceProvider.GetRequiredService<AppDbContext>().Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;");
            var responses = await Task.WhenAll(Enumerable.Range(0, 10).Select(i => f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department, $"parallel-{i}@example.invalid"))));
            Assert.All(responses, response => Assert.Equal(HttpStatusCode.Created, response.StatusCode));
            var employees = await Task.WhenAll(responses.Select(async response => (await response.Content.ReadFromJsonAsync<EmployeeDto>())!));
            Assert.Equal(10, employees.Select(x => x.EmployeeCode).Distinct().Count());
            Assert.All(employees, employee => Assert.Equal(EmployeeCodeGenerator.Format(employee.Id), employee.EmployeeCode));
            using var services = f.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.Equal(10, await db.Employees.CountAsync());
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-shm", "-wal" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
    [Fact]
    public async Task CodeAssignmentDatabaseFailureRollsBackProvisionalEmployeeAndAudit()
    {
        var failure = new FailCreationInterceptor("code");
        using var f = new AdministrationApiTests.Fixture(new AuthApiFactory { CreationInterceptor = failure }); var departments = await Prepare(f);
        failure.Enabled = true;
        Assert.Equal(HttpStatusCode.InternalServerError, (await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department))).StatusCode);
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); Assert.Empty(await db.Employees.ToListAsync()); Assert.Empty(await db.Set<AuditLog>().ToListAsync());
        }
        failure.Enabled = false;
        var retry = await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department)); Assert.Equal(HttpStatusCode.Created, retry.StatusCode);
        Assert.StartsWith("NV", (await retry.Content.ReadFromJsonAsync<EmployeeDto>())!.EmployeeCode);
    }
    [Fact]
    public async Task UserAndEmployeeAreCreatedTogetherAndReturnGeneratedCode()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        var response = await f.Client.PostAsJsonAsync("/api/users", User(departments.Department)); Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var user = (await response.Content.ReadFromJsonAsync<AdminUserDto>())!; Assert.NotNull(user.EmployeeId); Assert.Equal("NV000001", user.EmployeeCode);
        var employee = (await f.Client.GetFromJsonAsync<EmployeeDto>($"/api/employees/{user.EmployeeId}"))!; Assert.Equal(user.EmployeeCode, employee.EmployeeCode);
        var userView = (await f.Client.GetFromJsonAsync<AdminUserDto>("/api/users/created-user"))!; Assert.Equal(user.EmployeeCode, userView.EmployeeCode);
        Assert.Empty((await f.Client.GetFromJsonAsync<HRM.API.Common.PageResult<EmployeeDto>>("/api/employees/unlinked"))!.Data);
        using var services = f.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Single(await db.Employees.ToListAsync()); Assert.Equal(user.EmployeeId, (await db.Set<User>().SingleAsync(x => x.UserId == user.UserId)).EmployeeId);
        Assert.Contains(await db.Set<AuditLog>().ToListAsync(), x => x.Action == "EMPLOYEE_CREATED");
        Assert.Contains(await db.Set<AuditLog>().ToListAsync(), x => x.Action == "USER_CREATE");
    }
    [Fact]
    public async Task UserInsertDatabaseFailureRollsBackEmployeeCodeUserRolesAndAudits()
    {
        var failure = new FailCreationInterceptor("user");
        using var f = new AdministrationApiTests.Fixture(new AuthApiFactory { CreationInterceptor = failure }); var departments = await Prepare(f);
        failure.Enabled = true; var request = User(departments.Department); request.RoleIds = [f.TargetRole];
        Assert.Equal(HttpStatusCode.InternalServerError, (await f.Client.PostAsJsonAsync("/api/users", request)).StatusCode);
        using var services = f.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await db.Employees.ToListAsync()); Assert.False(await db.Set<User>().AnyAsync(x => x.UserId == request.UserId));
        Assert.False(await db.Set<UserRole>().AnyAsync(x => x.UserID == request.UserId)); Assert.Empty(await db.Set<AuditLog>().ToListAsync());
    }
    [Fact]
    public async Task RecoveryGuardFailureAfterSavingBothRowsRollsBackEverything()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_PERMISSIONS");
            await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanApprove, "N"));
        }
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/users", User(departments.Department))).StatusCode);
        using var check = f.App.Services.CreateScope(); var context = check.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await context.Employees.ToListAsync()); Assert.False(await context.Set<User>().AnyAsync(x => x.UserId == "created-user")); Assert.Empty(await context.Set<AuditLog>().ToListAsync());
    }
    [Theory]
    [InlineData("missing-employee")]
    [InlineData("both")]
    [InlineData("unexpected-employee")]
    [InlineData("invalid-employee")]
    public async Task InvalidCombinedCreationIsRejectedBeforePersistence(string mode)
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f); var request = User(departments.Department);
        if (mode == "missing-employee") request.Employee = null;
        if (mode == "both") request.EmployeeId = 123;
        if (mode == "unexpected-employee") request.CreateEmployee = false;
        if (mode == "invalid-employee") request.Employee!.FullName = "";
        Assert.Equal(HttpStatusCode.BadRequest, (await f.Client.PostAsJsonAsync("/api/users", request)).StatusCode);
        using var services = f.App.Services.CreateScope(); Assert.Empty(await services.ServiceProvider.GetRequiredService<AppDbContext>().Employees.ToListAsync());
    }
    [Fact]
    public async Task CombinedCreationRequiresLiveEmployeePermissionAndWriteScope()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f, "SELF");
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users", User(departments.Department))).StatusCode);
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_EMPLOYEES");
            await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanNew, "N"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users", User(departments.Department))).StatusCode);
        using var check = f.App.Services.CreateScope(); Assert.Empty(await check.ServiceProvider.GetRequiredService<AppDbContext>().Employees.ToListAsync());
    }
    [Fact]
    public async Task DepartmentScopeCannotBeExpandedThroughCombinedUserCreation()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f, "DEPARTMENT");
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var actorEmployee = new Employee { EmployeeCode = "LEGACY-ACTOR", FullName = "Actor", Email = "actor-employee@example.invalid", DepartmentId = departments.Department };
            db.Add(actorEmployee); await db.SaveChangesAsync();
            await db.Set<User>().Where(x => x.UserId == "api-user").ExecuteUpdateAsync(x => x.SetProperty(user => user.EmployeeId, actorEmployee.Id));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.Client.PostAsJsonAsync("/api/users", User(departments.Other))).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await f.Client.PostAsJsonAsync("/api/users", User(departments.Department))).StatusCode);
        using var check = f.App.Services.CreateScope(); Assert.Equal(2, await check.ServiceProvider.GetRequiredService<AppDbContext>().Employees.CountAsync());
    }

    [Fact]
    public async Task DuplicateUserDoesNotLeaveAnEmployeeBehind()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f); var request = User(departments.Department); request.UserId = "target";
        Assert.Equal(HttpStatusCode.Conflict, (await f.Client.PostAsJsonAsync("/api/users", request)).StatusCode);
        using var check = f.App.Services.CreateScope(); Assert.Empty(await check.ServiceProvider.GetRequiredService<AppDbContext>().Employees.ToListAsync());
    }

    [Fact]
    public async Task ExistingUserCreationModesStillWorkWithoutEmployeeCreatePermission()
    {
        using var f = new AdministrationApiTests.Fixture(); var departments = await Prepare(f);
        var employee = (await (await f.Client.PostAsJsonAsync("/api/employees", Employee(departments.Department))).Content.ReadFromJsonAsync<EmployeeDto>())!;
        using (var services = f.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>(); var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_EMPLOYEES");
            await db.RoleDetails.Where(x => x.ScreenID == screen.ID).ExecuteUpdateAsync(x => x.SetProperty(r => r.CanNew, "N"));
        }
        var linked = await f.Client.PostAsJsonAsync("/api/users", new { userId = "linked", email = "linked@example.invalid", password = f.App.Password, employeeId = employee.Id, roleIds = Array.Empty<long>() });
        Assert.Equal(HttpStatusCode.Created, linked.StatusCode); Assert.Equal(employee.EmployeeCode, (await linked.Content.ReadFromJsonAsync<AdminUserDto>())!.EmployeeCode);
        var standalone = await f.Client.PostAsJsonAsync("/api/users", new { userId = "standalone", email = "standalone@example.invalid", password = f.App.Password, roleIds = Array.Empty<long>() });
        Assert.Equal(HttpStatusCode.Created, standalone.StatusCode); Assert.Null((await standalone.Content.ReadFromJsonAsync<AdminUserDto>())!.EmployeeCode);
        using var check = f.App.Services.CreateScope(); Assert.Single(await check.ServiceProvider.GetRequiredService<AppDbContext>().Employees.ToListAsync());
    }
}
