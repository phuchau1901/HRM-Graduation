using System.Data.Common;
using System.Security.Claims;
using HRM.API.Data;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Authorization.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Xunit;

namespace HRM.API.Tests;

public sealed class AuthProfileServiceTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly AuthorizationTestContext _db;
    private readonly ReadQueries _queries = new();
    private readonly AuthProfileService _service;
    public AuthProfileServiceTests()
    {
        _connection.Open();
        _db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).AddInterceptors(_queries).Options);
        _db.Database.EnsureCreated();
        _service = new(_db);
    }

    [Fact]
    public async Task NoRolesOrNoGrantsReturnsNoScreensEvenForAdmin()
    {
        var admin = new User { UserId = "admin", Email = "admin@example.invalid", Status = "ACTIVE" };
        var role = new Role { Code = "ADMIN", Name = "Administrator" };
        _db.AddRange(admin, role, new Screen { Code = "UNASSIGNED", Name = "Unassigned" });
        await _db.SaveChangesAsync();
        Assert.Empty((await _service.GetAsync("admin"))!.Permissions);
        _db.Add(new UserRole { UserID = "admin", RoleID = role.ID }); await _db.SaveChangesAsync();
        var profile = (await _service.GetAsync("admin"))!;
        Assert.Equal("ADMIN", Assert.Single(profile.Roles).Code);
        Assert.Empty(profile.Permissions);
        Assert.Null(await _service.GetAsync("missing"));
        admin.Status = "DISABLED"; await _db.SaveChangesAsync();
        Assert.Null(await _service.GetAsync("admin"));
    }

    [Fact]
    public async Task JoinsOnlyAssignedRoleGrantsAndFiltersViewAfterOrAcrossEveryAction()
    {
        var user = new User { UserId = "admin", Email = "admin@example.invalid", Status = "ACTIVE" };
        var one = new Role { Code = "ADMIN", Name = "Admin" };
        var two = new Role { Code = "HR", Name = "HR" };
        var unrelated = new Role { Code = "OTHER", Name = "Other" };
        var visible = new Screen { Code = "VISIBLE", Name = "Visible", Platform = "WEB", Icon = "staff" };
        var hidden = new Screen { Code = "NO_VIEW", Name = "No view" };
        var inactive = new Screen { Code = "INACTIVE", Name = "Inactive", IsActive = false };
        var other = new Screen { Code = "OTHER_ONLY", Name = "Other user only" };
        _db.AddRange(user, one, two, unrelated, visible, hidden, inactive, other,
            new Screen { Code = "NO_GRANTS", Name = "No grants" },
            new User { UserId = "other", Email = "other@example.invalid", Status = "ACTIVE" });
        await _db.SaveChangesAsync();
        _db.AddRange(new UserRole { UserID = "admin", RoleID = one.ID }, new UserRole { UserID = "admin", RoleID = two.ID },
            new UserRole { UserID = "other", RoleID = unrelated.ID },
            new RoleDetail { RoleID = one.ID, ScreenID = visible.ID, CanView = "Y", CanNew = "Y", CanDelete = "Y" },
            new RoleDetail { RoleID = two.ID, ScreenID = visible.ID, CanView = "N", CanUpdate = "Y", CanApprove = "Y", CanExport = "Y" },
            new RoleDetail { RoleID = one.ID, ScreenID = hidden.ID, CanView = "N", CanUpdate = "Y" },
            new RoleDetail { RoleID = one.ID, ScreenID = inactive.ID, CanView = "Y" },
            new RoleDetail { RoleID = unrelated.ID, ScreenID = other.ID, CanView = "Y" });
        await _db.SaveChangesAsync(); _queries.Commands.Clear();
        var profile = (await _service.GetAsync("admin"))!;
        Assert.Equal(2, profile.Roles.Count);
        var permission = Assert.Single(profile.Permissions);
        Assert.Equal(visible.ID, permission.ScreenId);
        Assert.Equal("VISIBLE", permission.Code); Assert.Equal("Visible", permission.Name);
        Assert.Equal("WEB", permission.Platform); Assert.Equal("staff", permission.Icon);
        Assert.All(new[] { permission.CanNew, permission.CanView, permission.CanUpdate,
            permission.CanDelete, permission.CanApprove, permission.CanExport }, flag => Assert.Equal("Y", flag));
        var screenQueries = _queries.Commands.Where(q => q.Contains("\"screens\"", StringComparison.OrdinalIgnoreCase)).ToArray();
        var sql = Assert.Single(screenQueries);
        Assert.Contains("INNER JOIN \"role_details\"", sql);
        Assert.Contains("INNER JOIN \"screens\"", sql);
        Assert.Contains("FROM \"user_roles\"", sql);
        Assert.Contains("WHERE", sql); Assert.Contains("user_id", sql);
    }

    [Theory]
    [InlineData(ScreenAction.New)] [InlineData(ScreenAction.View)] [InlineData(ScreenAction.Update)]
    [InlineData(ScreenAction.Delete)] [InlineData(ScreenAction.Approve)] [InlineData(ScreenAction.Export)]
    public async Task NewSnapshotReflectsCurrentGrantForEachAction(ScreenAction action)
    {
        var role = new Role { Code = "ADMIN", Name = "Admin" };
        var screen = new Screen { Code = "STAFF", Name = "Staff" };
        _db.AddRange(role, screen, new User { UserId = "admin", Email = "admin@example.invalid", Status = "ACTIVE" });
        await _db.SaveChangesAsync();
        var detail = new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = "Y" };
        _db.AddRange(detail, new UserRole { UserID = "admin", RoleID = role.ID }); await _db.SaveChangesAsync();
        var handler = new ScreenPermissionHandler();
        var principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", "admin") }, "test"));
        async Task<bool> Allowed()
        {
            var snapshot = await new PermissionService(_db).GetSnapshotAsync("admin");
            principal = new ClaimsPrincipal(new ClaimsIdentity(new[] { new Claim("sub", "admin"), new Claim("hrm_pv", "1"),
                new Claim("hrm_p", System.Text.Json.JsonSerializer.Serialize(snapshot)) }, "test"));
            var context = new AuthorizationHandlerContext(new[] { new ScreenPermissionRequirement("STAFF", action) }, principal, null);
            await handler.HandleAsync(context);
            return context.HasSucceeded;
        }
        void SetFlag(string flag)
        {
            switch (action)
            {
                case ScreenAction.New: detail.CanNew = flag; break;
                case ScreenAction.View: detail.CanView = flag; break;
                case ScreenAction.Update: detail.CanUpdate = flag; break;
                case ScreenAction.Delete: detail.CanDelete = flag; break;
                case ScreenAction.Approve: detail.CanApprove = flag; break;
                case ScreenAction.Export: detail.CanExport = flag; break;
            }
        }
        SetFlag("N"); await _db.SaveChangesAsync(); Assert.False(await Allowed());
        SetFlag("Y"); await _db.SaveChangesAsync(); Assert.True(await Allowed());
        SetFlag("N"); await _db.SaveChangesAsync(); Assert.False(await Allowed());
    }

    public void Dispose() { _db.Dispose(); _connection.Dispose(); }
    private sealed class ReadQueries : DbCommandInterceptor
    {
        public List<string> Commands { get; } = new();
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            Commands.Add(command.CommandText);
            return ValueTask.FromResult(result);
        }
    }
}
