using System.IdentityModel.Tokens.Jwt;
using HRM.API.Modules.Auth.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace HRM.API.Modules.Authorization.Policies;

public enum ScreenAction { New, View, Update, Delete, Approve, Export }
public sealed record ScreenPermissionRequirement(string ScreenCode, ScreenAction Action) : IAuthorizationRequirement;

[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method, AllowMultiple = true)]
public sealed class RequireScreenPermissionAttribute : AuthorizeAttribute
{
    public RequireScreenPermissionAttribute(string screenCode, ScreenAction action)
    {
        if (string.IsNullOrWhiteSpace(screenCode) || screenCode.Contains(':') || !Enum.IsDefined(action))
            throw new ArgumentException("A screen code and valid action are required.");
        Policy = $"HRM.Screen:{screenCode}:{action}";
    }
}

public sealed class ScreenPermissionPolicyProvider(IOptions<AuthorizationOptions> options) : DefaultAuthorizationPolicyProvider(options)
{
    public override Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        var parts = policyName.Split(':');
        if (parts.Length == 3 && parts[0] == "HRM.Screen" && !string.IsNullOrWhiteSpace(parts[1]) &&
            Enum.TryParse<ScreenAction>(parts[2], out var action) && Enum.IsDefined(action))
            return Task.FromResult<AuthorizationPolicy?>(new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser().AddRequirements(new ScreenPermissionRequirement(parts[1], action)).Build());
        return base.GetPolicyAsync(policyName);
    }
}

public sealed class ScreenPermissionHandler(AuthProfileService profiles, IHttpContextAccessor accessor)
    : AuthorizationHandler<ScreenPermissionRequirement>
{
    protected override async Task HandleRequirementAsync(AuthorizationHandlerContext context, ScreenPermissionRequirement requirement)
    {
        var userId = context.User.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
        if (context.User.Identity?.IsAuthenticated != true || string.IsNullOrWhiteSpace(userId) || userId.Length > 100) return;
        var profile = await profiles.GetAsync(userId, accessor.HttpContext?.RequestAborted ?? default);
        var permission = profile?.Permissions.SingleOrDefault(x => x.Code == requirement.ScreenCode);
        if (permission is null) return;
        var flag = requirement.Action switch
        {
            ScreenAction.New => permission.CanNew, ScreenAction.View => permission.CanView,
            ScreenAction.Update => permission.CanUpdate, ScreenAction.Delete => permission.CanDelete,
            ScreenAction.Approve => permission.CanApprove, ScreenAction.Export => permission.CanExport,
            _ => "N"
        };
        if (flag == "Y") context.Succeed(requirement);
    }
}
