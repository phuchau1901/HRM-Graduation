using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace HRM.API.Logging;

public sealed class TerminalLoggingRequest : TerminalLoggingOptions, IValidatableObject
{
    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (new[] { Enabled, DefaultUser, DefaultModule, IncludeSql }.Any(x => x is not ("Y" or "N")))
            yield return new("Terminal logging flags must be Y or N.");
        foreach (var error in ValidateMap(Users).Concat(ValidateMap(Modules))) yield return error;
        if (UserModules is null || UserModules.Count > 500 || UserModules.Keys.Any(x => string.IsNullOrWhiteSpace(x) || x.Length > 100 || x != x.Trim())
            || UserModules.Keys.Distinct(StringComparer.OrdinalIgnoreCase).Count() != UserModules.Count)
            yield return new("Invalid or duplicate userModules user keys (maximum 500 users).");
        if (UserModules != null) foreach (var map in UserModules.Values) foreach (var error in ValidateMap(map)) yield return error;
    }
    internal static IEnumerable<ValidationResult> ValidateMap(Dictionary<string, string>? map)
    {
        if (map is null || map.Count > 500 || map.Any(p => string.IsNullOrWhiteSpace(p.Key) || p.Key.Length > 100 || p.Key != p.Key.Trim() || p.Value is not ("Y" or "N"))
            || map.Keys.Distinct(StringComparer.OrdinalIgnoreCase).Count() != map.Count)
            yield return new("Invalid or duplicate terminal logging rules (maximum 500 per map).");
    }

}

public sealed class TerminalUserLoggingRequest : IValidatableObject
{
    public string Enabled { get; set; } = "N";
    public Dictionary<string, string> Modules { get; set; } = new();
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (Enabled is not ("Y" or "N")) yield return new("Enabled must be Y or N.");
        foreach (var error in TerminalLoggingRequest.ValidateMap(Modules)) yield return error;
    }
}
public sealed record TerminalUserLoggingView(string Enabled, Dictionary<string, string> Modules, string GlobalEnabled, string IncludeSql, string[] AvailableModules);

// The provider only reads memory; database access never happens from ILogger.Log.
public sealed class TerminalLoggingState(IOptionsMonitor<TerminalLoggingOptions> fallback)
{
    public const string Key = "TERMINAL_LOGGING";
    private readonly object sync = new();
    private TerminalLoggingOptions? stored;
    private long version = -1;
    public TerminalLoggingOptions Current => Volatile.Read(ref stored) ?? fallback.CurrentValue;
    public void Publish(TerminalLoggingOptions settings, long revision)
    {
        var copy = SettingsDefaults.Read<TerminalLoggingRequest>(JsonSerializer.Serialize(settings, SettingsDefaults.Json));
        SettingsDefaults.Validate(copy);
        lock (sync)
        {
            if (revision < version) return;
            Volatile.Write(ref stored, copy); version = revision;
        }
    }
}

public sealed class TerminalLoggingRefreshOptions
{
    public bool WorkerEnabled { get; set; } = true;
    public int PollSeconds { get; set; } = 30;
}
public sealed class TerminalLoggingRefreshWorker(IServiceScopeFactory scopes, TerminalLoggingState state,
    IOptions<TerminalLoggingRefreshOptions> options, ILogger<TerminalLoggingRefreshWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.WorkerEnabled) return;
        using var context = TerminalLogContext.BeginJob("System");
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var row = await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<SystemSetting>().AsNoTracking()
                    .SingleOrDefaultAsync(x => x.Key == TerminalLoggingState.Key, stoppingToken);
                if (row != null) state.Publish(SettingsDefaults.Read<TerminalLoggingRequest>(row.JsonValue), row.Version);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception)
            {
                // Retain the last valid setting; never emit a connection string/SQL exception.
                logger.LogWarning("Terminal logging settings refresh failed; retaining the last valid configuration.");
            }
            try { await Task.Delay(TimeSpan.FromSeconds(Math.Clamp(options.Value.PollSeconds, 5, 300)), stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
        }
    }
}
