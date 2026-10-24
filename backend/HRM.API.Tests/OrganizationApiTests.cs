using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class OrganizationApiTests
{
    [Theory]
    [InlineData("departments", "WEB_DEPARTMENTS")]
    [InlineData("positions", "WEB_POSITIONS")]
    public async Task CrudRequiresJwtAndGrantsAndValidatesUniqueCodes(string resource, string screen)
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync(); var url = "/api/" + resource;
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(url)).StatusCode);
        await Login(client, app);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(url)).StatusCode);
        await Grant(app, screen); await Login(client, app);
        object payload = resource == "departments" ? new { departmentCode = "ORG01", departmentName = "Operations", isActive = true }
            : new { code = "POS01", name = "Specialist", isActive = true };
        var created = await client.PostAsJsonAsync(url, payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode); Assert.NotNull(created.Headers.Location);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(created.Headers.Location)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync(url, payload)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync(url, new { })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync(url + "?pageSize=1000")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync(created.Headers.Location, payload)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync(created.Headers.Location)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(created.Headers.Location)).StatusCode);
    }

    [Fact]
    public async Task ReferencedDepartmentCannotBeDeletedAndListIsPaged()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync(); await Grant(app, "WEB_DEPARTMENTS"); await Login(client, app);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var department = new Department { DepartmentCode = "BUSY", DepartmentName = "Busy" };
        db.Add(department); await db.SaveChangesAsync();
        db.Add(new Employee { EmployeeCode = "EMP1", FullName = "Employee", Email = "employee@example.invalid", DepartmentId = department.Id });
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/departments/{department.Id}")).StatusCode);
        using var json = System.Text.Json.JsonDocument.Parse(await client.GetStringAsync("/api/departments?pageSize=1&search=BUSY"));
        Assert.True(json.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(1, json.RootElement.GetProperty("total").GetInt32());
        Assert.Single(json.RootElement.GetProperty("data").EnumerateArray());
    }
    [Fact]
    public async Task InactivePositionIsPersistedAndReferencedHistoryBlocksDeletion()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync(); await Grant(app, "WEB_POSITIONS"); await Login(client, app);
        var created = await client.PostAsJsonAsync("/api/positions", new { code = "OLD", name = "Old Position", isActive = false });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var position = (await created.Content.ReadFromJsonAsync<PositionDto>())!;
        Assert.False((await client.GetFromJsonAsync<PositionDto>($"/api/positions/{position.Id}"))!.IsActive);
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var department = new Department { DepartmentCode = "HISTORY", DepartmentName = "History" };
        db.Add(department); await db.SaveChangesAsync();
        var employee = new Employee { EmployeeCode = "HISTORY", FullName = "History", Email = "history@example.invalid", DepartmentId = department.Id };
        db.Add(employee); await db.SaveChangesAsync();
        db.Add(new EmployeeHistory { EmployeeID = employee.Id, OldPositionID = position.Id, EffectiveDate = new(2020, 1, 1), ChangedByUserID = "api-user" });
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.Conflict, (await client.DeleteAsync($"/api/positions/{position.Id}")).StatusCode);
    }
    internal static async Task Grant(AuthApiFactory app, string code)
    {
        using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var screen = new Screen { Code = code, Name = code, IsActive = true }; db.Add(screen); await db.SaveChangesAsync();
        var role = await db.Set<Role>().FirstAsync();
        db.Add(new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = "Y", CanNew = "Y", CanUpdate = "Y", CanDelete = "Y" });
        await db.SaveChangesAsync();
    }
    internal static async Task Login(HttpClient client, AuthApiFactory app)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password });
        response.EnsureSuccessStatusCode(); client.DefaultRequestHeaders.Authorization = new("Bearer", (await response.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
    }
}
