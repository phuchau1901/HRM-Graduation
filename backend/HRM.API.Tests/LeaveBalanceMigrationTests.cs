using HRM.API.Data;
using HRM.API.Migrations;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class LeaveBalanceMigrationTests
{
    [Fact]
    public void ExtendsExistingBalancesWithoutRecreatingTablesOrChangingExistingQuotaValues()
    {
        var migration = new ExtendLeaveBalanceManagement();
        var columns = migration.UpOperations.OfType<AddColumnOperation>().ToArray(); Assert.Equal(2, columns.Length);
        Assert.All(columns, c => { Assert.Equal("leave_balances", c.Table); Assert.Equal(0m, c.DefaultValue); Assert.Equal("decimal(7,2)", c.ColumnType); });
        Assert.Equal(new[] { "adjustment_days", "carried_over_days" }, columns.Select(c => c.Name).OrderBy(n => n).ToArray());
        Assert.DoesNotContain(migration.UpOperations, o => o is CreateTableOperation or DropTableOperation or DropColumnOperation or DropIndexOperation or SqlOperation or InsertDataOperation or UpdateDataOperation or DeleteDataOperation);
        var index = Assert.Single(migration.UpOperations.OfType<CreateIndexOperation>()); Assert.Equal("audit_logs", index.Table);
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var sql = db.GetService<IMigrator>().GenerateScript("20261117043059_SnapshotApprovalEmployee", "20261117062126_ExtendLeaveBalanceManagement");
        Assert.Contains("ALTER TABLE `leave_balances` ADD `adjustment_days` decimal(7,2) NOT NULL DEFAULT 0.0", sql);
        Assert.DoesNotContain("CREATE TABLE", sql); Assert.False(db.Database.HasPendingModelChanges());
        var balance = db.Model.FindEntityType(typeof(LeaveBalance))!;
        Assert.Contains(balance.GetIndexes(), i => i.IsUnique && i.Properties.Select(p => p.Name).SequenceEqual(new[] { "EmployeeID", "LeaveTypeID", "YearNo" }));
        Assert.True(balance.FindProperty(nameof(LeaveBalance.Version))!.IsConcurrencyToken);
    }
}
