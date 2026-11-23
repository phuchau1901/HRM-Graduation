using HRM.API.Data;
using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class PayrollMigrationTests {
 [Fact] public void ReusesFiveExistingTablesAndAddsOnlyMissingCatalogs() {
  var ops=new CompletePayrollCompensation().UpOperations;
  Assert.Equal(new[]{"payroll_adjustments","payroll_policies","salary_components"},ops.OfType<CreateTableOperation>().Select(x=>x.Name).Order().ToArray());
  Assert.DoesNotContain(ops,o=>o is DropTableOperation or DropColumnOperation or DeleteDataOperation or UpdateDataOperation);
  Assert.All(ops.OfType<AddColumnOperation>().Where(x=>x.Name=="version"),x=>Assert.Equal(1L,x.DefaultValue));
  Assert.Contains(ops.OfType<CreateIndexOperation>(),x=>x.Table=="payroll_details"&&x.Name=="IX_payroll_details_employee_period_key"&&x.IsUnique);
  Assert.Equal(3,ops.OfType<SqlOperation>().Count());Assert.DoesNotContain(ops.OfType<SqlOperation>(),x=>x.Sql.Contains("role_details",StringComparison.OrdinalIgnoreCase));
 }
 [Fact] public void MySqlSqlIsGeneratedOfflineAndModelMatchesSnapshot() {
  using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=unused",new MySqlServerVersion(new Version(8,0,36))).Options);
  var sql=db.GetService<IMigrator>().GenerateScript("20261123111950_AddKpiUnitCatalog","20261123171325_CompletePayrollCompensation");
  Assert.Contains("CREATE TABLE `salary_components`",sql);Assert.Contains("CREATE UNIQUE INDEX `IX_payroll_details_employee_period_key`",sql);Assert.DoesNotContain("DROP TABLE",sql);
  Assert.False(db.Database.HasPendingModelChanges());
 }
}
