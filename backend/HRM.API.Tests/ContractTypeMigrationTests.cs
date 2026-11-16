using HRM.API.Data;
using HRM.API.Migrations;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;

public sealed class ContractTypeMigrationTests
{
    [Fact]
    public void MigrationBackfillsCatalogBeforeRestrictForeignKeyWithoutChangingContracts()
    {
        var operations = new AddContractTypeCatalog().UpOperations.ToList();
        Assert.Equal("contract_types", Assert.Single(operations.OfType<CreateTableOperation>()).Name);
        var backfill = Assert.Single(operations.OfType<SqlOperation>());
        Assert.Contains("SELECT DISTINCT", backfill.Sql);
        var fk = Assert.Single(operations.OfType<AddForeignKeyOperation>());
        Assert.Equal("contracts", fk.Table); Assert.Equal("contract_types", fk.PrincipalTable);
        Assert.Equal(new[] { "contract_type" }, fk.Columns); Assert.Equal(new[] { "code" }, fk.PrincipalColumns);
        Assert.Equal(ReferentialAction.Restrict, fk.OnDelete);
        Assert.True(operations.IndexOf(backfill) < operations.IndexOf(fk));
        Assert.DoesNotContain(operations, o => o is DropColumnOperation or DropTableOperation or AlterColumnOperation or UpdateDataOperation or DeleteDataOperation);
        Assert.DoesNotContain("UPDATE ", backfill.Sql, StringComparison.OrdinalIgnoreCase);
    }
    [Fact]
    public async Task BackfillPreservesDistinctLegacyCodesWithoutNormalizingOrRewritingContracts()
    {
        await using var connection = new SqliteConnection("Data Source=:memory:"); await connection.OpenAsync();
        using var setup = connection.CreateCommand();
        setup.CommandText = "CREATE TABLE contracts (contract_type TEXT NOT NULL); CREATE TABLE contract_types (code TEXT PRIMARY KEY, name TEXT NOT NULL, is_active INTEGER NOT NULL, sort_order INTEGER NOT NULL); INSERT INTO contracts VALUES ('FIXED_TERM'), ('FIXED_TERM'), (' Legacy Code ');";
        await setup.ExecuteNonQueryAsync();
        using var backfill = connection.CreateCommand();
        backfill.CommandText = Assert.Single(new AddContractTypeCatalog().UpOperations.OfType<SqlOperation>()).Sql;
        await backfill.ExecuteNonQueryAsync();
        using var read = connection.CreateCommand(); read.CommandText = "SELECT code, name, is_active FROM contract_types ORDER BY code";
        using var rows = await read.ExecuteReaderAsync();
        Assert.True(await rows.ReadAsync()); Assert.Equal(" Legacy Code ", rows.GetString(0)); Assert.Equal(rows.GetString(0), rows.GetString(1)); Assert.Equal(1, rows.GetInt32(2));
        Assert.True(await rows.ReadAsync()); Assert.Equal("FIXED_TERM", rows.GetString(0)); Assert.False(await rows.ReadAsync());
    }
    [Fact]
    public void MySqlScriptGeneratesOfflineAndSnapshotMatchesModel()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var sql = db.GetService<IMigrator>().GenerateScript("20261116031445_AddOrganizationManagers", "20261116061708_AddContractTypeCatalog");
        Assert.Contains("CREATE TABLE `contract_types`", sql);
        Assert.Contains("INSERT INTO `contract_types`", sql);
        Assert.Contains("REFERENCES `contract_types` (`code`) ON DELETE RESTRICT", sql);
        Assert.True(sql.IndexOf("INSERT INTO `contract_types`", StringComparison.Ordinal) < sql.IndexOf("ADD CONSTRAINT", StringComparison.Ordinal));
        Assert.False(db.Database.HasPendingModelChanges());
    }
}
