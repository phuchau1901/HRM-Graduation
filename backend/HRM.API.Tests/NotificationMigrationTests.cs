using HRM.API.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class NotificationMigrationTests
{
    [Fact]
    public void MigrationPreservesLegacyDataBeforeDroppingColumnsAndDoesNotAlterScreenOrEmployeeSchema()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=localhost;Database=unused;User=unused", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var assembly = db.GetService<IMigrationsAssembly>();
        var type = Assert.Single(assembly.Migrations, x => x.Key.EndsWith("_AddNotificationCenter"));
        var migration = assembly.CreateMigration(type.Value, db.Database.ProviderName!);
        var operations = migration.UpOperations.ToList();
        Assert.Equal(new[] { "notification_outbox", "notification_recipients", "notification_targets", "role_screen_actions" },
            operations.OfType<CreateTableOperation>().Select(x => x.Name).OrderBy(x => x));
        Assert.DoesNotContain(operations, x => x is DropTableOperation);
        var backfill = Assert.Single(operations.OfType<SqlOperation>());
        Assert.Contains("CASE WHEN `is_read` = 1", backfill.Sql);
        Assert.Contains("JSON_ARRAY(`user_id`)", backfill.Sql);
        var drops = operations.OfType<DropColumnOperation>().ToList();
        Assert.Equal(new[] { "is_read", "user_id" }, drops.Select(x => x.Name));
        Assert.All(drops, x => { Assert.Equal("notifications", x.Table); Assert.True(operations.IndexOf(backfill) < operations.IndexOf(x)); });
        Assert.DoesNotContain(operations.OfType<DropForeignKeyOperation>(), x => x.Table == "screens");
        var recipients = Assert.Single(operations.OfType<CreateTableOperation>(), x => x.Name == "notification_recipients");
        Assert.Equal(new[] { "notification_id", "user_id" }, recipients.PrimaryKey!.Columns);
        var user = Assert.Single(recipients.Columns, x => x.Name == "user_id");
        Assert.Equal("varchar(100)", user.ColumnType); Assert.Equal(100, user.MaxLength);
        // Preserve the pre-existing Screen drift rather than silently changing unrelated database columns.
        var snapshot = db.GetService<IModelRuntimeInitializer>().Initialize(assembly.ModelSnapshot!.Model, designTime: true);
        var current = db.GetService<IDesignTimeModel>().Model;
        var pending = db.GetService<IMigrationsModelDiffer>().GetDifferences(snapshot.GetRelationalModel(), current.GetRelationalModel());
        Assert.Equal(new[] { "parent_id", "route", "sort_order", "supported_actions" },
            pending.OfType<DropColumnOperation>().Select(x => x.Name).OrderBy(x => x));
        Assert.All(pending.OfType<DropColumnOperation>(), x => Assert.Equal("screens", x.Table));
        Assert.DoesNotContain(pending, x => x is AddColumnOperation or CreateTableOperation or AlterColumnOperation);
    }
}
