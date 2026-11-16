using System.Net;
using System.Net.Http.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class ContractTypeApiTests
{
    private static ContractTypeRequest Type(string code, bool active = true, int order = 0) =>
        new() { Code = code, Name = "Type " + code, IsActive = active, SortOrder = order };
    private static ContractRequest Contract(string code, string number = "C1") =>
        new() { ContractType = code, StartDate = new(2020, 1, 1), Status = "DRAFT" };
    private static async Task Configure(EmployeeApiTests.Harness h)
    {
        await OrganizationApiTests.Grant(h.App, "WEB_CONTRACT_TYPES"); await OrganizationApiTests.Login(h.Client, h.App);
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        db.AddRange(new ContractType { Code = "FIXED", Name = "Fixed term", Prefix = "HDLD" }, new ContractType { Code = "OTHER", Name = "Other", Prefix = "OTHER" },
            new ContractType { Code = "OLD", Name = "Old", IsActive = false });
        await db.SaveChangesAsync();
    }
    [Fact]
    public async Task CatalogCrudRequiresJwtAndEachGrantWithoutEmployeeScope()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/contract-types")).StatusCode);
        await OrganizationApiTests.Login(client, app);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/contract-types")).StatusCode);
        await OrganizationApiTests.Grant(app, "WEB_CONTRACTS"); await OrganizationApiTests.Login(client, app);
        // Contract grants must not authorize configuration on the separate Contract Types screen.
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/contract-types")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/contract-types", Type("FIXED"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync("/api/contract-types/FIXED", new { name = "No" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/api/contract-types/FIXED")).StatusCode);
        await OrganizationApiTests.Grant(app, "WEB_CONTRACT_TYPES"); await OrganizationApiTests.Login(client, app);
        var created = await client.PostAsJsonAsync("/api/contract-types", Type("FIXED"));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode); Assert.NotNull(created.Headers.Location);
        Assert.Equal("FIXED", (await client.GetFromJsonAsync<ContractTypeDto>(created.Headers.Location))!.Code);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsJsonAsync("/api/contract-types", Type("FIXED"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/contract-types", new { code = "bad code", name = "Name" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("/api/contract-types", new { code = "BLANK", name = " " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/contract-types?pageSize=101")).StatusCode);
        (await client.PutAsJsonAsync(created.Headers.Location, new { name = "Updated", isActive = false, sortOrder = 3 })).EnsureSuccessStatusCode();
        Assert.False((await client.GetFromJsonAsync<ContractTypeDto>(created.Headers.Location))!.IsActive);
        using (var services = app.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.RoleDetails.ExecuteUpdateAsync(s => s.SetProperty(d => d.CanNew, "N").SetProperty(d => d.CanUpdate, "N").SetProperty(d => d.CanDelete, "N"));
        }
        await OrganizationApiTests.Login(client, app);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsJsonAsync("/api/contract-types", Type("NO"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PutAsJsonAsync(created.Headers.Location, new { name = "No" })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync(created.Headers.Location)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/contract-types")).StatusCode);
    }
    [Fact]
    public async Task CatalogSupportsSearchActiveFilterStablePagingDeletionAndAudit()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF");
        await OrganizationApiTests.Grant(h.App, "WEB_CONTRACT_TYPES"); await OrganizationApiTests.Login(h.Client, h.App);
        foreach (var type in new[] { Type("B", order: 2), Type("A", order: 2), Type("C", false, 0) })
            (await h.Client.PostAsJsonAsync("/api/contract-types", type)).EnsureSuccessStatusCode();
        var first = (await h.Client.GetFromJsonAsync<PageResult<ContractTypeDto>>("/api/contract-types?isActive=true&pageSize=1"))!;
        Assert.Equal(2, first.Total); Assert.Equal("A", Assert.Single(first.Data).Code);
        Assert.Equal("B", Assert.Single((await h.Client.GetFromJsonAsync<PageResult<ContractTypeDto>>("/api/contract-types?isActive=true&pageSize=1&page=2"))!.Data).Code);
        Assert.Single((await h.Client.GetFromJsonAsync<PageResult<ContractTypeDto>>("/api/contract-types?search=Type%20C"))!.Data);
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.DeleteAsync("/api/contract-types/C")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.GetAsync("/api/contract-types/C")).StatusCode);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(3, await db.Set<AuditLog>().CountAsync(a => a.Action == "CONTRACT_TYPE_CREATED"));
        Assert.Single(await db.Set<AuditLog>().Where(a => a.Action == "CONTRACT_TYPE_DELETED").ToListAsync());
    }
    [Fact]
    public async Task ContractsValidateTypesReturnNamesAndRetainInactiveTypesOnExistingContracts()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await Configure(h);
        var url = $"/api/employees/{h.Self}/contracts";
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync(url, Contract("UNKNOWN"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync(url, Contract("OLD"))).StatusCode);
        var created = await h.Client.PostAsJsonAsync(url, Contract(" FIXED ")); Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var contract = (await created.Content.ReadFromJsonAsync<ContractDto>())!;
        Assert.Equal("FIXED", contract.ContractType); Assert.Equal("Fixed term", contract.ContractTypeName);
        Assert.Equal(contract, await h.Client.GetFromJsonAsync<ContractDto>(created.Headers.Location));
        Assert.Equal("Fixed term", Assert.Single((await h.Client.GetFromJsonAsync<PageResult<ContractDto>>(url))!.Data).ContractTypeName);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.DeleteAsync("/api/contract-types/FIXED")).StatusCode);
        (await h.Client.PutAsJsonAsync("/api/contract-types/FIXED", new { name = "Fixed (retired)", isActive = false })).EnsureSuccessStatusCode();
        Assert.Equal("Fixed (retired)", (await h.Client.GetFromJsonAsync<ContractDto>(created.Headers.Location))!.ContractTypeName);
        var retained = Contract("FIXED"); retained.AttachmentUrl = "https://example.invalid/contract.pdf";
        (await h.Client.PutAsJsonAsync(created.Headers.Location, retained)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync(url, Contract("FIXED", "C2"))).StatusCode);
        retained.ContractType = "OLD";
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync(created.Headers.Location, retained)).StatusCode);
        retained.ContractType = "OTHER";
        (await h.Client.PutAsJsonAsync(created.Headers.Location, retained)).EnsureSuccessStatusCode();
        Assert.Equal("Other", (await h.Client.GetFromJsonAsync<ContractDto>(created.Headers.Location))!.ContractTypeName);
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.DeleteAsync("/api/contract-types/FIXED")).StatusCode); // Sequence history must not be deleted.
    }
    [Fact]
    public async Task LegacyCodeWithWhitespaceCanBeMaintainedWithoutRewritingItsCode()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL");
        await OrganizationApiTests.Grant(h.App, "WEB_CONTRACT_TYPES"); await OrganizationApiTests.Login(h.Client, h.App);
        const string legacyCode = " Legacy Code ";
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new ContractType { Code = legacyCode, Name = "Legacy", Prefix = "LEGACY" }); await db.SaveChangesAsync();
        }
        var created = await h.Client.PostAsJsonAsync($"/api/employees/{h.Self}/contracts", Contract(legacyCode));
        created.EnsureSuccessStatusCode();
        Assert.Equal(legacyCode, (await created.Content.ReadFromJsonAsync<ContractDto>())!.ContractType);
        (await h.Client.PutAsJsonAsync("/api/contract-types/" + Uri.EscapeDataString(legacyCode), new { name = "Retired legacy", isActive = false })).EnsureSuccessStatusCode();
        var update = Contract(legacyCode); update.AttachmentUrl = "https://example.invalid/legacy.pdf";
        (await h.Client.PutAsJsonAsync(created.Headers.Location, update)).EnsureSuccessStatusCode();
        var result = (await h.Client.GetFromJsonAsync<ContractDto>(created.Headers.Location))!;
        Assert.Equal(legacyCode, result.ContractType); Assert.Equal("Retired legacy", result.ContractTypeName);
    }
    [Theory]
    [InlineData("SELF", 0)]
    [InlineData("DEPARTMENT", 2)]
    [InlineData("ALL", 3)]
    public async Task ContractCatalogDoesNotExpandContractEmployeeWriteScope(string scope, int allowed)
    {
        await using var h = await EmployeeApiTests.Harness.Create(scope); await Configure(h);
        foreach (var (id, index) in new[] { (h.Self, 0), (h.Peer, 1), (h.Other, 2) })
        {
            var response = await h.Client.PostAsJsonAsync($"/api/employees/{id}/contracts", Contract("FIXED", "SCOPE" + index));
            Assert.Equal(index < allowed ? HttpStatusCode.Created : scope == "SELF" ? HttpStatusCode.Forbidden : HttpStatusCode.NotFound, response.StatusCode);
        }
    }
    [Fact]
    public async Task ContractTypePermissionDoesNotGrantAccessToEmployeeContracts()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL"); await Configure(h);
        using (var services = h.App.Services.CreateScope())
        {
            var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
            var contractScreenId = await db.Screens.Where(s => s.Code == "WEB_CONTRACTS").Select(s => s.ID).SingleAsync();
            await db.RoleDetails.Where(d => d.ScreenID == contractScreenId).ExecuteDeleteAsync();
            await db.Set<RoleScreenAction>().Where(a => a.ScreenID == contractScreenId).ExecuteDeleteAsync();
        }
        await OrganizationApiTests.Login(h.Client, h.App);
        (await h.Client.GetAsync("/api/contract-types")).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.GetAsync($"/api/employees/{h.Self}/contracts")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync($"/api/employees/{h.Self}/contracts", Contract("FIXED"))).StatusCode);
    }
    [Fact]
    public async Task ReadingNamesUsesBoundedQueriesAndForeignKeyRejectsUnconfiguredType()
    {
        var queries = new EmployeeReadQueries();
        await using var h = await EmployeeApiTests.Harness.Create("ALL", queries: queries); await Configure(h);
        for (var i = 0; i < 3; i++) (await h.Client.PostAsJsonAsync($"/api/employees/{h.Self}/contracts", Contract("FIXED", "N" + i))).EnsureSuccessStatusCode();
        queries.Commands.Clear();
        var page = (await h.Client.GetFromJsonAsync<PageResult<ContractDto>>($"/api/employees/{h.Self}/contracts?pageSize=1"))!;
        var count = queries.Commands.Count;
        Assert.Equal(3, page.Total); Assert.Equal("Fixed term", Assert.Single(page.Data).ContractTypeName);
        queries.Commands.Clear();
        (await h.Client.GetAsync($"/api/employees/{h.Self}/contracts?pageSize=3")).EnsureSuccessStatusCode();
        Assert.Equal(count, queries.Commands.Count);
        using var services = h.App.Services.CreateScope(); var db = services.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Add(new Contract { EmployeeID = h.Self, ContractNo = "INVALIDFK", ContractType = "NOT_CONFIGURED", StartDate = new(2020, 1, 1), Status = "DRAFT" });
        await Assert.ThrowsAsync<DbUpdateException>(() => db.SaveChangesAsync());
    }
}
