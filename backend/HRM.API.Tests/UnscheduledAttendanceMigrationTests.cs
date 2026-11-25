using HRM.API.Data;
using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class UnscheduledAttendanceMigrationTests {
 [Fact] public void AddsRawEvidenceWithoutFakeShiftsOrRebuildingAttendance() {
  var ops=new AddUnscheduledAttendanceEvidence().UpOperations;
  Assert.Equal("unscheduled_attendances",Assert.Single(ops.OfType<CreateTableOperation>()).Name);
  Assert.Contains(ops.OfType<CreateIndexOperation>(),x=>x.Table=="unscheduled_attendances"&&x.IsUnique&&x.Columns.SequenceEqual(new[]{"open_employee_key"}));
  Assert.DoesNotContain(ops,o=>o is DropTableOperation or DropColumnOperation or DropIndexOperation or AlterColumnOperation or SqlOperation or UpdateDataOperation);
  Assert.Contains(ops.OfType<AddColumnOperation>(),x=>x.Table=="attendance_requests"&&x.Name=="unscheduled_attendance_id"&&x.IsNullable);
 }
 [Fact] public void MySqlSqlGeneratesOfflineAndSnapshotMatches() {
  using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design;Password=unused",new MySqlServerVersion(new Version(8,0,36))).Options);
  var sql=db.GetService<IMigrator>().GenerateScript("20261123171325_CompletePayrollCompensation","20261125031533_AddUnscheduledAttendanceEvidence");
  Assert.Contains("CREATE TABLE `unscheduled_attendances`",sql);Assert.Contains("ADD `unscheduled_attendance_id`",sql);Assert.DoesNotContain("DROP INDEX",sql);Assert.False(db.Database.HasPendingModelChanges());
 }
}
