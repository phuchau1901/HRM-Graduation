using Microsoft.Extensions.Options;
namespace HRM.API.Modules.Leave.Services;
public sealed class LeaveAccrualWorkerOptions
{
    public bool WorkerEnabled { get; set; } = true;
    public int PollSeconds { get; set; } = 300;
}
public sealed class LeaveAccrualWorker(IServiceScopeFactory scopes, IOptions<LeaveAccrualWorkerOptions> options,
    TimeProvider clock, ILogger<LeaveAccrualWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.WorkerEnabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var result = await scope.ServiceProvider.GetRequiredService<LeaveWorkflowService>().RunScheduledAccrual(stoppingToken);
                if (result.CreditedBalances > 0 || result.ExpiredBalances > 0)
                    logger.LogInformation("Leave automation completed {AsOfDate} {CreditedBalances} {ExpiredBalances}", result.AsOfDate, result.CreditedBalances, result.ExpiredBalances);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception exception)
            {
                var cause = exception.GetBaseException();
                logger.LogWarning("Leave automation cycle failed {ErrorType} {DatabaseErrorNumber} {TimestampUtc}",
                    cause.GetType().FullName, cause is MySqlConnector.MySqlException mysql ? (int?)mysql.Number : null, clock.GetUtcNow());
            }
            try { await Task.Delay(TimeSpan.FromSeconds(options.Value.PollSeconds), clock, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
