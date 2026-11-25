using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Work.Services;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using HRM.API.Modules.Notifications.Services;

using HRM.API.Modules.Notifications.Realtime;

using Microsoft.AspNetCore.SignalR;

using HRM.API.Security;

using HRM.API.Middleware;

using Microsoft.AspNetCore.HttpOverrides;

using System.Net;

using HRM.API.Data;

using HRM.API.Modules.Authorization.Policies;

using HRM.API.Modules.Authorization.Services;

using Microsoft.AspNetCore.Authorization;

using HRM.API.Data.Seeders;

using HRM.API.Modules.Authorization.Entities;

using Microsoft.AspNetCore.Authentication.JwtBearer;

using Microsoft.Extensions.Options;

using Microsoft.IdentityModel.Tokens;

using System.Text;

using System.IdentityModel.Tokens.Jwt;

using Microsoft.EntityFrameworkCore;

using HRM.API.Modules.Auth.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();

builder.Services.AddHttpContextAccessor();
builder.Services.Configure<HRM.API.Logging.TerminalLoggingOptions>(builder.Configuration.GetSection("TerminalLogging"));
builder.Services.AddSingleton<HRM.API.Logging.TerminalLoggingState>();
builder.Services.Configure<HRM.API.Logging.TerminalLoggingRefreshOptions>(builder.Configuration.GetSection("TerminalLoggingRefresh"));
builder.Services.AddHostedService<HRM.API.Logging.TerminalLoggingRefreshWorker>();
builder.Services.AddScoped<HRM.API.Modules.System.Services.TerminalLoggingSettingsService>();
builder.Services.AddSingleton<ILoggerProvider, HRM.API.Logging.TerminalConsoleProvider>();

// Hosting diagnostics include raw URLs; the access middleware records safe route templates instead.

builder.Logging.AddFilter("Microsoft.AspNetCore.Hosting.Diagnostics", LogLevel.Warning);

builder.Services.Configure<ApiAccessLoggingOptions>(builder.Configuration.GetSection("ApiAccessLogging"));

var trustedProxies = builder.Configuration.GetSection("ReverseProxy:KnownProxies").Get<string[]>() ?? [];

if (trustedProxies.Length > 0)

    builder.Services.Configure<ForwardedHeadersOptions>(o =>

    {

        o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;

        o.ForwardLimit = 1;

        o.KnownNetworks.Clear(); o.KnownProxies.Clear();

        foreach (var proxy in trustedProxies) o.KnownProxies.Add(IPAddress.Parse(proxy));

    });

// Notification CORS: ignore invalid origins instead of preventing the entire API from starting.
// Production permits HTTPS origins only; HTTP loopback is only permitted in Development.
var notificationOrigins = builder.Configuration
    .GetSection("Notifications:AllowedOrigins")
    .Get<string[]>() ?? [];

var allowedOrigins = notificationOrigins
    .Where(origin =>
    {
        if (!Uri.TryCreate(origin, UriKind.Absolute, out var uri)) return false;
        if (!string.IsNullOrEmpty(uri.UserInfo) ||
            !string.IsNullOrEmpty(uri.Query) ||
            !string.IsNullOrEmpty(uri.Fragment) ||
            uri.AbsolutePath != "/") return false;

        return uri.Scheme == Uri.UriSchemeHttps ||
               (builder.Environment.IsDevelopment() &&
                uri.Scheme == Uri.UriSchemeHttp && uri.IsLoopback);
    })
    .Select(origin => new Uri(origin).GetLeftPart(UriPartial.Authority))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

if (notificationOrigins.Length != allowedOrigins.Length)
{
    // Fail closed: invalid origins are not added to the policy.
    builder.Logging.AddFilter("Microsoft.AspNetCore.Cors", LogLevel.Warning);
    // Logged through the configurable terminal provider after the app is built.
}

builder.Services.AddCors(options =>
    options.AddPolicy("NotificationClients", policy =>
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials()
              .WithExposedHeaders("X-Correlation-Id")));

builder.Services.AddSignalR();

builder.Services.AddSingleton<IUserIdProvider, NotificationUserIdProvider>();

builder.Services.AddScoped<INotificationTransport, SignalRNotificationTransport>();

builder.Services.AddScoped<NotificationService>();

builder.Services.AddScoped<NotificationDispatcher>();

