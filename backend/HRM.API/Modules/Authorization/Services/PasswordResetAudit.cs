using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Authorization.Services;

// Only safe metadata is accepted here. Never serialize the request or any credential.
internal static class PasswordResetAudit
{
    internal const string TypeKey = "PasswordReset.Type";
    internal static AuditLog Create(string actor, string target, string type, string result, string trace)
    {
        var timestamp = DateTime.UtcNow;
        return new AuditLog
        {
            ActorUserID = actor, Action = "PASSWORD_RESET", EntityType = "User",
            EntityID = target.Length <= 60 ? target : AdministrationService.Version(target)[..60], CreatedAt = timestamp,
            AfterJSON = JsonSerializer.Serialize(new { actorUserId = actor, targetUserId = target, type, timestamp, result, traceId = trace })
        };
    }
    internal static async Task Failure(HttpContext context, int status)
    {
        var actor = context.User.FindFirst("sub")?.Value;
        var target = context.Request.RouteValues["userId"]?.ToString();
        if (actor is null || target is null) return;
        var type = context.Items[TypeKey] as string ?? "UNKNOWN";
        var result = status switch { 400 => "VALIDATION_FAILED", 401 => "AUTHENTICATION_FAILED", 403 => "PERMISSION_DENIED", 404 => "NOT_FOUND", 429 => "RATE_LIMITED", _ => "FAILED" };
        try
        {
            // A fresh context records failure only after the credential transaction has rolled back.
            using var scope = context.RequestServices.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var audit = Create(actor, target, type, result, context.TraceIdentifier);
            if (!await db.Set<User>().AnyAsync(x => x.UserId == actor)) audit.ActorUserID = null;
            db.Add(audit); await db.SaveChangesAsync();
        }
        catch (Exception)
        {
            context.RequestServices.GetRequiredService<ILogger<PasswordResetAuditFilter>>()
                .LogError("Unable to persist password reset failure audit. TraceId: {TraceId}", context.TraceIdentifier);
        }
    }
}

public sealed class PasswordResetAuditFilter : IAsyncResourceFilter, IAsyncActionFilter, IOrderedFilter
{
    public int Order => int.MinValue;
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (context.ActionArguments.Values.OfType<ResetPasswordRequest>().FirstOrDefault() is { } request)
            context.HttpContext.Items[PasswordResetAudit.TypeKey] = PasswordResetTypes.IsSupported(request.Type) ? request.Type : "INVALID";
        await next();
    }
    public async Task OnResourceExecutionAsync(ResourceExecutingContext context, ResourceExecutionDelegate next)
    {
        var result = await next();
        var status = result.Exception is not null && !result.ExceptionHandled ? 500 : context.HttpContext.Response.StatusCode;
        if (status >= 400) await PasswordResetAudit.Failure(context.HttpContext, status);
    }
}
