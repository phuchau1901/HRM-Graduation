using HRM.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;

namespace HRM.API.Tests;

public sealed class NotificationMigrationTests
{
    private static AppDbContext Context() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseMySql("Server=localhost;Database=unused;User=unused", new MySqlServerVersion(new Version(8, 0, 36))).Options);
    private static Migration NotificationMigration(AppDbContext db)
    {
        var assembly = db.GetService<IMigrationsAssembly>();
        var type = Assert.Single(assembly.Migrations, x => x.Key == "20261019145341_AddNotificationCenter");
        return assembly.CreateMigration(type.Value, db.Database.ProviderName!);
    }

    [Fact]
    public void UpMatchesEmptyRailwayDevBaselineAndOnlyChangesNotificationTables()
    {
        using var db = Context();
        var operations = NotificationMigration(db).UpOperations;
        var newTables = new[] { "notification_outbox", "notification_recipients", "notification_targets", "role_screen_actions" };
        Assert.Equal(newTables, operations.OfType<CreateTableOperation>().Select(x => x.Name).OrderBy(x => x));
        Assert.Empty(operations.OfType<DropForeignKeyOperation>());
        Assert.Empty(operations.OfType<DropTableOperation>());
        Assert.Empty(operations.OfType<AlterColumnOperation>());
        Assert.Empty(operations.OfType<SqlOperation>()); // The DEV table is empty: no backfill or other data writes.
        var dropIndex = Assert.Single(operations.OfType<DropIndexOperation>());
        Assert.Equal("notifications", dropIndex.Table); Assert.Equal("IX_notifications_user_id", dropIndex.Name);
        Assert.Equal(new[] { "is_read", "user_id" }, operations.OfType<DropColumnOperation>().Select(x => x.Name));
        Assert.All(operations.OfType<DropColumnOperation>(), x => Assert.Equal("notifications", x.Table));
        Assert.All(operations.OfType<AddColumnOperation>(), x => Assert.Equal("notifications", x.Table));
        Assert.All(operations.OfType<CreateIndexOperation>(), x => Assert.Contains(x.Table, newTables.Append("notifications")));
        Assert.All(operations.OfType<AddForeignKeyOperation>(), x => Assert.Equal("notifications", x.Table));
        var recipients = Assert.Single(operations.OfType<CreateTableOperation>(), x => x.Name == "notification_recipients");
        Assert.Equal(new[] { "notification_id", "user_id" }, recipients.PrimaryKey!.Columns);
        var user = Assert.Single(recipients.Columns, x => x.Name == "user_id");
        Assert.Equal("varchar(100)", user.ColumnType); Assert.Equal(100, user.MaxLength);
        var recipientFk = Assert.Single(recipients.ForeignKeys, x => x.PrincipalTable == "users");
        Assert.Equal(new[] { "user_id" }, recipientFk.PrincipalColumns);
        var creator = Assert.Single(operations.OfType<AddColumnOperation>(), x => x.Name == "created_by_user_id");
        Assert.Equal("varchar(100)", creator.ColumnType); Assert.True(creator.IsNullable);
        var uniqueKey = Assert.Single(operations.OfType<CreateIndexOperation>(), x => x.Name == "IX_notifications_deduplication_key");
        Assert.True(uniqueKey.IsUnique);
        var target = Assert.Single(operations.OfType<CreateTableOperation>(), x => x.Name == "notification_targets");
        Assert.Equal("json", Assert.Single(target.Columns, x => x.Name == "criteria_json").ColumnType);
        var grants = Assert.Single(operations.OfType<CreateTableOperation>(), x => x.Name == "role_screen_actions");
        Assert.Equal(new[] { "role_id", "screen_id", "action_code" }, grants.PrimaryKey!.Columns);
        Assert.Equal(new[] { "roles", "screens" }, grants.ForeignKeys.Select(x => x.PrincipalTable).OrderBy(x => x));
    }

    [Fact]
    public void SnapshotAndTargetModelMatchCurrentModelWithoutInventedScreenColumns()
    {
        using var db = Context();
        Assert.False(db.Database.HasPendingModelChanges());
        var migration = NotificationMigration(db);
        var target = db.GetService<IModelRuntimeInitializer>().Initialize(migration.TargetModel, designTime: true);
        var screen = target.FindEntityType("HRM.API.Modules.Authorization.Entities.Screen")!;
        Assert.Equal(new[] { "Code", "ID", "Icon", "IsActive", "Name", "Platform" }, screen.GetProperties().Select(x => x.Name).OrderBy(x => x, StringComparer.Ordinal));
        Assert.Empty(screen.GetForeignKeys());
    }

    [Fact]
    public void DownStopsBeforeAnyDestructiveOrInventedSchemaOperation()
    {
        using var db = Context();
        var exception = Assert.Throws<NotSupportedException>(() => NotificationMigration(db).DownOperations);
        Assert.Contains("reviewed data conversion", exception.Message);
    }
}
