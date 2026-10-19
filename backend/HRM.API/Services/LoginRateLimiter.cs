using System.Threading.RateLimiting;

namespace HRM.API.Modules.Auth.Services;

/// <summary>Process-local limits: 5 attempts/minute per client, 30/minute across the instance.</summary>
public sealed class LoginRateLimiter : IDisposable
{
    private readonly FixedWindowRateLimiter _global = new(new FixedWindowRateLimiterOptions
    {
        PermitLimit = 30, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
    });
    private readonly PartitionedRateLimiter<string> _clients = PartitionedRateLimiter.Create<string, string>(key =>
        RateLimitPartition.GetFixedWindowLimiter(key, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0
        }));

    public bool TryAcquire(string client)
    {
        using var local = _clients.AttemptAcquire(client);
        if (!local.IsAcquired) return false;
        using var global = _global.AttemptAcquire();
        return global.IsAcquired;
    }

    public void Dispose() { _clients.Dispose(); _global.Dispose(); }
}
