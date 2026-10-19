using Microsoft.Extensions.Options;
namespace HRM.API.Modules.Notifications.Services;
public sealed class NotificationWorker(IServiceScopeFactory scopes, IOptions<NotificationOptions> options,
    ILogger<NotificationWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.WorkerEnabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var dispatcher = scope.ServiceProvider.GetRequiredService<NotificationDispatcher>();
                await dispatcher.DistributeNextAsync(stoppingToken);
                await dispatcher.DeliverBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception)
            {
                // Do not log exceptions: provider messages may contain SQL parameters or credentials.
                logger.LogWarning("Notification worker cycle failed {ErrorCode} {TimestampUtc}", "HRM_NOTIFICATION_WORKER_FAILED", DateTimeOffset.UtcNow);
            }
            try { await Task.Delay(TimeSpan.FromSeconds(options.Value.PollSeconds), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