builder.Services.AddOptions<NotificationOptions>().Bind(builder.Configuration.GetSection("Notifications"))

    .Validate(x => x.PollSeconds is >= 1 and <= 60 && x.RecipientBatchSize is >= 1 and <= 1000 &&

        x.DeliveryBatchSize is >= 1 and <= 500 && x.MaxAttempts is >= 1 and <= 10 && x.LeaseSeconds is >= 30 and <= 600,

        "Invalid notification worker limits.").ValidateOnStart();

builder.Services.AddHostedService<NotificationWorker>();

builder.Services.AddScoped<HRM.API.Common.BusinessExceptionFilter>();
builder.Services.AddScoped<HRM.API.Modules.Organization.Services.OrganizationService>();
builder.Services.AddScoped<HRM.API.Modules.Organization.Services.TeamService>();
builder.Services.AddScoped<HRM.API.Modules.Organization.Services.OrganizationTreeService>();
builder.Services.AddScoped<HRM.API.Modules.Employees.Services.EmployeeDataScope>();
builder.Services.AddScoped<HRM.API.Modules.Leave.Services.LeaveBalanceAccounting>();
builder.Services.AddScoped<HRM.API.Modules.Approvals.Services.ApprovalWorkflowService>();
builder.Services.AddScoped<HRM.API.Modules.Approvals.Services.IApprovalModule, HRM.API.Modules.Approvals.Modules.Leave.LeaveApprovalModule>();
builder.Services.AddScoped<HRM.API.Modules.Approvals.Services.IApprovalModule, HRM.API.Modules.Approvals.Modules.Overtime.OvertimeApprovalModule>();
builder.Services.AddScoped<HRM.API.Modules.Approvals.Services.IApprovalModule, HRM.API.Modules.Approvals.Modules.Attendance.AttendanceAdjustmentApprovalModule>();
builder.Services.AddScoped<HRM.API.Modules.Leave.Services.LeaveWorkflowService>();
builder.Services.AddScoped<HRM.API.Modules.Performance.Services.KpiService>();
builder.Services.AddScoped<HRM.API.Modules.Payroll.Services.PayrollService>();
builder.Services.AddScoped<HRM.API.Modules.Dashboard.Services.DashboardService>();
builder.Services.AddScoped<HRM.API.Modules.Approvals.Services.IApprovalModule, HRM.API.Modules.Payroll.Services.PayrollApprovalModule>();
builder.Services.AddScoped<HRM.API.Modules.Approvals.Services.IApprovalModule, HRM.API.Modules.Performance.Services.KpiApprovalModule>();
builder.Services.AddOptions<HRM.API.Modules.Leave.Services.LeaveAccrualWorkerOptions>()
    .Bind(builder.Configuration.GetSection("LeaveAccrual"))
    .Validate(o => o.PollSeconds is >= 30 and <= 3600, "LeaveAccrual PollSeconds must be between 30 and 3600.").ValidateOnStart();
builder.Services.AddHostedService<HRM.API.Modules.Leave.Services.LeaveAccrualWorker>();
builder.Services.AddOptions<HRM.API.Modules.Work.Services.WorkScheduleWorkerOptions>()
    .Bind(builder.Configuration.GetSection("WorkScheduleAutomation"))
    .Validate(o => o.PollSeconds is >= 30 and <= 3600, "WorkScheduleAutomation PollSeconds must be between 30 and 3600.").ValidateOnStart();
builder.Services.AddHostedService<HRM.API.Modules.Work.Services.WorkScheduleWorker>();
builder.Services.AddScoped<HRM.API.Modules.Employees.Services.ContractTypeService>();
builder.Services.AddScoped<HRM.API.Modules.Employees.Services.ContractNumberGenerator>();
builder.Services.AddScoped<HRM.API.Modules.Employees.Services.ContractStatisticsService>();
builder.Services.AddScoped<HRM.API.Modules.Employees.Services.EmployeeService>();
builder.Services.AddScoped<HRM.API.Modules.Employees.Services.EmployeeCodeGenerator>();
builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen();

builder.Services.AddSingleton<PasswordService>();

builder.Services.AddSingleton<LoginRateLimiter>();

builder.Services.AddHttpContextAccessor();

builder.Services.AddScoped<AuthService>();

