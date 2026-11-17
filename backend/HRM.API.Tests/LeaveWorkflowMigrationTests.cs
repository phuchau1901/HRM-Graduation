using HRM.API.Data;
using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class LeaveWorkflowMigrationTests
{
    [Fact]
    public void ExtendsExistingTablesWithoutRecreatingOrRewritingBusinessRows()
    {
        var migration = new CompleteLeaveApprovalWorkflow();
        Assert.DoesNotContain(migration.UpOperations, op => op is CreateTableOperation or DropTableOperation or DropColumnOperation or SqlOperation or InsertDataOperation or UpdateDataOperation or DeleteDataOperation);
        Assert.Contains(migration.UpOperations.OfType<CreateIndexOperation>(), op => op.Table == "leave_balances" && op.IsUnique && op.Columns.SequenceEqual(new[] { "employee_id", "leave_type_id", "year_no" }));
        Assert.Contains(migration.UpOperations.OfType<CreateIndexOperation>(), op => op.Table == "approval_steps" && op.IsUnique);
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var sql = db.GetService<IMigrator>().GenerateScript("20261116104348_AddContractDocumentSequences", "20261117014440_CompleteLeaveApprovalWorkflow");
        Assert.DoesNotContain("CREATE TABLE", sql); Assert.Contains("ALTER TABLE `approval_requests`", sql);
        Assert.False(db.Database.HasPendingModelChanges());
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ForeignKeysHaveSupportingIndexesThroughoutUpgradeAndDowngrade(bool downgrade)
    {
        var migration = new CompleteLeaveApprovalWorkflow();
        var operations = (downgrade ? migration.DownOperations : migration.UpOperations).ToList();
        var replacements = new[]
        {
            (Table: "overtime_requests", Column: "employee_id", Old: "IX_overtime_requests_employee_id", New: "IX_overtime_requests_employee_id_status_start_at_end_at"),
            (Table: "leave_requests", Column: "employee_id", Old: "IX_leave_requests_employee_id", New: "IX_leave_requests_employee_id_status_from_date_to_date"),
            (Table: "leave_balances", Column: "employee_id", Old: "IX_leave_balances_employee_id", New: "IX_leave_balances_employee_id_leave_type_id_year_no"),
            (Table: "attendance_adjustments", Column: "attendance_id", Old: "IX_attendance_adjustments_attendance_id", New: "IX_attendance_adjustments_attendance_id_status"),
            (Table: "approval_steps", Column: "approval_request_id", Old: "IX_approval_steps_approval_request_id", New: "IX_approval_steps_approval_request_id_step_no")
        };
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var from = downgrade ? "20261117014440_CompleteLeaveApprovalWorkflow" : "20261116104348_AddContractDocumentSequences";
        var to = downgrade ? "20261116104348_AddContractDocumentSequences" : "20261117014440_CompleteLeaveApprovalWorkflow";
        var sql = db.GetService<IMigrator>().GenerateScript(from, to);
        foreach (var replacement in replacements)
        {
            var createName = downgrade ? replacement.Old : replacement.New;
            var dropName = downgrade ? replacement.New : replacement.Old;
            var create = Assert.Single(operations.OfType<CreateIndexOperation>(), o => o.Table == replacement.Table && o.Name == createName);
            var drop = Assert.Single(operations.OfType<DropIndexOperation>(), o => o.Table == replacement.Table && o.Name == dropName);
            Assert.Equal(replacement.Column, create.Columns[0]);
            Assert.True(operations.IndexOf(create) < operations.IndexOf(drop), $"Create {createName} before dropping {dropName}.");
            var createSql = sql.IndexOf($"INDEX `{createName}`", StringComparison.Ordinal);
            var dropSql = sql.IndexOf($"DROP INDEX `{dropName}`", StringComparison.Ordinal);
            Assert.True(createSql >= 0 && dropSql > createSql, $"MySQL SQL must create {createName} before dropping {dropName}.");
        }
    }

}
