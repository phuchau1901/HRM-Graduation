using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using HRM.API.Middleware;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Security;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Xunit;

namespace HRM.API.Tests;

public sealed class AuthorizationV2Tests
{
    [Fact]
    public async Task LoginContainsMergedPermissionsIncludingActionsWithoutView()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password });
        response.EnsureSuccessStatusCode();
        var login = (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
        var token = new JwtSecurityTokenHandler().ReadJwtToken(login.AccessToken);
        var principal = new ClaimsPrincipal(new ClaimsIdentity(token.Claims, "test"));
        Assert.True(JwtPermissions.HasPermission(principal, "EMPLOYEES", "VIEW"));
        Assert.True(JwtPermissions.HasPermission(principal, "EMPLOYEES", "UPDATE"));
        Assert.False(JwtPermissions.HasPermission(principal, "EMPLOYEES", "DELETE"));
        Assert.False(JwtPermissions.HasPermission(principal, "EMPLOYEES", "IMPORT"));
        Assert.DoesNotContain(app.Password, token.Payload.SerializeToJson());
        Assert.InRange(Encoding.UTF8.GetByteCount(login.AccessToken), 1, 8192);
        Assert.InRange((token.ValidTo - token.ValidFrom).TotalMinutes, 14.99, 15.01);
    }

    [Theory]
    [InlineData("missing", "HRM_AUTH_001", "MISSING_TOKEN")]
    [InlineData("invalid", "HRM_AUTH_001", "INVALID_TOKEN")]
    [InlineData("expired", "HRM_AUTH_002", "TOKEN_EXPIRED")]
    [InlineData("expiredWrongSignature", "HRM_AUTH_001", "INVALID_TOKEN")]
    [InlineData("tampered", "HRM_AUTH_001", "INVALID_TOKEN")]
    public async Task AuthenticationErrorsAreClassifiedByValidation(string kind, string code, string error)
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        if (kind != "missing")
        {
            var now = DateTime.UtcNow;
            var key = kind == "expiredWrongSignature" ? Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48)) : app.SigningKey;
            var jwt = new JwtSecurityToken("hrm-test", "hrm-test-client", [new Claim("sub", "api-user")], now.AddMinutes(-10),
                kind.StartsWith("expired") ? now.AddMinutes(-5) : now.AddMinutes(15),
                new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256));
            var token = new JwtSecurityTokenHandler().WriteToken(jwt);
            if (kind == "invalid") token = "invalid.jwt.token";
            if (kind == "tampered")
            {
                var parts = token.Split('.'); parts[1] = Base64UrlEncoder.Encode("{\"sub\":\"admin\",\"hrm_p\":\"all\"}"); token = string.Join('.', parts);
            }
            client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        }
        var response = await client.GetAsync("/__test/permissions");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(code, body.RootElement.GetProperty("code").GetString());
        Assert.Equal(error, body.RootElement.GetProperty("error").GetString());
        Assert.False(body.RootElement.GetProperty("success").GetBoolean());
        Assert.Equal(response.Headers.GetValues("X-Correlation-Id").Single(), body.RootElement.GetProperty("traceId").GetString());
    }

    [Fact]
    public async Task MissingPermissionUsesUniformForbiddenResponse()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        await app.PrepareAsync();
        var login = await client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = app.Password });
        client.DefaultRequestHeaders.Authorization = new("Bearer", (await login.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
        var response = await client.GetAsync("/__test/permissions");
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("HRM_AUTH_003", json.RootElement.GetProperty("code").GetString());
    }

    [Theory]
    [InlineData(200)] [InlineData(401)] [InlineData(403)] [InlineData(500)]
    public async Task AccessLogsUseSafeMetadataAndNeverBodiesOrUntrustedHeaders(int status)
    {
        var context = new DefaultHttpContext(); context.Response.Body = new MemoryStream();
        var secret = "private-password-token-email@example.invalid";
        context.Request.Method = "POST"; context.Request.Path = "/employees/" + secret;
        context.Request.QueryString = new("?password=" + secret);
        context.Request.Headers.Authorization = "Bearer " + secret;
        context.Request.Headers.Cookie = secret; context.Request.Headers["X-Correlation-Id"] = secret;
        context.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(secret));
        context.SetEndpoint(new RouteEndpoint(_ => Task.CompletedTask, RoutePatternFactory.Parse("employees/{id}"), 0,
            EndpointMetadataCollection.Empty, "Employees"));
        var logger = new CapturedLogger();
        var middleware = new ApiAccessLoggingMiddleware(ctx =>
        {
            if (status == 500) throw new InvalidOperationException(secret);
            ctx.Response.StatusCode = status;
            if (status is 401 or 403) ApiErrors.Create(ctx, status == 401 ? "HRM_AUTH_001" : "HRM_AUTH_003", "TEST", "Denied.");
            return Task.CompletedTask;
        }, logger, Options.Create(new ApiAccessLoggingOptions()));
        await middleware.InvokeAsync(context);
        var entry = Assert.Single(logger.Entries);
        Assert.Contains("employees/{id}", entry); Assert.Contains("\"StatusCode\":" + status, entry);
        if (status is 401 or 403) Assert.Contains(status == 401 ? "HRM_AUTH_001" : "HRM_AUTH_003", entry);
        Assert.Contains("anonymous", entry);
        Assert.DoesNotContain(secret, entry); Assert.DoesNotContain(secret, context.TraceIdentifier);
        Assert.Equal(status, context.Response.StatusCode);
        if (status == 500)
        {
            context.Response.Body.Position = 0;
            var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
            Assert.Contains("HRM_API_500", body); Assert.DoesNotContain(secret, body);
        }
    }

    [Fact]
    public async Task SamplingNeverSuppressesDeniedOrFailedRequests()
    {
        var logger = new CapturedLogger();
        var options = Options.Create(new ApiAccessLoggingOptions { SuccessSampleRates = new() { ["/[unmatched]"] = 0 } });
        foreach (var status in new[] { 200, 401, 403, 500 })
        {
            var context = new DefaultHttpContext(); context.Response.Body = new MemoryStream(); context.Request.Path = "/health";
            await new ApiAccessLoggingMiddleware(ctx => { ctx.Response.StatusCode = status; return Task.CompletedTask; }, logger, options).InvokeAsync(context);
        }
        Assert.Equal(3, logger.Entries.Count);
    }

    [Fact]
    public async Task DataScopeErrorsUseDedicatedCode()
    {
        var context = new DefaultHttpContext(); context.Response.Body = new MemoryStream();
        await ApiErrors.DataScopeDeniedAsync(context);
        Assert.Equal(403, context.Response.StatusCode);
        context.Response.Body.Position = 0;
        using var body = await JsonDocument.ParseAsync(context.Response.Body);
        Assert.Equal("HRM_AUTH_004", body.RootElement.GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("{}")] [InlineData("invalid")] [InlineData("{\"EMPLOYEES\":true}")]
    [InlineData("{\"EMPLOYEES\":[\"VIEW\"],\"EMPLOYEES\":[]}")]
    public void MalformedOrEmptyPermissionSnapshotDenies(string value)
    {
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim("hrm_pv", "1"), new Claim("hrm_p", value)], "test"));
        Assert.False(JwtPermissions.HasPermission(principal, "EMPLOYEES", "VIEW"));
    }

    [Fact]
    public void OversizedTokensAreRejectedRatherThanTruncated()
    {
        var options = Options.Create(new JwtOptions { Issuer = "test", Audience = "test", SigningKey = new string('k', 48), MaxTokenBytes = 2048 });
        var profile = new AuthProfileDto(new("test", "unused@example.invalid", null), [], []);
        var permissions = Enumerable.Range(0, 100).ToDictionary(x => "SCREEN_" + x, _ => new[] { "VIEW", "UPDATE", "DELETE", "EXPORT" });
        Assert.Throws<InvalidOperationException>(() => new JwtService(options).Issue(profile, permissions));
    }

    private sealed class CapturedLogger : ILogger<ApiAccessLoggingMiddleware>
    {
        public List<string> Entries { get; } = [];
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            Entries.Add(JsonSerializer.Serialize(((IEnumerable<KeyValuePair<string, object?>>)(object)state!).ToDictionary(x => x.Key, x => x.Value)));
            Assert.Null(exception);
        }
    }
}
