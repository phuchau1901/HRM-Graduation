using HRM.API.Data;
using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class ApprovalEmployeeMigrationTests
{
    [Fact]
    public void AddsNullableEmployeeSnapshotWithoutBackfillingOrRecreatingTables()
    {
        var migration = new SnapshotApprovalEmployee();
        var column = Assert.Single(migration.UpOperations.OfType<AddColumnOperation>());
        Assert.Equal("approval_steps", column.Table); Assert.Equal("approver_employee_id", column.Name); Assert.True(column.IsNullable); Assert.Null(column.DefaultValue);
        Assert.DoesNotContain(migration.UpOperations, o => o is CreateTableOperation or DropTableOperation or SqlOperation or InsertDataOperation or UpdateDataOperation or DeleteDataOperation);
        var fk = Assert.Single(migration.UpOperations.OfType<AddForeignKeyOperation>());
        Assert.Equal("employees", fk.PrincipalTable); Assert.Equal(ReferentialAction.Restrict, fk.OnDelete);
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var sql = db.GetService<IMigrator>().GenerateScript("20261117014440_CompleteLeaveApprovalWorkflow", "20261117043059_SnapshotApprovalEmployee");
        Assert.Contains("ADD `approver_employee_id` int NULL", sql); Assert.DoesNotContain("CREATE TABLE", sql);
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
