
using HRM.API.Data;
using HRM.API.Modules.Authorization.Policies;
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
    .Validate(x => x.IsValid(), "Jwt requires Issuer, Audience, a signing key of at least 32 UTF-8 bytes, and AccessTokenMinutes between 1 and 120.")
    .ValidateOnStart();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddAuthorization();
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

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program { }
