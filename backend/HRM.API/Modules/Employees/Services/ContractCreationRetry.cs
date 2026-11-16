using HRM.API.Common;
using HRM.API.Data;
using MySqlConnector;
namespace HRM.API.Modules.Employees.Services;
internal static class ContractCreationRetry
{
    internal static async Task<T> RunAsync<T>(AppDbContext db, Func<Task<T>> work, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is not null) throw new InvalidOperationException("Contract retry must own the transaction boundary.");
        for (var attempt = 1; ; attempt++)
        {
            try { return await work(); }
            catch (Exception error) when (IsRetryable(error))
            {
                if (attempt >= 3) throw BusinessException.Conflict("Contract creation conflicted with another request; retry the operation.");
                db.ChangeTracker.Clear();
                await Task.Delay(TimeSpan.FromMilliseconds(25 * attempt), ct);
            }
        }
    }
    internal static bool IsRetryable(Exception error) => error is MySqlException { Number: 1213 or 1205 }
        || error is MySqlException { Number: 1062 } mysql && mysql.Message.Contains("uq_contracts_contract_no", StringComparison.OrdinalIgnoreCase)
        || error.InnerException is not null && IsRetryable(error.InnerException);
}
