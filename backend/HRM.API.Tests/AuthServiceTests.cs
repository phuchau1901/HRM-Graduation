using System.Net;
using System.Data.Common;
using System.Security.Cryptography;
using HRM.API.Data;
using HRM.API.Modules.Auth.Entities;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Microsoft.EntityFrameworkCore.Metadata;
using HRM.API.Modules.Employees.Entities;
using Xunit;

namespace HRM.API.Tests;

public sealed class AuthServiceTests : IDisposable
{
    private readonly SqliteConnection _connection = new("Data Source=:memory:");
    private readonly TestContext _db;
    private readonly PasswordService _passwords = new();
    private readonly LoginRateLimiter _limiter = new();
    private readonly AuthService _auth;
    private readonly ConcurrentResetInterceptor _concurrentReset = new();
    private static string NewPassword() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

    public AuthServiceTests()
    {
        _connection.Open();
        _db = new(new DbContextOptionsBuilder<AppDbContext>().UseSqlite(_connection).AddInterceptors(_concurrentReset).Options);
        _db.Database.EnsureCreated();
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Loopback;
        _auth = new(_db, _passwords, _limiter, new HttpContextAccessor { HttpContext = context });
    }

    [Fact]
    public async Task CreateChangeAndResetUseSameCredentialFormat()
    {
        var first = NewPassword(); var second = NewPassword(); var third = NewPassword();
        var id = await _auth.CreateAccountAsync("test-user", "test@example.invalid", first);
        _db.ChangeTracker.Clear();
        var user = await _db.Set<User>().SingleAsync();
        Assert.Equal(PasswordCheck.Success, _passwords.Verify(first, user.PasswordHash, user.Salt));
        Assert.False(await _auth.ChangePasswordAsync(id, NewPassword(), second));
        Assert.True(await _auth.ChangePasswordAsync(id, first, second));
        Assert.False(await _auth.ChangePasswordAsync(id, first, third));
        _db.ChangeTracker.Clear(); user = await _db.Set<User>().SingleAsync();
        Assert.Equal(PasswordCheck.Success, _passwords.Verify(second, user.PasswordHash, user.Salt));
        Assert.True(await _auth.ResetPasswordAsync(id, third));
        _db.ChangeTracker.Clear(); user = await _db.Set<User>().SingleAsync();
        Assert.Equal(PasswordCheck.Success, _passwords.Verify(third, user.PasswordHash, user.Salt));
        Assert.Equal(PasswordCheck.Failed, _passwords.Verify(second, user.PasswordHash, user.Salt));
        Assert.False(await _auth.ResetPasswordAsync("missing-user", NewPassword()));
    }

    [Fact]
    public async Task LegacyLoginUpgradesHashAndSaltOnlyAfterSuccessfulAuthentication()
    {
        var password = NewPassword();
        var oldHash = new PasswordHasher<User>().HashPassword(new User(), password);
        var user = new User { UserId = "legacy", Email = "legacy@example.invalid", PasswordHash = oldHash, Status = "ACTIVE" };
        _db.Add(user); await _db.SaveChangesAsync(); _db.ChangeTracker.Clear();
        Assert.Equal(LoginStatus.InvalidCredentials, (await _auth.LoginAsync("legacy", NewPassword())).Status);
        Assert.Equal(oldHash, (await _db.Set<User>().AsNoTracking().SingleAsync()).PasswordHash);
        var result = await _auth.LoginAsync("legacy", password);
        Assert.Equal(LoginStatus.Success, result.Status); Assert.Equal(user.UserId, result.UserId);
        _db.ChangeTracker.Clear(); user = await _db.Set<User>().SingleAsync();
        Assert.StartsWith("PBKDF2-SHA256!600000!", user.PasswordHash);
        Assert.Equal(32, Convert.FromBase64String(user.Salt!).Length);
        Assert.Equal(PasswordCheck.Success, _passwords.Verify(password, user.PasswordHash, user.Salt));
    }

