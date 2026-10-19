using System.IdentityModel.Tokens.Jwt;
using HRM.API.Modules.Authorization.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace HRM.API.Modules.Authorization.Policies;

// Keep the typed attribute usable by existing endpoints while exposing the requested string API.
public enum ScreenAction { New, View, Update, Delete, Approve, Export }
public sealed record ScreenPermissionRequirement(string ScreenCode, string Action) : IAuthorizationRequirement
{
    public ScreenPermissionRequirement(string screenCode, ScreenAction action) : this(screenCode, action.ToString()) { }
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public class ScreenPermissionAttribute : AuthorizeAttribute
{
    public string ScreenCode { get; }
    public string ActionCode { get; }
    public ScreenPermissionAttribute(string screenCode, string action)
    {
        var operation = PermissionActions.Normalize(action);
        if (string.IsNullOrWhiteSpace(screenCode) || screenCode.Length > 100 || screenCode.Contains(':') || operation is null)
            throw new ArgumentException("A valid screen code and registered action code are required.");
        ScreenCode = screenCode;
        ActionCode = operation;
        Policy = $"HRM.Screen:{screenCode}:{operation}";
    }
}

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireScreenPermissionAttribute : ScreenPermissionAttribute
{
    public RequireScreenPermissionAttribute(string screenCode, ScreenAction action) : base(screenCode, action.ToString()) { }
}

public sealed class ScreenPermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public override Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith("HRM.Screen:", StringComparison.Ordinal)) return base.GetPolicyAsync(policyName);
        var policy = new AuthorizationPolicyBuilder(JwtBearerDefaults.AuthenticationScheme).RequireAuthenticatedUser();
        var parts = policyName.Split(':');
        var action = parts.Length == 3 ? PermissionActions.Normalize(parts[2]) : null;
        if (parts.Length == 3 && !string.IsNullOrWhiteSpace(parts[1]) && parts[1].Length <= 100 && action is not null)
            policy.AddRequirements(new ScreenPermissionRequirement(parts[1], action));
        else
            policy.RequireAssertion(_ => false);
        return Task.FromResult<AuthorizationPolicy?>(policy.Build());
    }
}

public sealed class ScreenPermissionHandler : AuthorizationHandler<ScreenPermissionRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, ScreenPermissionRequirement requirement)
    {
        if (HRM.API.Security.JwtPermissions.HasPermission(context.User, requirement.ScreenCode, requirement.Action))
            context.Succeed(requirement);
        return Task.CompletedTask;
    }
}
