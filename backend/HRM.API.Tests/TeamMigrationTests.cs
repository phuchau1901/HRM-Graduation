using HRM.API.Data;
using HRM.API.Migrations;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;

public sealed class TeamMigrationTests
{
    [Fact]
    public void MigrationPreservesExistingDataAndAddsCompositeRestrictConstraint()
    {
        var migration = new AddTeamsAndEmployeeTeam();
        var column = Assert.Single(migration.UpOperations.OfType<AddColumnOperation>());
        Assert.Equal("employees", column.Table); Assert.Equal("TeamId", column.Name); Assert.True(column.IsNullable); Assert.Null(column.DefaultValue);
        var table = Assert.Single(migration.UpOperations.OfType<CreateTableOperation>());
        Assert.Equal("teams", table.Name);
        Assert.Equal(new[] { "Id", "DepartmentId" }, Assert.Single(table.UniqueConstraints).Columns);
        var fk = Assert.Single(migration.UpOperations.OfType<AddForeignKeyOperation>());
        Assert.Equal("employees", fk.Table); Assert.Equal("teams", fk.PrincipalTable);
        Assert.Equal(new[] { "TeamId", "DepartmentId" }, fk.Columns);
        Assert.Equal(new[] { "Id", "DepartmentId" }, fk.PrincipalColumns);
        Assert.Equal(ReferentialAction.Restrict, fk.OnDelete);
        Assert.DoesNotContain(migration.UpOperations, operation => operation is SqlOperation or InsertDataOperation or UpdateDataOperation or DeleteDataOperation or DropColumnOperation or DropTableOperation or AlterColumnOperation);
    }
    [Fact]
    public void MySqlMigrationSqlBuildsWithoutDatabaseAndModelMatchesSnapshot()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options;
        using var db = new AppDbContext(options);
        var script = db.GetService<IMigrator>().GenerateScript("20261114091114_AddEmployeePosition", "20261114092818_AddTeamsAndEmployeeTeam");
        Assert.Contains("CREATE TABLE `teams`", script);
        Assert.Contains("FOREIGN KEY (`TeamId`, `DepartmentId`) REFERENCES `teams` (`Id`, `DepartmentId`) ON DELETE RESTRICT", script);
        Assert.Contains("ADD `TeamId` int NULL", script);
        Assert.DoesNotContain("DROP TABLE", script);
        Assert.False(db.Database.HasPendingModelChanges());
        var relation = Assert.Single(db.Model.FindEntityType(typeof(Employee))!.GetForeignKeys(), x => x.PrincipalEntityType.ClrType == typeof(Team));
        Assert.Equal(DeleteBehavior.Restrict, relation.DeleteBehavior);
    }
}
