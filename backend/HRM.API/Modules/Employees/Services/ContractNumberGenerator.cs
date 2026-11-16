using System.Data;
using System.Globalization;
using System.Text.RegularExpressions;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
namespace HRM.API.Modules.Employees.Services;

public sealed class ContractNumberGenerator(AppDbContext db, TimeProvider clock)
{
    internal const string MySqlUpsert = "INSERT INTO `document_sequences` (`document_type`, `document_year`, `last_number`) VALUES (@type, @year, LAST_INSERT_ID(1)) ON DUPLICATE KEY UPDATE `last_number` = LAST_INSERT_ID(`last_number` + 1);";
    internal const string SqliteUpsert = "INSERT INTO document_sequences (document_type, document_year, last_number) VALUES (@type, @year, 1) ON CONFLICT(document_type, document_year) DO UPDATE SET last_number = last_number + 1 RETURNING last_number;";
    public static bool IsValidPrefix(string? prefix) => prefix is not null && Regex.IsMatch(prefix, @"\A[A-Z][A-Z0-9]{0,19}\z", RegexOptions.CultureInvariant);
    internal static string Format(string prefix, int year, long number) => $"{prefix}-{year.ToString("D4", CultureInfo.InvariantCulture)}-{number.ToString("D6", CultureInfo.InvariantCulture)}";
    public async Task<string> NextAsync(ContractType type, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is null) throw new InvalidOperationException("Contract numbering requires the contract transaction.");
        if (!type.IsActive || !IsValidPrefix(type.Prefix)) throw BusinessException.Invalid("Contract type must be active and have a valid prefix (1-20 uppercase letters/digits, starting with a letter).");
        var year = VietnamBusinessDate.Today(clock).Year;
        var mysql = db.Database.ProviderName == "Pomelo.EntityFrameworkCore.MySql";
        if (!mysql && db.Database.ProviderName != "Microsoft.EntityFrameworkCore.Sqlite") throw new NotSupportedException("Unsupported document sequence provider.");
        // The connection and transaction belong to this request's DbContext; never open a second connection.
        await using var command = db.Database.GetDbConnection().CreateCommand();
        command.Transaction = db.Database.CurrentTransaction.GetDbTransaction();
        command.CommandTimeout = db.Database.GetCommandTimeout() ?? 30;
        var typeParameter = command.CreateParameter(); typeParameter.ParameterName = "@type"; typeParameter.DbType = DbType.String; typeParameter.Value = type.Code; command.Parameters.Add(typeParameter);
        var yearParameter = command.CreateParameter(); yearParameter.ParameterName = "@year"; yearParameter.DbType = DbType.Int32; yearParameter.Value = year; command.Parameters.Add(yearParameter);
        // Skip numbers occupied by legacy documents or earlier prefixes. Never renumber those contracts.
        for (var candidate = 0; candidate < 100; candidate++)
        {
            command.CommandText = mysql ? MySqlUpsert : SqliteUpsert;
            object? scalar;
            if (mysql)
            {
                await command.ExecuteNonQueryAsync(ct);
                command.CommandText = "SELECT LAST_INSERT_ID();";
                scalar = await command.ExecuteScalarAsync(ct);
            }
            else scalar = await command.ExecuteScalarAsync(ct);
            var number = Convert.ToInt64(scalar, CultureInfo.InvariantCulture);
            if (number <= 0) throw BusinessException.Conflict("Document sequence is invalid or exhausted.");
            var code = Format(type.Prefix!, year, number);
            if (!await db.Set<Contract>().AsNoTracking().AnyAsync(c => c.ContractNo == code, ct)) return code;
        }
        throw BusinessException.Conflict("Cannot allocate a unique contract number within the retry limit; review the configured prefix.");
    }
}
