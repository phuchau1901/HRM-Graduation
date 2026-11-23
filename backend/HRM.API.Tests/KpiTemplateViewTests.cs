using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class KpiTemplateViewTests
{
    [Fact]
    public async Task TemplateListAndDetailIncludeRelatedNamesAndRetainUnassignedTemplates()
    {
        await using var f = await PerformanceTests.Setup();
        int teamId; long positionId; string departmentName; long departmentTemplateId;
        using(var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var position = new Position { Code = "KPI_VIEW", Name = "Kỹ sư", IsActive = true }; db.Add(position); await db.SaveChangesAsync(); positionId = position.ID;
            var team = await db.Set<Team>().FirstAsync(x => x.DepartmentId == f.H.Department); teamId = team.Id;
            departmentName = (await db.Departments.SingleAsync(x => x.Id == f.H.Department)).DepartmentName;
            var departmentTemplate = new KpiTemplate { Code = "A_DEPT", Name = "Phòng ban", DepartmentId = f.H.Department, PeriodType = "MONTH", Status = "DRAFT" };
            db.AddRange(departmentTemplate,
                new KpiTemplate { Code = "B_POSITION", Name = "Chức vụ", PositionId = positionId, PeriodType = "MONTH", Status = "DRAFT" },
                new KpiTemplate { Code = "C_TEAM", Name = "Team", TeamId = teamId, PeriodType = "MONTH", Status = "DRAFT" },
                new KpiTemplate { Code = "D_ALL", Name = "Dùng chung", PeriodType = "MONTH", Status = "DRAFT" });
            await db.SaveChangesAsync(); departmentTemplateId = departmentTemplate.ID;
        }
        var page = (await f.H.Client.GetFromJsonAsync<PageResult<KpiTemplateView>>("/api/kpi/configuration/templates?pageSize=20"))!;
        Assert.Equal(4, page.Total);
        var department = Assert.Single(page.Data, x => x.Code == "A_DEPT"); Assert.Equal(f.H.Department, department.DepartmentId); Assert.Equal(departmentName, department.DepartmentName);
        var positionView = Assert.Single(page.Data, x => x.Code == "B_POSITION"); Assert.Equal(positionId, positionView.PositionId); Assert.Equal("Kỹ sư", positionView.PositionName);
        var teamView = Assert.Single(page.Data, x => x.Code == "C_TEAM"); Assert.Equal(teamId, teamView.TeamId); Assert.Equal("Workflow", teamView.TeamName);
        var global = Assert.Single(page.Data, x => x.Code == "D_ALL"); Assert.Null(global.DepartmentId); Assert.Null(global.DepartmentName); Assert.Null(global.PositionId); Assert.Null(global.PositionName); Assert.Null(global.TeamId); Assert.Null(global.TeamName);
        var detail = await f.H.Client.GetFromJsonAsync<JsonElement>($"/api/kpi/configuration/templates/{departmentTemplateId}");
        Assert.Equal(departmentName, detail.GetProperty("template").GetProperty("departmentName").GetString());
        var second = (await f.H.Client.GetFromJsonAsync<PageResult<KpiTemplateView>>("/api/kpi/configuration/templates?page=2&pageSize=2"))!;
        Assert.Equal(4, second.Total); Assert.Equal(new[] { "C_TEAM", "D_ALL" }, second.Data.Select(x => x.Code));
    }
    [Fact]
    public async Task SixDatabaseRowsReturnSixForAllAndOnlySharedPositionForDepartment()
    {
        await using var f = await PerformanceTests.Setup();
        using(var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var position = new Position { Code = "BACKEND_SCOPE", Name = "Backend Developer", IsActive = true }; db.Add(position); await db.SaveChangesAsync();
            db.Add(new KpiTemplate { Code = "TPL_IT_BACKEND", Name = "KPI Backend Developer", PositionId = position.ID, Status = "PUBLISHED", PeriodType = "MONTH" });
            for(var n = 1; n <= 5; n++) db.Add(new KpiTemplate { Code = $"TPL_OTHER_{n}", Name = $"Department template {n}", DepartmentId = f.H.OtherDepartment, Status = "PUBLISHED", PeriodType = "MONTH" });
            await db.SaveChangesAsync();
            Assert.Equal(6, await db.Set<KpiTemplate>().CountAsync());
        }
        var allResponse = await f.H.Client.GetAsync("/api/kpi/configuration/templates"); allResponse.EnsureSuccessStatusCode();
        Assert.Equal("ALL", Assert.Single(allResponse.Headers.GetValues("X-Effective-Data-Scope")));
        Assert.Equal("false", Assert.Single(allResponse.Headers.GetValues("X-Search-Applied")));
        var all = (await allResponse.Content.ReadFromJsonAsync<PageResult<KpiTemplateView>>())!;
        Assert.Equal(6, all.Total); Assert.Equal(6, all.Data.Count);
        var filteredResponse = await f.H.Client.GetAsync("/api/kpi/configuration/templates?search=TPL_IT_BACKEND"); filteredResponse.EnsureSuccessStatusCode();
        Assert.Equal("ALL", Assert.Single(filteredResponse.Headers.GetValues("X-Effective-Data-Scope")));
        Assert.Equal("true", Assert.Single(filteredResponse.Headers.GetValues("X-Search-Applied")));
        var filtered = (await filteredResponse.Content.ReadFromJsonAsync<PageResult<KpiTemplateView>>())!;
        Assert.Equal(1, filtered.Total); Assert.Single(filtered.Data);
        using(var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<HRM.API.Modules.Authorization.Entities.RoleScreenAction>().Where(x => x.ActionCode == "VIEW" && db.Screens.Any(s => s.ID == x.ScreenID && s.Code == "WEB_KPI_CONFIGURATION"))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.DataScope, "DEPARTMENT"));
        }
        var departmentResponse = await f.H.Client.GetAsync("/api/kpi/configuration/templates"); departmentResponse.EnsureSuccessStatusCode();
        Assert.Equal("DEPARTMENT", Assert.Single(departmentResponse.Headers.GetValues("X-Effective-Data-Scope")));
        var department = (await departmentResponse.Content.ReadFromJsonAsync<PageResult<KpiTemplateView>>())!;
        Assert.Equal(1, department.Total);Assert.Equal("TPL_IT_BACKEND", Assert.Single(department.Data).Code);
        // ALL on another granted role must still win; no dependence on role ordering.
        using(var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var role = await db.Set<HRM.API.Modules.Authorization.Entities.Role>().SingleAsync(x => x.Code == "EMPLOYEE");
            var screen = await db.Screens.SingleAsync(x => x.Code == "WEB_KPI_CONFIGURATION");
            db.Add(new HRM.API.Modules.Authorization.Entities.RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = "Y" });
            db.Add(new HRM.API.Modules.Authorization.Entities.RoleScreenAction { RoleID = role.ID, ScreenID = screen.ID, ActionCode = "VIEW", DataScope = "ALL" });
            await db.SaveChangesAsync();
        }
        var mergedResponse = await f.H.Client.GetAsync("/api/kpi/configuration/templates"); mergedResponse.EnsureSuccessStatusCode();
        Assert.Equal("ALL", Assert.Single(mergedResponse.Headers.GetValues("X-Effective-Data-Scope")));
        var merged = (await mergedResponse.Content.ReadFromJsonAsync<PageResult<KpiTemplateView>>())!;
        Assert.Equal(6, merged.Total); Assert.Equal(6, merged.Data.Count);
    }
}