    [Fact]
    public async Task LoginReadsCurrentCredentialsEvenWhenAccountIsAlreadyTracked()
    {
        var first = NewPassword(); var second = NewPassword();
        var id = await _auth.CreateAccountAsync("tracked", "tracked@example.invalid", first);
        Assert.True(await _auth.ChangePasswordAsync(id, first, second));
        Assert.Equal(LoginStatus.InvalidCredentials, (await _auth.LoginAsync("tracked", first)).Status);
        Assert.Equal(LoginStatus.Success, (await _auth.LoginAsync("tracked", second)).Status);
    }

    [Fact]
    public async Task LegacyUpgradeCannotOverwriteConcurrentPasswordReset()
    {
        var oldPassword = NewPassword(); var newPassword = NewPassword();
        var oldHash = new PasswordHasher<User>().HashPassword(new User(), oldPassword);
        _db.Add(new User { UserId = "race", Email = "race@example.invalid", PasswordHash = oldHash, Status = "ACTIVE" });
        await _db.SaveChangesAsync();
        var reset = _passwords.Hash(newPassword);
        _concurrentReset.BeforeNextUpdate = async () =>
        {
            using var command = _connection.CreateCommand();
            command.CommandText = "UPDATE users SET password_hash = $hash, salt = $salt";
            command.Parameters.AddWithValue("$hash", reset.PasswordHash);
            command.Parameters.AddWithValue("$salt", reset.Salt);
            await command.ExecuteNonQueryAsync();
        };
        Assert.Equal(LoginStatus.InvalidCredentials, (await _auth.LoginAsync("race", oldPassword)).Status);
        var user = await _db.Set<User>().AsNoTracking().SingleAsync();
        Assert.Equal(reset.PasswordHash, user.PasswordHash); Assert.Equal(reset.Salt, user.Salt);
        Assert.Equal(PasswordCheck.Success, _passwords.Verify(newPassword, user.PasswordHash, user.Salt));
    }

