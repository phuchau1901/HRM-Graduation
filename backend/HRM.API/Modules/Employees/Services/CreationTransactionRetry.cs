using HRM.API.Data;
using MySqlConnector;
namespace HRM.API.Modules.Employees.Services;

internal static class CreationTransactionRetry
{
    internal static async Task<T> RunAsync<T>(AppDbContext db, Func<Task<T>> create, CancellationToken ct)
    {
        if (db.Database.CurrentTransaction is not null) throw new InvalidOperationException("Creation retry must own the transaction boundary.");
        for (var attempt = 1; ; attempt++)
        {
            try { return await create(); }
            catch (Exception error) when (attempt < 3 && IsRetryable(error))
            {
                // The failed transaction has already been disposed/rolled back by the caller.
                // Never retry duplicate keys or connection/commit errors with uncertain outcomes.
                db.ChangeTracker.Clear();
                await Task.Delay(TimeSpan.FromMilliseconds(25 * attempt), ct);
            }
        }
    }
    private static bool IsRetryable(Exception error) => error is MySqlException { Number: 1213 or 1205 }
        || error.InnerException is not null && IsRetryable(error.InnerException);
}
