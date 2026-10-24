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
        Assert.Equal(31, routes.Length); Assert.Equal(routes.Length, routes.Distinct(StringComparer.OrdinalIgnoreCase).Count());
        var business = actions.Where(x => x.ControllerTypeInfo.Namespace!.Contains(".Organization.") || x.ControllerTypeInfo.Namespace!.Contains(".Employees.")).ToArray();
        Assert.Equal(21, business.Length);
        Assert.All(business, action =>
        {
            Assert.Contains(action.ControllerTypeInfo.GetCustomAttributes(true), x => x is AuthorizeAttribute);
            Assert.Contains(action.MethodInfo.GetCustomAttributes(true), x => x is ScreenPermissionAttribute);
            Assert.DoesNotContain(action.MethodInfo.GetCustomAttributes(true), x => x is AllowAnonymousAttribute);
        });
    }
}
