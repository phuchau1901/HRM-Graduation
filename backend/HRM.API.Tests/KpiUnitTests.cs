using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class KpiUnitTests
{
    [Fact]
    public async Task UnitCrudVersionAndMetricSelectionKeepHistoryCompatible()
    {
        await using var f = await PerformanceTests.Setup(); var client = f.H.Client;
        var created = await client.PostAsJsonAsync("/api/kpi/configuration/units", new { code = "KG", name = "Kilôgam", sortOrder = 20 });
        created.EnsureSuccessStatusCode(); var unit = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data"); var id = unit.GetProperty("id").GetInt64();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/kpi/configuration/units", new { code = "KG", name = "Duplicate" })).StatusCode);
        var metricResponse = await client.PostAsJsonAsync("/api/kpi/configuration/metrics", new { code = "WEIGHT", name = "Sản lượng", unit = "KG" }); metricResponse.EnsureSuccessStatusCode();
        var metric = (await metricResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data"); var metricId = metric.GetProperty("id").GetInt64(); Assert.Equal(id, metric.GetProperty("unitId").GetInt64());
        (await client.PutAsJsonAsync($"/api/kpi/configuration/units/{id}", new { code = "KG", name = "Kilogram", isActive = false, sortOrder = 21, version = 1 })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync($"/api/kpi/configuration/units/{id}", new { code = "KG", name = "Stale", version = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PutAsJsonAsync($"/api/kpi/configuration/units/{id}", new { code = "KILOGRAM", name = "Rename code", version = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/kpi/configuration/metrics", new { code = "NEW_WEIGHT", name = "New weight", unit = "KG" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/kpi/configuration/metrics", new { code = "UNKNOWN", name = "Unknown", unit = "not-in-catalog" })).StatusCode);
        // Existing metric may retain its inactive code; it does not rewrite historical snapshots.
        (await client.PutAsJsonAsync($"/api/kpi/configuration/metrics/{metricId}", new { code = "WEIGHT", name = "Sản lượng mới", unit = "KG", version = 1 })).EnsureSuccessStatusCode();
        var active = (await client.GetFromJsonAsync<PageResult<KpiUnit>>("/api/kpi/configuration/units?isActive=true"))!;
        Assert.DoesNotContain(active.Data, x => x.Code == "KG");
        var inactive = (await client.GetFromJsonAsync<PageResult<KpiUnit>>("/api/kpi/configuration/units?isActive=false&search=KG"))!;
        Assert.Equal(id, Assert.Single(inactive.Data).ID);
        using var scope = f.H.App.Services.CreateScope();var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal("KG", (await db.Set<KpiMetric>().SingleAsync(x => x.ID == metricId)).Unit);
        Assert.True(await db.Set<HRM.API.Modules.System.Entities.AuditLog>().AnyAsync(x => x.EntityType == "KPI_UNIT"));
    }
    [Fact]
    public async Task CatalogReadRequiresViewAndGlobalWritesRequireAllScope()
    {
        await using var f = await PerformanceTests.Setup();
        using var anonymous = f.H.App.CreateClient(new() { BaseAddress = new("https://localhost") });
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/kpi/configuration/units")).StatusCode);
        using var lead = await f.As("lead"); Assert.Equal(HttpStatusCode.Forbidden, (await lead.GetAsync("/api/kpi/configuration/units")).StatusCode);
        using(var scope = f.H.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Set<RoleScreenAction>().Where(x => x.ActionCode == "NEW" && db.Screens.Any(s => s.ID == x.ScreenID && s.Code == "WEB_KPI_CONFIGURATION")).ExecuteUpdateAsync(s => s.SetProperty(x => x.DataScope, "DEPARTMENT"));
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await f.H.Client.PostAsJsonAsync("/api/kpi/configuration/units", new { code = "BOX", name = "Thùng" })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await f.H.Client.GetAsync("/api/kpi/configuration/units?isActive=true")).StatusCode);
    }
    [Fact]
    public void MigrationAddsOnlyCatalogAndNullableMetricFk()
    {
        var migration = new HRM.API.Migrations.AddKpiUnitCatalog();
        Assert.Equal("kpi_units", Assert.Single(migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.CreateTableOperation>()).Name);
        var fk = Assert.Single(migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.AddForeignKeyOperation>());
        Assert.Equal("kpi_units", fk.PrincipalTable);
        var column = Assert.Single(migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.AddColumnOperation>());
        Assert.True(column.IsNullable);Assert.Equal("unit_id", column.Name);
        Assert.DoesNotContain(migration.UpOperations, op => op is Microsoft.EntityFrameworkCore.Migrations.Operations.UpdateDataOperation);
    }
}