builder.Services.AddScoped<AuthProfileService>();

builder.Services.AddScoped<JwtService>();

builder.Services.AddScoped<AuthSeeder>();

builder.Services.AddOptions<JwtOptions>().Bind(builder.Configuration.GetSection("Jwt"))

    .Validate(x => x.IsValid(), "Jwt requires Issuer, Audience, a signing key of at least 32 UTF-8 bytes, AccessTokenMinutes between 1 and 120, and MaxTokenBytes between 2048 and 32768.")

    .ValidateOnStart();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();

builder.Services.AddAuthorization();

builder.Services.AddScoped<IPermissionService, PermissionService>();
builder.Services.AddScoped<AdministrationService>();
builder.Services.AddSingleton<TimeProvider>(TimeProvider.System);
builder.Services.AddScoped<HRM.API.Modules.System.Services.SystemSettingsService>();
builder.Services.AddScoped<HRM.API.Modules.System.Services.AuditLogService>();
builder.Services.AddScoped<HRM.API.Modules.System.Services.PasswordPolicyService>();
builder.Services.AddScoped<HRM.API.Modules.Work.Services.WorkScheduleService>();
builder.Services.AddScoped<HRM.API.Modules.Attendance.Services.AttendanceOperationsService>();
builder.Services.AddScoped<HRM.API.Modules.Attendance.Services.UnscheduledAttendanceService>();
builder.Services.AddScoped<HRM.API.Modules.Attendance.Services.AttendanceManagementService>();
builder.Services.AddScoped<PasswordResetAuditFilter>();
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("AdministrationReset", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst("sub")?.Value ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    options.OnRejected = async (context, _) =>
    {
        await PasswordResetAudit.Failure(context.HttpContext, 429);
        await ApiErrors.WriteAsync(context.HttpContext, 429, "HRM_AUTH_005", "RATE_LIMITED", "Too many password reset attempts.");
    };
});

builder.Services.AddSingleton<IAuthorizationPolicyProvider, ScreenPermissionPolicyProvider>();

builder.Services.AddScoped<IAuthorizationHandler, ScreenPermissionHandler>();

builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)

    .Configure<IOptions<JwtOptions>>((options, jwt) =>

    {

        var config = jwt.Value;

        options.MapInboundClaims = false;

        options.IncludeErrorDetails = false;

        options.TokenValidationParameters = new TokenValidationParameters

        {

            ValidateIssuer = true, ValidIssuer = config.Issuer,

            ValidateAudience = true, ValidAudience = config.Audience,

            ValidateIssuerSigningKey = true,

            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config.SigningKey)),

            ValidateLifetime = true, RequireExpirationTime = true, RequireSignedTokens = true,

            ValidAlgorithms = new[] { SecurityAlgorithms.HmacSha256 },

            ClockSkew = TimeSpan.FromSeconds(30), NameClaimType = "name", RoleClaimType = "role"

        };

        options.Events = new JwtBearerEvents

        {

            OnMessageReceived = context =>

            {

                // Browser WebSocket/SSE clients cannot always set Authorization. Accept query tokens only on this hub.

                if (context.Request.Path.StartsWithSegments("/hubs/notifications") &&

                    string.IsNullOrEmpty(context.Request.Headers.Authorization.ToString()) &&

                    context.Request.Query.TryGetValue("access_token", out var queryToken))

                {

                    if (queryToken.Count != 1 || Encoding.UTF8.GetByteCount(queryToken.ToString()) > config.MaxTokenBytes)

                        context.Fail("Invalid token.");

                    else context.Token = queryToken.ToString();

                }

                var header = context.Request.Headers.Authorization.ToString();

                if (header.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) &&

                    Encoding.UTF8.GetByteCount(header.AsSpan(7)) > config.MaxTokenBytes)

                    context.Fail("Invalid token.");

                return Task.CompletedTask;

            },

            OnAuthenticationFailed = context =>

            {

                if (context.Exception is SecurityTokenExpiredException)

                    context.HttpContext.Items["HRM.TokenExpired"] = true;

                return Task.CompletedTask;

            },

            OnChallenge = async context =>

            {

                context.HandleResponse();

                context.Response.Headers.WWWAuthenticate = "Bearer";

                var expired = context.HttpContext.Items["HRM.TokenExpired"] is true;

                var missing = string.IsNullOrEmpty(context.Request.Headers.Authorization.ToString()) &&

                    !(context.Request.Path.StartsWithSegments("/hubs/notifications") && context.Request.Query.ContainsKey("access_token"));

                await ApiErrors.WriteAsync(context.HttpContext, 401,

                    expired ? "HRM_AUTH_002" : "HRM_AUTH_001",

                    expired ? "TOKEN_EXPIRED" : missing ? "MISSING_TOKEN" : "INVALID_TOKEN",

                    expired ? "Access token has expired." : "Authentication required.");

            },

            OnForbidden = context => ApiErrors.WriteAsync(context.HttpContext, 403,

                "HRM_AUTH_003", "PERMISSION_DENIED", "Permission denied."),

            OnTokenValidated = async context =>

            {

                var sub = context.Principal?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;

                if (string.IsNullOrWhiteSpace(sub) || sub.Length > 100)

                {

                    context.Fail("Invalid identity."); return;

                }

                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();

                var identity = await db.Set<User>().AsNoTracking()
                    .Where(x => x.UserId == sub && x.Status == "ACTIVE")
                    .Select(x => new { x.AuthVersion }).SingleOrDefaultAsync(context.HttpContext.RequestAborted);
                if (identity is null || !AuthSessionVersion.Matches(context.Principal, identity.AuthVersion))
                    context.Fail("Invalid identity.");
                else context.HttpContext.Items[ApiErrors.ValidatedUserItem] = sub;

            }

        };

    });

