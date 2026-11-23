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
}
