using System.Net;
using System.Net.Http.Json;
using HRM.API.Data;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class ContractNumberTests
{
    private static AttendanceTestClock Clock() => new() { Now = new(2026, 12, 31, 17, 0, 0, TimeSpan.Zero) };
    private static object Body(int employeeId, string type = "FIXED_TERM") => new { employeeId, contractType = type, startDate = "2020-01-01", status = "DRAFT" };
    private static async Task Configure(EmployeeApiTests.Harness h)
    {
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.AddRange(new ContractType { Code = "FIXED_TERM", Name = "Fixed term", Prefix = "HDLD" }, new ContractType { Code = "PROBATION", Name = "Probation", Prefix = "TV" });
        await db.SaveChangesAsync();
    }
    private static async Task<ContractDto> Create(EmployeeApiTests.Harness h, string type = "FIXED_TERM")
    {
        var response = await h.Client.PostAsJsonAsync("/api/contracts", Body(h.Self, type));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode); Assert.NotNull(response.Headers.Location);
        return (await response.Content.ReadFromJsonAsync<ContractDto>())!;
    }
    [Fact]
    public async Task CreatesFirstSequenceAtOneInVietnamYearAndIncrementsIndependentlyPerType()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock()); await Configure(h);
        Assert.Equal("HDLD-2027-000001", (await Create(h)).ContractNo);
        Assert.Equal("HDLD-2027-000002", (await Create(h)).ContractNo);
        Assert.Equal("TV-2027-000001", (await Create(h, "PROBATION")).ContractNo);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sequence = await db.Set<DocumentSequence>().FindAsync("FIXED_TERM", 2027);
        Assert.Equal(2, sequence!.LastNumber); Assert.Equal(2, await db.Set<DocumentSequence>().CountAsync());
    }
    [Fact]
    public async Task VietnamNewYearCreatesNewRowWithoutResettingPreviousYear()
    {
        var clock = Clock(); clock.Now = new(2026, 12, 31, 16, 59, 59, TimeSpan.Zero);
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: clock); await Configure(h);
        Assert.Equal("HDLD-2026-000001", (await Create(h)).ContractNo);
        clock.Now = new(2026, 12, 31, 17, 0, 0, TimeSpan.Zero);
        Assert.Equal("HDLD-2027-000001", (await Create(h)).ContractNo);
        using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, (await db.Set<DocumentSequence>().FindAsync("FIXED_TERM", 2026))!.LastNumber);
        Assert.Equal(1, (await db.Set<DocumentSequence>().FindAsync("FIXED_TERM", 2027))!.LastNumber);
    }
    [Fact]
    public async Task PrefixCatalogReadEditAndChangePreserveCounterAndIssuedNumbers()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock()); await Configure(h);
        await OrganizationApiTests.Grant(h.App, "WEB_CONTRACT_TYPES"); await OrganizationApiTests.Login(h.Client, h.App);
        var old = await Create(h);
        var page = (await h.Client.GetFromJsonAsync<HRM.API.Common.PageResult<ContractTypeDto>>("/api/contract-types?search=FIXED_TERM"))!;
        Assert.Equal("HDLD", Assert.Single(page.Data).Prefix);
        var type = (await h.Client.GetFromJsonAsync<ContractTypeDto>("/api/contract-types/FIXED_TERM"))!; Assert.Equal("HDLD", type.Prefix);
        (await h.Client.PutAsJsonAsync("/api/contract-types/FIXED_TERM", new { name = "Fixed term", prefix = "HDNEW", isActive = true })).EnsureSuccessStatusCode();
        Assert.Equal("HDNEW-2027-000002", (await Create(h)).ContractNo);
        Assert.Equal(old.ContractNo, (await h.Client.GetFromJsonAsync<ContractDto>($"/api/employees/{h.Self}/contracts/{old.Id}"))!.ContractNo);
        (await h.Client.PutAsJsonAsync("/api/contract-types/FIXED_TERM", new { name = "Renamed", isActive = true })).EnsureSuccessStatusCode();
        Assert.Equal("HDNEW", (await h.Client.GetFromJsonAsync<ContractTypeDto>("/api/contract-types/FIXED_TERM"))!.Prefix);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PutAsJsonAsync("/api/contract-types/FIXED_TERM", new { name = "Fixed", prefix = "bad prefix" })).StatusCode);
        var updated = await h.Client.PutAsJsonAsync($"/api/employees/{h.Self}/contracts/{old.Id}", new { contractNo = "RENAME", contractType = "FIXED_TERM", startDate = "2020-01-01", status = "DRAFT" });
        Assert.Equal(HttpStatusCode.BadRequest, updated.StatusCode);
    }
    [Fact]
    public async Task ClientNumbersAreIgnoredAndCommittedLegacyNumbersAreNeverReissued()
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock()); await Configure(h);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new Contract { ContractNo = "HDLD-2027-000001", ContractType = "FIXED_TERM", EmployeeID = h.Self, StartDate = new(2020, 1, 1), Status = "TERMINATED" });
            await db.SaveChangesAsync();
        }
        var response = await h.Client.PostAsJsonAsync("/api/contracts", new { employeeId = h.Self, contractNo = "MANUAL", contractType = "FIXED_TERM", startDate = "2020-01-01", status = "DRAFT" });
        response.EnsureSuccessStatusCode(); Assert.Equal("HDLD-2027-000002", (await response.Content.ReadFromJsonAsync<ContractDto>())!.ContractNo);
        var nested = await h.Client.PostAsJsonAsync($"/api/employees/{h.Self}/contracts", Body(h.Self));
        nested.EnsureSuccessStatusCode(); Assert.Equal("HDLD-2027-000003", (await nested.Content.ReadFromJsonAsync<ContractDto>())!.ContractNo);
    }
    [Theory]
    [InlineData(null, true)]
    [InlineData("bad-prefix", true)]
    [InlineData("HDLD", false)]
    public async Task InvalidOrInactivePrefixDoesNotCreateContractOrSequence(string? prefix, bool active)
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock());
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Add(new ContractType { Code = "FIXED_TERM", Name = "Fixed", Prefix = prefix, IsActive = active }); await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/contracts", Body(h.Self))).StatusCode);
        using var services = h.App.Services.CreateScope(); var context = services.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Empty(await context.Set<Contract>().ToListAsync()); Assert.Empty(await context.Set<DocumentSequence>().ToListAsync());
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task FailureAfterContractInsertRollsBackContractAndSequence(bool existingSequence)
    {
        await using var h = await EmployeeApiTests.Harness.Create("ALL", failNotification: true, clock: Clock()); await Configure(h);
        if (existingSequence)
        {
            using var seedScope = h.App.Services.CreateScope(); var seed = seedScope.ServiceProvider.GetRequiredService<AppDbContext>();
            seed.Add(new DocumentSequence { DocumentType = "FIXED_TERM", DocumentYear = 2027, LastNumber = 7 });
            seed.Add(new Contract { EmployeeID = h.Self, ContractNo = "HDLD-2027-000007", ContractType = "FIXED_TERM", StartDate = new(2020, 1, 1), Status = "DRAFT" });
            await seed.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.InternalServerError, (await h.Client.PostAsJsonAsync("/api/contracts", Body(h.Self))).StatusCode);
        using (var scope = h.App.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(existingSequence ? 1 : 0, await db.Set<Contract>().CountAsync());
            var sequence = await db.Set<DocumentSequence>().FindAsync("FIXED_TERM", 2027);
            if (existingSequence) Assert.Equal(7, sequence!.LastNumber); else Assert.Null(sequence);
        }
        // The failed transaction never issued its number; another employee can use it after rollback.
        var response = await h.Client.PostAsJsonAsync("/api/contracts", Body(h.Peer)); response.EnsureSuccessStatusCode();
        Assert.Equal(existingSequence ? "HDLD-2027-000008" : "HDLD-2027-000001", (await response.Content.ReadFromJsonAsync<ContractDto>())!.ContractNo);
    }
    [Fact]
    public async Task ConcurrentRequestsOnSeparateConnectionsNeverDuplicateContractNumbers()
    {
        var path = Path.Combine(Path.GetTempPath(), "hrm-contract-sequences-" + Guid.NewGuid().ToString("N") + ".db");
        try
        {
            await using var h = await EmployeeApiTests.Harness.Create("ALL", clock: Clock(), sqlitePath: path); await Configure(h);
            var responses = await Task.WhenAll(Enumerable.Range(0, 6).Select(_ => h.Client.PostAsJsonAsync("/api/contracts", Body(h.Self))));
            Assert.All(responses, r => Assert.Equal(HttpStatusCode.Created, r.StatusCode));
            var rows = await Task.WhenAll(responses.Select(async r => (await r.Content.ReadFromJsonAsync<ContractDto>())!));
            Assert.Equal(6, rows.Select(r => r.ContractNo).Distinct().Count());
            using var scope = h.App.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.Equal(6, (await db.Set<DocumentSequence>().FindAsync("FIXED_TERM", 2027))!.LastNumber);
        }
        finally { Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools(); foreach (var suffix in new[] { "", "-wal", "-shm" }) if (File.Exists(path + suffix)) File.Delete(path + suffix); }
    }
    [Fact]
    public async Task PrefixCanBeConfiguredAtCreationAndPermissionAndScopeAreStillRequired()
    {
        await using var h = await EmployeeApiTests.Harness.Create("SELF", clock: Clock());
        await OrganizationApiTests.Grant(h.App, "WEB_CONTRACT_TYPES"); await OrganizationApiTests.Login(h.Client, h.App);
        var response = await h.Client.PostAsJsonAsync("/api/contract-types", new { code = "FIXED_TERM", name = "Fixed", prefix = "HDLD" }); response.EnsureSuccessStatusCode();
        Assert.Equal("HDLD", (await response.Content.ReadFromJsonAsync<ContractTypeDto>())!.Prefix);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Client.PostAsJsonAsync("/api/contracts", Body(h.Self))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await h.Client.PostAsJsonAsync("/api/contracts", new { contractType = "FIXED_TERM", startDate = "2020-01-01", status = "DRAFT" })).StatusCode);
    }
}
