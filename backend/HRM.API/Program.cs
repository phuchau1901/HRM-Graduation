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
builder.Logging.AddJsonConsole(o => { o.UseUtcTimestamp = true; o.TimestampFormat = "yyyy-MM-ddTHH:mm:ss.fffZ"; });
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



var origins = builder.Configuration
    .GetSection("Notifications:AllowedOrigins")
    .Get<string[]>() ?? [];

var allowedOrigins = origins
    .Where(origin =>
        Uri.TryCreate(origin, UriKind.Absolute, out var uri)
        && (
            uri.Scheme == Uri.UriSchemeHttps
            || (
                builder.Environment.IsDevelopment()
                && uri.Scheme == Uri.UriSchemeHttp
                && uri.IsLoopback
            )
        ))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

if (allowedOrigins.Length != origins.Length)
{
    Console.WriteLine(
        "Warning: Invalid Notification CORS origins ignored.");
}



builder.Services.AddCors(o => o.AddPolicy("NotificationClients", policy =>
    policy.WithOrigins(notificationOrigins.Select(origin => new Uri(origin).GetLeftPart(UriPartial.Authority)).Distinct().ToArray())
        .AllowAnyHeader().AllowAnyMethod().AllowCredentials().WithExposedHeaders("X-Correlation-Id")));
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
                if (!await db.Set<User>().AsNoTracking().AnyAsync(x => x.UserId == sub && x.Status == "ACTIVE", context.HttpContext.RequestAborted))
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

    Console.WriteLine("=================================");
    Console.WriteLine($"TOTAL ENTITIES: {entities.Count}");
    Console.WriteLine("=================================");

    foreach (var entity in entities)
    {
        Console.WriteLine(
            $"ENTITY: {entity.ClrType.Name} => {entity.GetTableName()}"
        );
    }

    app.UseSwagger();
    app.UseSwaggerUI();
}

if (app.Environment.IsDevelopment()
    && builder.Configuration.GetValue<bool>("AuthSeed:Enabled"))
{
    Console.WriteLine("[AUTH SEED] Starting...");

    using var scope = app.Services.CreateScope();

    var seedSecrets = new ConfigurationBuilder()
        .AddUserSecrets<Program>(optional: true)
        .Build();

    await scope.ServiceProvider
        .GetRequiredService<AuthSeeder>()
        .SeedAsync(seedSecrets);

    Console.WriteLine("[AUTH SEED] Completed.");
}
else
{
    Console.WriteLine(
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

app.MapControllers();
app.MapHub<NotificationHub>("/hubs/notifications", o => o.CloseOnAuthenticationExpiration = true).RequireCors("NotificationClients");

app.Run();

public partial class Program { }
