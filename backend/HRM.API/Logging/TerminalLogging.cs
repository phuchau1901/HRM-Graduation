using HRM.API.Security;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Options;
namespace HRM.API.Logging;

public class TerminalLoggingOptions
{
    public string Enabled { get; set; } = "N";
    public string DefaultUser { get; set; } = "N";
    public string DefaultModule { get; set; } = "N";
    public string IncludeSql { get; set; } = "N";
    public Dictionary<string, string> Users { get; set; } = new();
    public Dictionary<string, string> Modules { get; set; } = new();
    public Dictionary<string, Dictionary<string, string>> UserModules { get; set; } = new();
    // Console output is opt-in. Legacy default=Y must never enable an unspecified user/module.
    public string UserFlag(string user) => Value(Users, user, "N");
    public Dictionary<string, string>? ModulesFor(string user) => UserModules?.FirstOrDefault(p => string.Equals(p.Key, user, StringComparison.OrdinalIgnoreCase)).Value;
    public bool Allows(string user, string module, bool sql = false) => Yes(Enabled)
        && (!sql || Yes(IncludeSql)) && Yes(UserFlag(user)) && Yes(ModulesFor(user) is { } own ? Value(own, module, "N") : Value(Modules, module, "N"));
    private static bool Yes(string? value) => string.Equals(value, "Y", StringComparison.OrdinalIgnoreCase);
    private static string Value(Dictionary<string, string>? values, string key, string fallback) =>
        values?.FirstOrDefault(p => string.Equals(p.Key, key, StringComparison.OrdinalIgnoreCase)).Value ?? fallback;
}

// ExecutionContext flows through async service calls, including EF log messages from background jobs.
public static class TerminalLogContext
{
    private static readonly AsyncLocal<string?> Current = new();
    public static string? Module => Current.Value;
    public static IDisposable BeginJob(string module)
    {
        var previous = Current.Value; Current.Value = module;
        return new Restore(() => Current.Value = previous);
    }
    private sealed class Restore(Action restore) : IDisposable { public void Dispose() => restore(); }
}

public sealed class TerminalConsoleProvider : ILoggerProvider
{
    private readonly ILoggerFactory output;
    private readonly TerminalLoggingState state;
    private readonly IHttpContextAccessor http;
    public TerminalConsoleProvider(TerminalLoggingState state, IHttpContextAccessor http)
        : this(state, http, LoggerFactory.Create(builder => builder.SetMinimumLevel(LogLevel.Trace).AddJsonConsole(o =>
        { o.UseUtcTimestamp = true; o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ"; o.IncludeScopes = true; }))) { }
    internal TerminalConsoleProvider(IOptionsMonitor<TerminalLoggingOptions> options, IHttpContextAccessor http, ILoggerFactory output)
        : this(new TerminalLoggingState(options), http, output) { }
    internal TerminalConsoleProvider(TerminalLoggingState state, IHttpContextAccessor http, ILoggerFactory output)
    { this.state = state; this.http = http; this.output = output; }
    public ILogger CreateLogger(string categoryName) => new TerminalLogger(this, categoryName, output.CreateLogger(categoryName));
    public void Dispose() => output.Dispose();
    internal (string User, string Module) Identity(string category)
    {
        var context = http.HttpContext;
        if (context != null)
        {
            var controller = context.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>();
            return (context.Items[ApiErrors.ValidatedUserItem] as string ?? "anonymous",
                ModuleFrom(controller?.ControllerTypeInfo.Namespace) ?? ModuleFrom(category) ?? "System");
        }
        return ("system", TerminalLogContext.Module ?? ModuleFrom(category) ?? "System");
    }
    internal static string? ModuleFrom(string? name)
    {
        const string marker = ".Modules.";
        var index = name?.IndexOf(marker, StringComparison.Ordinal) ?? -1;
        return index < 0 ? null : name![(index + marker.Length)..].Split('.')[0];
    }
    private sealed class TerminalLogger(TerminalConsoleProvider owner, string category, ILogger inner) : ILogger
    {
        // Decisions happen at Log time: scopes/options/user can change after a logger was created.
        public bool IsEnabled(LogLevel level) => level != LogLevel.None && inner.IsEnabled(level);
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => inner.BeginScope(state);
        public void Log<TState>(LogLevel level, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            var request = owner.http.HttpContext;
            var finalAccessEvent = category == typeof(HRM.API.Middleware.ApiAccessLoggingMiddleware).FullName && eventId.Id == 1000;
            // Authentication itself queries EF before ValidatedUserItem is set. Do not classify
            // a token-bearing request as anonymous and accidentally use anonymous=Y rules.
            if (request != null && request.Items[ApiErrors.ValidatedUserItem] is not string && !finalAccessEvent
                && (request.Request.Headers.Authorization.Count > 0
                    || request.Request.Path.StartsWithSegments("/hubs/notifications") && request.Request.Query.ContainsKey("access_token"))) return;
            var (user, module) = owner.Identity(category);
            var sql = category.StartsWith("Microsoft.EntityFrameworkCore", StringComparison.Ordinal);
            var policy = owner.state.Snapshot();
            if (!IsEnabled(level) || !policy.Settings.Allows(user, module, sql)) return;
            var metadata = new Dictionary<string, object> { ["TerminalUserId"] = user, ["TerminalModule"] = module };
            metadata["TerminalPolicySource"] = policy.Revision.HasValue ? "Database" : "File";
            if (policy.Revision.HasValue) metadata["TerminalPolicyVersion"] = policy.Revision.Value;
            if (owner.http.HttpContext is { } context) metadata["TerminalTraceId"] = context.TraceIdentifier;
            using var scope = inner.BeginScope(metadata);
            inner.Log(level, eventId, state, exception, formatter);
        }
    }
}
