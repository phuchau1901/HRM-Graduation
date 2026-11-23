using System.Collections.Concurrent;
using System.Reflection;
using System.Security.Claims;
using HRM.API.Logging;
using HRM.API.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;
namespace HRM.API.Tests;
public sealed class TerminalLoggingTests
{
    [Theory]
    [InlineData("Y", "Y", "Y", true)]
    [InlineData("N", "Y", "Y", false)]
    [InlineData("Y", "N", "Y", false)]
    [InlineData("Y", "Y", "N", false)]
    [InlineData("true", "Y", "Y", false)]
    [InlineData("y", "y", "y", true)]
    public void BothUserAndModuleMustBeEnabled(string enabled, string user, string module, bool expected)
    {
        var options = new TerminalLoggingOptions { Enabled = enabled, Users = new() { ["Admin"] = user }, Modules = new() { ["Employees"] = module } };
        Assert.Equal(expected, options.Allows("admin", "employees"));
        Assert.False(options.Allows("someone-else", "Employees"));
        Assert.False(options.Allows("admin", "another-module"));
    }
    [Fact]
    public void DefaultsAreOffAndExplicitNOverridesYDefault()
    {
        Assert.False(new TerminalLoggingOptions().Allows("admin", "Employees"));
        var options = new TerminalLoggingOptions { Enabled = "Y", DefaultUser = "Y", DefaultModule = "Y", Users = new() { ["system"] = "N" }, Modules = new() { ["Notifications"] = "N" } };
        Assert.True(options.Allows("admin", "Employees"));
        Assert.False(options.Allows("system", "Employees"));
        Assert.False(options.Allows("admin", "Notifications"));
        Assert.False(options.Allows("admin", "Employees", sql: true));
    }
    [Fact]
    public void ConsoleFilterUsesValidatedIdentityAndControllerModuleForEfAndAccessLogs()
    {
        var context = new DefaultHttpContext();
        context.User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "admin")], "untrusted-test"));
        context.Request.Headers["X-User-Id"] = "admin";
        context.SetEndpoint(new Endpoint(_ => Task.CompletedTask, new EndpointMetadataCollection(new ControllerActionDescriptor { ControllerTypeInfo = typeof(HRM.API.Modules.Employees.Controllers.EmployeesController).GetTypeInfo() }), "Employees"));
        var accessor = new HttpContextAccessor { HttpContext = context };
        var options = new Monitor(new() { Enabled = "Y", Users = new() { ["admin"] = "Y" }, Modules = new() { ["Employees"] = "Y" } });
        var capture = new Capture(); using var provider = new TerminalConsoleProvider(options, accessor, capture);
        var access = provider.CreateLogger("HRM.API.Middleware.ApiAccessLoggingMiddleware");
        access.LogInformation("Unauthenticated request"); Assert.Empty(capture.Messages);
        context.Items[ApiErrors.ValidatedUserItem] = "admin";
        access.LogInformation("Authenticated request"); Assert.Single(capture.Messages);
        var sql = provider.CreateLogger("Microsoft.EntityFrameworkCore.Database.Command");
        sql.LogInformation("SELECT test"); Assert.Single(capture.Messages);
        options.CurrentValue.IncludeSql = "Y";
        sql.LogInformation("SELECT test"); Assert.Equal(2, capture.Messages.Count);
        // This must take effect for existing loggers, including errors, without changing response handling.
        options.Value = new() { Enabled = "N" };
        access.LogError("Disabled terminal"); Assert.Equal(2, capture.Messages.Count);
        accessor.HttpContext = null;
    }
    [Fact]
    public async Task BackgroundSqlUsesJobModuleAndContextsDoNotLeakAcrossTasks()
    {
        var options = new Monitor(new() { Enabled = "Y", IncludeSql = "Y", Users = new() { ["system"] = "Y" }, Modules = new() { ["Notifications"] = "N", ["Work"] = "Y" } });
        var capture = new Capture(); using var provider = new TerminalConsoleProvider(options, new HttpContextAccessor(), capture);
        var logger = provider.CreateLogger("Microsoft.EntityFrameworkCore.Database.Command");
        await Task.WhenAll(Task.Run(async () => { using var context = TerminalLogContext.BeginJob("Notifications"); await Task.Yield(); logger.LogInformation("notification SQL"); }),
            Task.Run(async () => { using var context = TerminalLogContext.BeginJob("Work"); await Task.Yield(); logger.LogInformation("work SQL"); }));
        Assert.Equal("work SQL", Assert.Single(capture.Messages));
        Assert.Null(TerminalLogContext.Module);
        logger.LogInformation("No job context"); Assert.Single(capture.Messages);
    }
    private sealed class Monitor(TerminalLoggingOptions value) : IOptionsMonitor<TerminalLoggingOptions>
    {
        public TerminalLoggingOptions Value = value;
        public TerminalLoggingOptions CurrentValue => Value;
        public TerminalLoggingOptions Get(string? name) => Value;
        public IDisposable? OnChange(Action<TerminalLoggingOptions, string?> listener) => null;
    }
    private sealed class Capture : ILoggerFactory
    {
        public ConcurrentQueue<string> Messages { get; } = new();
        public ILogger CreateLogger(string categoryName) => new Logger(Messages);
        public void AddProvider(ILoggerProvider provider) { }
        public void Dispose() { }
        private sealed class Logger(ConcurrentQueue<string> messages) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel level) => true;
            public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter) => messages.Enqueue(formatter(state, exception));
        }
    }
}
