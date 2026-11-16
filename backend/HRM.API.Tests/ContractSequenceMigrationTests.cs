using HRM.API.Data;
using HRM.API.Migrations;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Migrations.Operations;
using Xunit;
namespace HRM.API.Tests;
public sealed class ContractSequenceMigrationTests
{
    [Fact]
    public void AddsNullablePrefixAndUniqueTypeYearWithoutChangingExistingBusinessData()
    {
        var migration = new AddContractDocumentSequences();
        var prefix = Assert.Single(migration.UpOperations.OfType<AddColumnOperation>());
        Assert.Equal("prefix", prefix.Name); Assert.Equal("contract_types", prefix.Table); Assert.True(prefix.IsNullable); Assert.Null(prefix.DefaultValue);
        var sequence = Assert.Single(migration.UpOperations.OfType<CreateTableOperation>());
        Assert.Equal("document_sequences", sequence.Name);
        Assert.Equal(new[] { "document_type", "document_year" }, sequence.PrimaryKey!.Columns);
        Assert.Contains(sequence.Columns, c => c.Name == "last_number" && c.ClrType == typeof(long));
        Assert.DoesNotContain(migration.UpOperations, op => op is SqlOperation or InsertDataOperation or UpdateDataOperation or DeleteDataOperation or DropColumnOperation or DropTableOperation or AlterColumnOperation);
    }
    [Fact]
    public void MySqlMigrationSqlAndAtomicUpsertUseExistingUniqueContractNumberIndex()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseMySql("Server=localhost;Database=design;User=design;Password=design", new MySqlServerVersion(new Version(8, 0, 36))).Options);
        var sql = db.GetService<IMigrator>().GenerateScript("20261116061708_AddContractTypeCatalog", "20261116104348_AddContractDocumentSequences");
        Assert.Contains("PRIMARY KEY (`document_type`, `document_year`)", sql);
        Assert.Equal(1, sql.Split("CREATE TABLE `document_sequences`").Length - 1);
        Assert.DoesNotContain("INSERT INTO", sql[..sql.IndexOf("INSERT INTO `__EFMigrationsHistory`", StringComparison.Ordinal)]);
        Assert.False(db.Database.HasPendingModelChanges());
        Assert.Contains(db.Model.FindEntityType(typeof(Contract))!.GetIndexes(), i => i.IsUnique && i.GetDatabaseName() == "uq_contracts_contract_no");
        Assert.Contains("LAST_INSERT_ID(1)", ContractNumberGenerator.MySqlUpsert);
        Assert.Contains("ON DUPLICATE KEY UPDATE", ContractNumberGenerator.MySqlUpsert);
        Assert.Contains("LAST_INSERT_ID(`last_number` + 1)", ContractNumberGenerator.MySqlUpsert);
    }
}
