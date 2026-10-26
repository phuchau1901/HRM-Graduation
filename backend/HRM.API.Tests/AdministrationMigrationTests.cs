using HRM.API.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class AdministrationMigrationTests
{
    [Fact]
    public void MigrationOnlyAddsSessionVersionAndDownOnlyDropsIt()
    {
        var migration = new AddUserAuthVersion();
        var up = Assert.IsType<AddColumnOperation>(Assert.Single(migration.UpOperations));
        Assert.Equal("users", up.Table); Assert.Equal("auth_version", up.Name);
        Assert.Equal("bigint", up.ColumnType); Assert.Equal(typeof(long), up.ClrType);
        Assert.False(up.IsNullable); Assert.Equal(0L, up.DefaultValue);
        var down = Assert.IsType<DropColumnOperation>(Assert.Single(migration.DownOperations));
        Assert.Equal("users", down.Table); Assert.Equal("auth_version", down.Name);
    }
}
