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
    public void PerUserModulesAreIndependentAndDoNotInheritOtherEnabledModules()
    {
        var settings = new TerminalLoggingOptions {
            Enabled = "Y", DefaultModule = "Y", Users = new() { ["admin"] = "Y", ["bob"] = "Y" },
            Modules = new() { ["Employees"] = "Y", ["Attendance"] = "Y" },
            UserModules = new() { ["admin"] = new() { ["Employees"] = "Y" }, ["bob"] = new() { ["Attendance"] = "Y" } }
        };
        Assert.True(settings.Allows("admin", "Employees")); Assert.False(settings.Allows("admin", "Attendance"));
        Assert.True(settings.Allows("bob", "Attendance")); Assert.False(settings.Allows("bob", "Employees"));
        Assert.False(settings.Allows("admin", "Leave"));
        settings.UserModules["bob"].Clear(); Assert.False(settings.Allows("bob", "Attendance"));
        settings.Enabled = "N"; Assert.False(settings.Allows("admin", "Employees"));
    }
    [Fact]
    public void LegacyYDefaultsCannotEnableUnspecifiedUsersOrModules()
    {
        Assert.False(new TerminalLoggingOptions().Allows("admin", "Employees"));
        var options = new TerminalLoggingOptions { Enabled = "Y", DefaultUser = "Y", DefaultModule = "Y", Users = new() { ["system"] = "N" }, Modules = new() { ["Notifications"] = "N" } };
        Assert.False(options.Allows("admin", "Employees"));
        options.Users["admin"] = "Y";
        Assert.False(options.Allows("admin", "Employees"));
        options.Modules["Employees"] = "Y";
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
    [Fact]
    public void EveryControllerModuleUsesOneConsoleProviderAndDisabledUsersEmitNothing()
    {
        using var app = new AuthApiFactory();
        using var client = app.CreateClient(new() { BaseAddress = new("https://localhost") });
        var providers = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetServices<ILoggerProvider>(app.Services).ToArray();
        Assert.IsType<TerminalConsoleProvider>(Assert.Single(providers));
        var actions = Microsoft.Extensions.DependencyInjection.ServiceProviderServiceExtensions.GetRequiredService<Microsoft.AspNetCore.Mvc.Infrastructure.IActionDescriptorCollectionProvider>(app.Services)
            .ActionDescriptors.Items.OfType<ControllerActionDescriptor>().Where(a => a.ControllerTypeInfo.Namespace?.StartsWith("HRM.API.Modules.") == true).ToArray();
        var allModules = actions.Select(a => TerminalConsoleProvider.ModuleFrom(a.ControllerTypeInfo.Namespace)!).Distinct().ToDictionary(m => m, _ => "Y");
        var settings = new TerminalLoggingOptions { Enabled = "Y", IncludeSql = "Y", DefaultUser = "Y", DefaultModule = "Y", Modules = allModules,
            Users = new() { ["disabled"] = "N" }, UserModules = new() { ["disabled"] = allModules } };
        var options = new Monitor(settings); var policy = new TerminalLoggingState(options); var output = new Capture();
        var context = new DefaultHttpContext(); var http = new HttpContextAccessor { HttpContext = context };
        using var provider = new TerminalConsoleProvider(policy, http, output);
        try
        {
            foreach (var user in new[] { "disabled", "never-configured" })
            foreach (var action in actions)
            {
                context.Items[ApiErrors.ValidatedUserItem] = user;
                context.SetEndpoint(new Endpoint(_ => Task.CompletedTask, new EndpointMetadataCollection(action), action.DisplayName));
                foreach (var category in new[] { "HRM.API.Middleware.ApiAccessLoggingMiddleware", "Microsoft.EntityFrameworkCore.Database.Command", action.ControllerTypeInfo.FullName! })
                {
                    var logger = provider.CreateLogger(category);
                    foreach (var level in new[] { LogLevel.Information, LogLevel.Warning, LogLevel.Error, LogLevel.Critical }) logger.Log(level, "Must stay silent");
                }
            }
            Assert.Empty(output.Messages);
            // All background module loggers, including EF, also remain silent unless system is explicitly Y.
            http.HttpContext = null;
            foreach (var module in allModules.Keys)
            {
                using var job = TerminalLogContext.BeginJob(module);
                provider.CreateLogger("Microsoft.EntityFrameworkCore.Database.Command").LogError("Background SQL");
            }
            Assert.Empty(output.Messages);
            settings.Users["enabled"] = "Y"; context.Items[ApiErrors.ValidatedUserItem] = "enabled"; http.HttpContext = context;
            provider.CreateLogger("HRM.API.Middleware.ApiAccessLoggingMiddleware").LogInformation("Explicit user/module Y");
            Assert.Single(output.Messages);
            var disabledPolicy = new TerminalLoggingOptions { Enabled = "N" };
            policy.Publish(disabledPolicy, 2);
            policy.Publish(settings, 1); // A delayed refresh may not restore older enabled rules.
            provider.CreateLogger("HRM.API.Middleware.ApiAccessLoggingMiddleware").LogCritical("Must remain disabled");
            Assert.Single(output.Messages);
        }
        finally { http.HttpContext = null; }
    }
    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void TokenAuthenticationSqlCannotUseAnonymousOptInBeforeUserValidation(bool hub)
    {
        var context = new DefaultHttpContext();
        context.SetEndpoint(new Endpoint(_ => Task.CompletedTask, new EndpointMetadataCollection(new ControllerActionDescriptor { ControllerTypeInfo = typeof(HRM.API.Modules.Employees.Controllers.EmployeesController).GetTypeInfo() }), "Employees"));
        if (hub) { context.Request.Path = "/hubs/notifications"; context.Request.QueryString = new("?access_token=not-read-for-identity"); }
        else context.Request.Headers.Authorization = "Bearer not-read-for-identity";
        var http = new HttpContextAccessor { HttpContext = context };
        var options = new Monitor(new() { Enabled = "Y", IncludeSql = "Y", Users = new() { ["anonymous"] = "Y", ["disabled"] = "N" }, Modules = new() { ["Employees"] = "Y" } });
        var output = new Capture(); using var provider = new TerminalConsoleProvider(options, http, output);
        try
        {
            var sql = provider.CreateLogger("Microsoft.EntityFrameworkCore.Database.Command");
            sql.LogInformation("Authentication database query before identity validation"); Assert.Empty(output.Messages);
            context.Items[ApiErrors.ValidatedUserItem] = "disabled";
            sql.LogError("Known user remains opted out"); Assert.Empty(output.Messages);
            context.Items.Remove(ApiErrors.ValidatedUserItem);
            provider.CreateLogger(typeof(HRM.API.Middleware.ApiAccessLoggingMiddleware).FullName!).LogInformation(new EventId(1000, "ApiAccess"), "Final denied request remains anonymous");
            Assert.Single(output.Messages);
        }
        finally { http.HttpContext = null; }
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
