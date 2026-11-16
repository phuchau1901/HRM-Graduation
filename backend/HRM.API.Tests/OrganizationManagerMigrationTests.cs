using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class OrganizationManagerMigrationTests
{
    [Fact]
    public void ManagersAreNullableIndexedRestrictReferencesWithoutDataChanges()
    {
        var migration = new AddOrganizationManagers();
        var columns = migration.UpOperations.OfType<AddColumnOperation>().ToArray();
        Assert.Equal(2, columns.Length);
        Assert.Contains(columns, c => c.Table == "departments" && c.Name == "ManagerEmployeeId" && c.IsNullable);
        Assert.Contains(columns, c => c.Table == "teams" && c.Name == "LeadEmployeeId" && c.IsNullable);
        Assert.Equal(2, migration.UpOperations.OfType<CreateIndexOperation>().Count());
        var keys = migration.UpOperations.OfType<AddForeignKeyOperation>().ToArray();
        Assert.Equal(2, keys.Length);
        Assert.All(keys, k => { Assert.Equal("employees", k.PrincipalTable); Assert.Equal(new[] { "Id" }, k.PrincipalColumns); Assert.Equal(ReferentialAction.Restrict, k.OnDelete); });
        Assert.DoesNotContain(migration.UpOperations, o => o is SqlOperation or InsertDataOperation or UpdateDataOperation or DeleteDataOperation or DropColumnOperation or DropTableOperation);
    }
}
