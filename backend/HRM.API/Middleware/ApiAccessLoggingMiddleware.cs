using System.Diagnostics;
using HRM.API.Security;
using HRM.API.Modules.Authorization.Policies;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Routing;

namespace HRM.API.Middleware;

public sealed class ApiAccessLoggingOptions
{
    public bool IncludeClientIp { get; set; }
    public string[] ExcludedPaths { get; set; } = ["/health", "/healthz", "/ready"];
    // Keys must be endpoint route templates, never raw URLs. Only successful requests are sampled.
    public Dictionary<string, double> SuccessSampleRates { get; set; } = new(StringComparer.Ordinal);
}

public sealed class ApiAccessLoggingMiddleware(RequestDelegate next, ILogger<ApiAccessLoggingMiddleware> logger,
    IOptions<ApiAccessLoggingOptions> options)
{
    public async Task InvokeAsync(HttpContext context)
    {
        context.TraceIdentifier = Guid.NewGuid().ToString("N");
        context.Response.Headers["X-Correlation-Id"] = context.TraceIdentifier;
        var started = Stopwatch.GetTimestamp();
        var failed = false;
        try { await next(context); }
        catch (Exception) when (!context.Response.HasStarted && !context.RequestAborted.IsCancellationRequested)
        {
            failed = true;
            context.Response.Clear();
            context.Response.Headers["X-Correlation-Id"] = context.TraceIdentifier;
            await ApiErrors.WriteAsync(context, 500, "HRM_API_500", "INTERNAL_ERROR", "An unexpected error occurred.");
        }
        catch { failed = true; throw; }
        finally
        {
            var status = failed ? 500 : context.Response.StatusCode;
            var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "/[unmatched]";
            var config = options.Value;
            var excluded = config.ExcludedPaths.Any(x => context.Request.Path.Equals(new PathString(x)));
            var sample = config.SuccessSampleRates.TryGetValue(route, out var rate) ? Math.Clamp(rate, 0, 1) : 1;
            if (status >= 400 || (!excluded && (status >= 300 || Random.Shared.NextDouble() < sample)))
            {
                var permissions = context.GetEndpoint()?.Metadata.GetOrderedMetadata<ScreenPermissionAttribute>();
                var screens = permissions is null ? null : string.Join(",", permissions.Select(x => x.ScreenCode));
                var actions = permissions is null ? null : string.Join(",", permissions.Select(x => x.ActionCode));
                var method = context.Request.Method.ToUpperInvariant();
                if (method is not ("GET" or "POST" or "PUT" or "PATCH" or "DELETE" or "HEAD" or "OPTIONS")) method = "OTHER";
                logger.LogInformation(new EventId(1000, "ApiAccess"),
                    "API access {TimestampUtc} {TraceId} {CorrelationId} {UserId} {Method} {Route} {StatusCode} {DurationMs} {ClientPlatform} {ScreenCode} {Action} {ErrorCode} {ClientIp}",
                    DateTimeOffset.UtcNow, context.TraceIdentifier, context.TraceIdentifier,
                    context.Items[ApiErrors.ValidatedUserItem] as string ?? "anonymous", method, route,
                    status, Stopwatch.GetElapsedTime(started).TotalMilliseconds, "unknown", screens, actions,
                    context.Items[ApiErrors.ErrorItem] as string,
                    config.IncludeClientIp ? context.Connection.RemoteIpAddress?.ToString() : null);
            }
        }
    }
}