// MySQL

var connectionString = builder.Configuration

    .GetConnectionString("DefaultConnection")

    ?? throw new InvalidOperationException(

        "Missing MySQL connection string"

    );

builder.Services.AddDbContext<AppDbContext>(options =>

    options.UseMySql(

        connectionString,

        new MySqlServerVersion(new Version(8, 0, 36))

    )

);

var app = builder.Build();
if (notificationOrigins.Length != allowedOrigins.Length)
    app.Logger.LogWarning("Invalid notification CORS origins ignored; no cross-origin fallback enabled.");

// Validate JWT configuration before any explicitly enabled seed can write data.

_ = app.Services.GetRequiredService<IOptions<JwtOptions>>().Value;

// Kiểm tra Entity trong môi trường Development

if (app.Environment.IsDevelopment())

{

    using var scope = app.Services.CreateScope();

    var db = scope.ServiceProvider

        .GetRequiredService<AppDbContext>();

    var entities = db.Model.GetEntityTypes()

        .OrderBy(x => x.ClrType.Name)

        .ToList();

    app.Logger.LogInformation("=================================");

    app.Logger.LogInformation($"TOTAL ENTITIES: {entities.Count}");

    app.Logger.LogInformation("=================================");

    foreach (var entity in entities)

    {

        app.Logger.LogInformation(

            $"ENTITY: {entity.ClrType.Name} => {entity.GetTableName()}"

        );

    }

    app.UseSwagger();

    app.UseSwaggerUI();

}

if (app.Environment.IsDevelopment()

    && builder.Configuration.GetValue<bool>("AuthSeed:Enabled"))

{

    app.Logger.LogInformation("[AUTH SEED] Starting...");

    using var scope = app.Services.CreateScope();

    var seedSecrets = new ConfigurationBuilder()

        .AddUserSecrets<Program>(optional: true)

        .Build();

    await scope.ServiceProvider

        .GetRequiredService<AuthSeeder>()

        .SeedAsync(seedSecrets);

    app.Logger.LogInformation("[AUTH SEED] Completed.");

}

else

{

    app.Logger.LogInformation(

        $"[AUTH SEED] Skipped. Environment={app.Environment.EnvironmentName}, Enabled={builder.Configuration.GetValue<bool>("AuthSeed:Enabled")}"

    );

}

if (trustedProxies.Length > 0) app.UseForwardedHeaders();

app.UseMiddleware<ApiAccessLoggingMiddleware>();

app.UseRouting();
app.UseCors();

app.UseHttpsRedirection();

app.UseAuthentication();

app.UseAuthorization();
app.UseRateLimiter();




app.MapControllers();

app.MapHub<NotificationHub>("/hubs/notifications", o => o.CloseOnAuthenticationExpiration = true).RequireCors("NotificationClients");

app.Run();

public partial class Program { }
