using System.Data.Common;
using HRM.API.Data;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace HRM.API.Tests;

public sealed class PermissionServiceTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AuthorizationTestContext _db;
    private readonly Queries _queries = new();
    private readonly IPermissionService _service;
    public PermissionServiceTests()
    {
        _connection.Open();
        _db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).AddInterceptors(_queries).Options);
        _db.Database.EnsureCreated(); _service = new PermissionService(_db);
    }

    [Theory]
    [InlineData("VIEW")] [InlineData("NEW")] [InlineData("UPDATE")]
    [InlineData("DELETE")] [InlineData("APPROVE")] [InlineData("EXPORT")]
    public async Task AnyAssignedRoleCanGrantItsActionWithoutViewInOneFreshQuery(string action)
    {
        var admin = new Role { Code = "ADMIN", Name = "Admin" };
        var hr = new Role { Code = "HR", Name = "HR" };
        var screen = new Screen { Code = "WEB_EMPLOYEES", Name = "Employees", IsActive = true };
        _db.AddRange(new User { UserId = "admin", Email = "admin@example.invalid", Status = "ACTIVE" }, admin, hr, screen);
        await _db.SaveChangesAsync();
        var grant = new RoleDetail { RoleID = hr.ID, ScreenID = screen.ID };
        _db.AddRange(new UserRole { UserID = "admin", RoleID = admin.ID }, new UserRole { UserID = "admin", RoleID = hr.ID },
            new RoleDetail { RoleID = admin.ID, ScreenID = screen.ID }, grant);
        await _db.SaveChangesAsync();
        Assert.False(await _service.HasPermissionAsync("admin", screen.Code, action));
        SetFlag(grant, action, "Y"); await _db.SaveChangesAsync(); _queries.Sql.Clear();
        Assert.True(await _service.HasPermissionAsync("admin", screen.Code, action));
        var sql = Assert.Single(_queries.Sql);
        Assert.Contains("EXISTS", sql); Assert.Contains("INNER JOIN \"role_details\"", sql);
        Assert.Contains("INNER JOIN \"screens\"", sql); Assert.Contains("INNER JOIN \"user_roles\"", sql);
        if(action != "VIEW")
        {
            Assert.Equal("N", grant.CanView);
            Assert.Empty((await new AuthProfileService(_db).GetAsync("admin"))!.Permissions);
        }
        SetFlag(grant, action, "N"); await _db.SaveChangesAsync();
        Assert.False(await _service.HasPermissionAsync("admin", screen.Code, action));
    }

    [Fact]
    public async Task MissingInactiveAndUnassignedDataDenyIncludingAdmin()
    {
        var role = new Role { Code = "ADMIN", Name = "Admin" }; var other = new Role { Code = "OTHER", Name = "Other" };
        var screen = new Screen { Code = "WEB_EMPLOYEES", Name = "Employees", IsActive = true };
        var user = new User { UserId = "admin", Email = "admin@example.invalid", Status = "ACTIVE" };
        _db.AddRange(role, other, screen, user); await _db.SaveChangesAsync();
        _db.AddRange(new UserRole { UserID = "admin", RoleID = role.ID },
            new RoleDetail { RoleID = other.ID, ScreenID = screen.ID, CanView = "Y" }); await _db.SaveChangesAsync();
        Assert.False(await _service.HasPermissionAsync("admin", screen.Code, "VIEW"));
        var own = new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = "Y" };
        _db.Add(own); await _db.SaveChangesAsync();
        Assert.True(await _service.HasPermissionAsync("admin", screen.Code, "VIEW"));
        Assert.False(await _service.HasPermissionAsync("missing", screen.Code, "VIEW"));
        Assert.False(await _service.HasPermissionAsync("admin", "MISSING", "VIEW"));
        screen.IsActive = false; await _db.SaveChangesAsync();
        Assert.False(await _service.HasPermissionAsync("admin", screen.Code, "VIEW"));
        screen.IsActive = true; user.Status = "DISABLED"; await _db.SaveChangesAsync();
        Assert.False(await _service.HasPermissionAsync("admin", screen.Code, "VIEW"));
        user.Status = "ACTIVE"; _db.Remove(own); await _db.SaveChangesAsync();
        Assert.False(await _service.HasPermissionAsync("admin", screen.Code, "VIEW"));
    }

    [Theory]
    [InlineData("")] [InlineData("EXECUTE")] [InlineData("DELETE; DROP TABLE users")]
    public async Task UnknownActionsDenyBeforeAnyQuery(string action)
    {
        _queries.Sql.Clear();
        Assert.False(await _service.HasPermissionAsync("admin", "WEB_EMPLOYEES", action));
        Assert.Empty(_queries.Sql);
    }

    internal static void SetFlag(RoleDetail grant, string action, string value)
    {
        switch(action)
        {
            case "VIEW": grant.CanView = value; break;
            case "NEW": grant.CanNew = value; break;
            case "UPDATE": grant.CanUpdate = value; break;
            case "DELETE": grant.CanDelete = value; break;
            case "APPROVE": grant.CanApprove = value; break;
            case "EXPORT": grant.CanExport = value; break;
        }
    }
    public void Dispose() { _db.Dispose(); _connection.Dispose(); }
    private sealed class Queries : DbCommandInterceptor
    {
        internal List<string> Sql { get; } = new();
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken ct = default)
        { Sql.Add(command.CommandText); return ValueTask.FromResult(result); }
    }
}
