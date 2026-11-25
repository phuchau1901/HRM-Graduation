using HRM.API.Modules.Authorization.Policies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using Microsoft.AspNetCore.Mvc.ActionConstraints;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class ApiInventoryTests
{
    [Fact]
    public void ProductionRoutesAreUniqueAndEveryOrganizationEmployeeActionRequiresJwtAndPermission()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        var actions = app.Services.GetRequiredService<IActionDescriptorCollectionProvider>().ActionDescriptors.Items
            .OfType<ControllerActionDescriptor>().Where(x => x.ControllerTypeInfo.Namespace?.StartsWith("HRM.API.Modules.") == true).ToArray();
        var routes = actions.SelectMany(x => x.ActionConstraints!.OfType<HttpMethodActionConstraint>()
            .SelectMany(c => c.HttpMethods.Select(method => method + " " + x.AttributeRouteInfo!.Template))).ToArray();
        Assert.Equal(211, routes.Length); Assert.Equal(routes.Length, routes.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        var business = actions.Where(x => x.ControllerTypeInfo.Namespace!.Contains(".Dashboard.") || x.ControllerTypeInfo.Namespace!.Contains(".Payroll.") || x.ControllerTypeInfo.Namespace!.Contains(".Performance.") || x.ControllerTypeInfo.Namespace!.Contains(".Approvals.") || x.ControllerTypeInfo.Namespace!.Contains(".Leave.") || x.ControllerTypeInfo.Namespace!.Contains(".Organization.") || x.ControllerTypeInfo.Namespace!.Contains(".Employees.") || x.ControllerTypeInfo.Namespace!.Contains(".Authorization.") || x.ControllerTypeInfo.Namespace!.Contains(".System.") || x.ControllerTypeInfo.Namespace!.Contains(".Work.") || x.ControllerTypeInfo.Namespace!.Contains(".Attendance.")).ToArray();
        Assert.Equal(201, business.Length);
        Assert.All(business, action =>
        {
            Assert.Contains(action.ControllerTypeInfo.GetCustomAttributes(true), x => x is AuthorizeAttribute);
            if (action.AttributeRouteInfo!.Template == "api/users/{userId}/reset-password")
            {
                // Conditional authorization: SELF_CHANGE has no screen grant; ADMIN_RESET checks live UPDATE in the service.
                Assert.Contains(action.MethodInfo.GetCustomAttributes(true), x => x is Microsoft.AspNetCore.RateLimiting.EnableRateLimitingAttribute);
                Assert.Contains(action.MethodInfo.GetCustomAttributes(true), x => x is Microsoft.AspNetCore.Mvc.ServiceFilterAttribute filter && filter.ServiceType == typeof(HRM.API.Modules.Authorization.Services.PasswordResetAuditFilter));
            }
            else if (action.AttributeRouteInfo!.Template == "api/system-settings/terminal-logging/me")
                Assert.DoesNotContain(action.MethodInfo.GetCustomAttributes(true), x => x is ScreenPermissionAttribute);
            else if (action.AttributeRouteInfo!.Template == "api/system-settings/password-policy" && action.MethodInfo.GetCustomAttributes(true).Any(x => x is Microsoft.AspNetCore.Mvc.HttpGetAttribute))
                Assert.DoesNotContain(action.MethodInfo.GetCustomAttributes(true), x => x is ScreenPermissionAttribute);
            else if (action.AttributeRouteInfo!.Template is "api/dashboard/summary" or "api/dashboard/my-overview")
                Assert.DoesNotContain(action.MethodInfo.GetCustomAttributes(true), x => x is ScreenPermissionAttribute);
            else Assert.Contains(action.MethodInfo.GetCustomAttributes(true), x => x is ScreenPermissionAttribute);
            Assert.DoesNotContain(action.MethodInfo.GetCustomAttributes(true), x => x is AllowAnonymousAttribute);
        });
    }
}
