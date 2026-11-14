using HRM.API.Data;
using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class SystemSettingsMigrationTests
{
    [Fact]
    public void MigrationReusesAttendanceTablesAndNeverBackfillsOrDeletesBusinessData()
    {
        var migration = new AddSystemSettingsAndAttendanceRules();
        Assert.Equal(new[] { "password_histories", "system_settings" }, migration.UpOperations.OfType<CreateTableOperation>().Select(x => x.Name).OrderBy(x => x));
        Assert.DoesNotContain(migration.UpOperations, x => x is DropTableOperation or DropColumnOperation or DeleteDataOperation or UpdateDataOperation or SqlOperation);
        Assert.All(migration.UpOperations.OfType<InsertDataOperation>(), x => Assert.Equal("system_settings", x.Table));
        Assert.Contains(migration.UpOperations.OfType<AddColumnOperation>(), x => x.Table == "work_schedules" && x.Name == "rules_snapshot_json" && x.IsNullable);
        var operations = migration.UpOperations.ToList();
        var newIndex = operations.FindIndex(x => x is CreateIndexOperation index && index.Name == "IX_work_schedules_employee_id_work_date");
        var oldIndex = operations.FindIndex(x => x is DropIndexOperation index && index.Name == "IX_work_schedules_employee_id");
        Assert.True(newIndex >= 0 && newIndex < oldIndex); // Keep a supporting FK index during MySQL DDL.
        var options = new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options;
        using var db = new AppDbContext(options); Assert.False(db.Database.HasPendingModelChanges());
        var sql = db.GetService<IMigrator>().GenerateScript("20261114092818_AddTeamsAndEmployeeTeam", "20261114112511_AddSystemSettingsAndAttendanceRules");
        Assert.Contains("CREATE TABLE `system_settings`", sql); Assert.Contains("ALTER TABLE `work_schedules` ADD `rules_snapshot_json`", sql);
        Assert.DoesNotContain("CREATE TABLE `attendances`", sql); Assert.DoesNotContain("CREATE TABLE `shifts`", sql);
    }
}
