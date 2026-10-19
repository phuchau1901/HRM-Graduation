using System.Security.Cryptography;
using HRM.API.Data;
using HRM.API.Data.Seeders;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Xunit;

namespace HRM.API.Tests;

public sealed class AuthSeederTests
{
    private static readonly string[] Names = ["admin", "hr01", "manager01", "employee01", "employee02"];
    private static IConfiguration Secrets() => new ConfigurationBuilder().AddInMemoryCollection(Names.ToDictionary(
        x => $"AuthSeed:Passwords:{x}", _ => (string?)Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)))).Build();
    private static IConfiguration Settings(bool enabled) => new ConfigurationBuilder().AddInMemoryCollection(
        new Dictionary<string, string?> { ["AuthSeed:Enabled"] = enabled.ToString() }).Build();

    [Fact]
    public async Task SeedCreatesDemoAccountsAndNeverRestoresEditedPasswordsRolesOrPermissions()
    {
        using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AuthorizationTestContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var passwords = new PasswordService(); var secrets = Secrets();
        var seeder = new AuthSeeder(db, passwords, new TestEnvironment("Development"), Settings(true));
        await seeder.SeedAsync(secrets);
        Assert.Equal(4, await db.Set<Role>().CountAsync()); Assert.Equal(5, await db.Set<User>().CountAsync());
        Assert.Equal(5, await db.Set<UserRole>().CountAsync());
        foreach (var u in await db.Set<User>().AsNoTracking().ToListAsync())
            Assert.Equal(PasswordCheck.Success, passwords.Verify(secrets[$"AuthSeed:Passwords:{u.UserId}"], u.PasswordHash, u.Salt));
        var admin = await db.Set<User>().SingleAsync(x => x.UserId == "admin");
        var edited = passwords.Hash(Convert.ToBase64String(RandomNumberGenerator.GetBytes(24)));
        admin.PasswordHash = edited.PasswordHash; admin.Salt = edited.Salt;
        var role = await db.Set<Role>().SingleAsync(x => x.Code == "ADMIN"); role.Name = "Edited role name";
        var screen = new Screen { Code = "TEST", Name = "Test" }; db.Add(screen); await db.SaveChangesAsync();
        db.Add(new RoleDetail { RoleID = role.ID, ScreenID = screen.ID, CanView = "N", CanDelete = "Y" });
        db.RemoveRange(await db.Set<UserRole>().Where(x => x.UserID == admin.UserId).ToListAsync()); await db.SaveChangesAsync();
        await seeder.SeedAsync(new ConfigurationBuilder().Build()); // Existing accounts no longer need seed passwords.
        Assert.Equal(5, await db.Set<User>().CountAsync()); Assert.Equal(4, await db.Set<Role>().CountAsync());
        Assert.False(await db.Set<UserRole>().AnyAsync(x => x.UserID == admin.UserId));
        Assert.Equal(edited.PasswordHash, (await db.Set<User>().AsNoTracking().SingleAsync(x => x.UserId == admin.UserId)).PasswordHash);
        Assert.Equal("Edited role name", (await db.Set<Role>().AsNoTracking().SingleAsync(x => x.ID == role.ID)).Name);
        Assert.Equal("Y", (await db.Set<RoleDetail>().SingleAsync()).CanDelete);
    }

    [Theory]
    [InlineData("Production", true)] [InlineData("Staging", true)] [InlineData("Development", false)]
    public async Task SeedDoesNothingOutsideExplicitDevelopmentOptIn(string env, bool enabled)
    {
        using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AuthorizationTestContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        await new AuthSeeder(db, new PasswordService(), new TestEnvironment(env), Settings(enabled)).SeedAsync(Secrets());
        Assert.Equal(0, await db.Set<User>().CountAsync()); Assert.Equal(0, await db.Set<Role>().CountAsync());
    }

    [Fact]
    public async Task MissingSecretsFailBeforeAnyRoleOrAccountIsWritten()
    {
        using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        await using var db = new AuthorizationTestContext(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(connection).Options);
        await db.Database.EnsureCreatedAsync();
        var seeder = new AuthSeeder(db, new PasswordService(), new TestEnvironment("Development"), Settings(true));
        await Assert.ThrowsAsync<InvalidOperationException>(() => seeder.SeedAsync(new ConfigurationBuilder().Build()));
        Assert.Equal(0, await db.Set<Role>().CountAsync()); Assert.Equal(0, await db.Set<User>().CountAsync());
    }

    private sealed class TestEnvironment(string environment) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environment;
        public string ApplicationName { get; set; } = "HRM.API.Tests";
        public string ContentRootPath { get; set; } = "";
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