    [Fact]
    public async Task UnknownDisabledMalformedAndWrongPasswordAllReturnSameFailure()
    {
        var password = NewPassword(); var id = await _auth.CreateAccountAsync("disabled", "disabled@example.invalid", password);
        await _db.Set<User>().Where(x => x.UserId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "DISABLED"));
        _db.ChangeTracker.Clear();
        Assert.Equal(new LoginResult(LoginStatus.InvalidCredentials), await _auth.LoginAsync("missing", password));
        Assert.Equal(new LoginResult(LoginStatus.InvalidCredentials), await _auth.LoginAsync("disabled", password));
        await _db.Set<User>().Where(x => x.UserId == id).ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "ACTIVE").SetProperty(x => x.PasswordHash, "invalid"));
        _db.ChangeTracker.Clear();
        Assert.Equal(new LoginResult(LoginStatus.InvalidCredentials), await _auth.LoginAsync("disabled", password));
        Assert.Equal("invalid", (await _db.Set<User>().AsNoTracking().SingleAsync()).PasswordHash);
    }

    [Fact]
    public async Task LoginLimitsAttemptsBeforeDatabaseOrPasswordWork()
    {
        for (var i = 0; i < 5; i++) Assert.Equal(LoginStatus.InvalidCredentials, (await _auth.LoginAsync(null, null)).Status);
        Assert.Equal(LoginStatus.RateLimited, (await _auth.LoginAsync(null, null)).Status);
    }

    [Fact]
    public void CredentialFieldsAreNeverSerialized()
    {
        var c = _passwords.Hash(NewPassword());
        var json = global::System.Text.Json.JsonSerializer.Serialize(new User { PasswordHash = c.PasswordHash, Salt = c.Salt });
        Assert.DoesNotContain(c.PasswordHash, json); Assert.DoesNotContain(c.Salt, json);
    }

    [Fact]
    public void InitialMigrationCreatesCompleteSchemaAndAllUserForeignKeysUseUserId()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql(
            "Server=localhost;Database=unused;User=unused", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var assembly = db.GetService<IMigrationsAssembly>();
        var migrationType = Assert.Single(assembly.Migrations);
        Assert.EndsWith("_InitialHRMDatabase", migrationType.Key);
        var migration = assembly.CreateMigration(migrationType.Value, db.Database.ProviderName!);
        var tables = migration.UpOperations.OfType<CreateTableOperation>().ToArray();
        Assert.Equal(35, tables.Length);
        Assert.Contains(tables, t => t.Name == "screens"); Assert.Contains(tables, t => t.Name == "role_details");
        var users = Assert.Single(tables, t => t.Name == "users");
        Assert.Equal(new[] { "user_id" }, users.PrimaryKey!.Columns);
        Assert.DoesNotContain(users.Columns, c => c.Name == "id" || c.Name == "username");
        var accountKey = Assert.Single(users.Columns, c => c.Name == "user_id");
        Assert.Equal("varchar(100)", accountKey.ColumnType);
        Assert.Equal(100, accountKey.MaxLength);
        Assert.Null(accountKey.FindAnnotation("MySql:ValueGenerationStrategy"));
        var salt = Assert.Single(users.Columns, c => c.Name == "salt");
        Assert.Equal("varchar(44)", salt.ColumnType);
        var userFks = tables.SelectMany(t => t.ForeignKeys).Where(f => f.PrincipalTable == "users").ToArray();
        Assert.Equal(11, userFks.Length);
        Assert.All(userFks, f =>
        {
            Assert.Equal(new[] { "user_id" }, f.PrincipalColumns);
            var table = Assert.Single(tables, t => t.Name == f.Table);
            var column = Assert.Single(table.Columns, c => c.Name == Assert.Single(f.Columns));
            Assert.Equal("varchar(100)", column.ColumnType);
            Assert.Equal(100, column.MaxLength);
        });
        var model = db.GetService<IDesignTimeModel>().Model;
        var user = model.FindEntityType(typeof(User))!;
        var primaryKey = Assert.Single(user.FindPrimaryKey()!.Properties);
        Assert.Equal(nameof(User.UserId), primaryKey.Name);
        Assert.Equal(typeof(string), primaryKey.ClrType);
        Assert.Equal(ValueGenerated.Never, primaryKey.ValueGenerated);
        Assert.Null(typeof(User).GetProperty("Username"));
        Assert.Equal("Id", Assert.Single(model.FindEntityType(typeof(Employee))!.FindPrimaryKey()!.Properties).Name);
        Assert.DoesNotContain(model.GetEntityTypes().SelectMany(e => e.GetProperties()),
            p => p.GetColumnType() == "decimal(65,30)" || p.GetColumnType() == "longtext");
        Assert.False(db.Database.HasPendingModelChanges());
        var script = db.GetService<IMigrator>().GenerateScript();
        Assert.Contains("CREATE TABLE `screens`", script); Assert.Contains("CREATE TABLE `role_details`", script);
        Assert.Contains("REFERENCES `users` (`user_id`)", script);
        Assert.DoesNotContain("DROP TABLE", script);
    }

    public void Dispose() { _limiter.Dispose(); _db.Dispose(); _connection.Dispose(); }

    private sealed class TestContext(DbContextOptions<AppDbContext> options) : AppDbContext(options)
    {
        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);
            foreach (var entity in builder.Model.GetEntityTypes().Where(e => e.ClrType != typeof(User) && e.ClrType != typeof(RefreshToken)).ToArray())
                builder.Ignore(entity.ClrType);
            SqliteTestModel.UseSqliteIdentityTypes(builder);
        }
    }

    private sealed class ConcurrentResetInterceptor : DbCommandInterceptor
    {
        public Func<Task>? BeforeNextUpdate { get; set; }
        public override async ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(DbCommand command,
            CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.StartsWith("UPDATE") && BeforeNextUpdate is { } action)
            {
                BeforeNextUpdate = null;
                await action();
            }
            return result;
        }
    }
}
