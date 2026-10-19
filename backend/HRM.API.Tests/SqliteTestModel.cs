using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata;

namespace HRM.API.Tests;

internal static class SqliteTestModel
{
    // MySQL bigint/int AUTO_INCREMENT remains untouched in production.
    // SQLite's rowid identity requires the exact INTEGER spelling, even for CLR long.
    internal static void UseSqliteIdentityTypes(ModelBuilder builder)
    {
        foreach (var entity in builder.Model.GetEntityTypes())
        {
            var key = entity.FindPrimaryKey();
            if (key?.Properties.Count == 1 && key.Properties[0] is { ValueGenerated: ValueGenerated.OnAdd } property
                && (property.ClrType == typeof(long) || property.ClrType == typeof(int)))
                property.SetColumnType("INTEGER");
        }
    }
}
