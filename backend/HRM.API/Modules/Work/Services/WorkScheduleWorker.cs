using Microsoft.Extensions.Options;
namespace HRM.API.Modules.Work.Services;
public sealed class WorkScheduleWorkerOptions
{
    public bool WorkerEnabled { get; set; } = true;
    public int PollSeconds { get; set; } = 300;
}
public sealed class WorkScheduleWorker(IServiceScopeFactory scopes, IOptions<WorkScheduleWorkerOptions> options,
    TimeProvider clock, ILogger<WorkScheduleWorker> logger) : BackgroundService
{
    public static TimeSpan NextDelay(DateTimeOffset now, int pollSeconds)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Asia/Ho_Chi_Minh");
        var local = TimeZoneInfo.ConvertTime(now, zone);
        var nextSunday = DateOnly.FromDateTime(local.DateTime).AddDays(7 - (int)local.DayOfWeek);
        var boundary = TimeZoneInfo.ConvertTimeToUtc(nextSunday.ToDateTime(TimeOnly.MinValue), zone);
        return TimeSpan.FromSeconds(Math.Min(pollSeconds, Math.Max(1, (boundary - now.UtcDateTime).TotalSeconds)));
    }
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var terminalContext = HRM.API.Logging.TerminalLogContext.BeginJob("Work");
        if (!options.Value.WorkerEnabled) return;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var result = await scope.ServiceProvider.GetRequiredService<WorkScheduleService>().RunAutomaticSchedules(stoppingToken);
                if (result.Status != "DISABLED") logger.LogInformation("Weekly scheduling evaluated {WeekFrom} {Status} {Created} {Employees} {Skipped}", result.WeekFrom, result.Status, result.Created, result.Employees, result.Skipped);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception error) { logger.LogWarning("Weekly scheduling failed {ErrorType}; committed employees remain idempotent and pending batches retry next poll", error.GetBaseException().GetType().FullName); }
            try { await Task.Delay(NextDelay(clock.GetUtcNow(), options.Value.PollSeconds), clock, stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
