using HRM.API.Common;
using HRM.API.Modules.Authorization.DTOs;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Authorization.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
namespace HRM.API.Modules.Authorization.Controllers;

public abstract class AdministrationController(AdministrationService service) : ControllerBase
{
    protected AdministrationService Service => service;
    protected string Actor => User.FindFirst("sub")?.Value ?? throw new BusinessException(401, "HRM_AUTH_001", "Authentication required.");
    protected string? Match => Request.Headers.IfMatch.ToString();
    protected string Trace => HttpContext.TraceIdentifier;
    protected async Task Current(string screen, string action, CancellationToken ct) => await Service.Demand(Actor, screen, action, ct);
    protected IActionResult Resource(object value, string version) { Response.Headers.ETag = '"' + version + '"'; return Ok(value); }
}
[ApiController, Authorize, Route("api/screens"), ServiceFilter(typeof(BusinessExceptionFilter)), RequestSizeLimit(65536)]
public sealed class ScreensController(AdministrationService service) : AdministrationController(service)
{
    [HttpGet, ScreenPermission(AdministrationService.Permissions, "VIEW")]
    public async Task<IActionResult> List([FromQuery] ScreenCatalogQuery q, CancellationToken ct)
    { await Current(AdministrationService.Permissions, "VIEW", ct); return Ok(await Service.ScreenList(q, ct)); }
    [HttpGet("{id:long}"), ScreenPermission(AdministrationService.Permissions, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct)
    { await Current(AdministrationService.Permissions, "VIEW", ct); var r = await Service.Screen(id, ct); return Resource(r, r.Version); }
    [HttpPost, ScreenPermission(AdministrationService.Permissions, "NEW")]
    public async Task<IActionResult> Create(ScreenRequest r, CancellationToken ct)
    { var result = await Service.SaveScreen(Actor, null, r, null, null, Trace, ct); Response.Headers.ETag = '"' + result.Version + '"'; return CreatedAtAction(nameof(Get), new { id = result.Id }, result); }
    [HttpPut("{id:long}"), ScreenPermission(AdministrationService.Permissions, "UPDATE")]
    public async Task<IActionResult> Update(long id, ScreenRequest r, CancellationToken ct)
    { var result = await Service.SaveScreen(Actor, id, r, null, Match, Trace, ct); return Resource(result, result.Version); }
    [HttpPatch("{id:long}/status"), ScreenPermission(AdministrationService.Permissions, "UPDATE")]
    public async Task<IActionResult> Status(long id, ScreenStatusRequest r, CancellationToken ct)
    { var result = await Service.SaveScreen(Actor, id, null, r.IsActive!.Value, Match, Trace, ct); return Resource(result, result.Version); }
}
[ApiController, Authorize, Route("api/users"), ServiceFilter(typeof(BusinessExceptionFilter)), RequestSizeLimit(65536)]
public sealed class UsersController(AdministrationService service) : AdministrationController(service)
{
    [HttpGet, ScreenPermission(AdministrationService.Users, "VIEW")]
    public async Task<IActionResult> List([FromQuery] PageQuery q, CancellationToken ct)
    { await Current(AdministrationService.Users, "VIEW", ct); return Ok(await Service.UserList(q, null, ct)); }
    [HttpGet("{userId}"), ScreenPermission(AdministrationService.Users, "VIEW")]
    public async Task<IActionResult> Get(string userId, CancellationToken ct)
    { await Current(AdministrationService.Users, "VIEW", ct); var r = await Service.User(userId, ct); return Resource(r, r.Version); }
    [HttpPost, ScreenPermission(AdministrationService.Users, "NEW")]
    public async Task<IActionResult> Create(UserCreateRequest r, CancellationToken ct)
    { var result = await Service.CreateUser(Actor, r, Trace, ct); Response.Headers.ETag = '"' + result.Version + '"'; return CreatedAtAction(nameof(Get), new { userId = result.UserId }, result); }
    [HttpPut("{userId}"), ScreenPermission(AdministrationService.Users, "UPDATE")]
    public async Task<IActionResult> Update(string userId, UserUpdateRequest r, CancellationToken ct)
    { var result = await Service.ChangeUser(Actor, userId, r, Match, Trace, ct); return Resource(result, result.Version); }
    [HttpPatch("{userId}/status"), ScreenPermission(AdministrationService.Users, "UPDATE")]
    public async Task<IActionResult> Status(string userId, UserStatusRequest r, CancellationToken ct)
    { var result = await Service.ChangeUser(Actor, userId, r, Match, Trace, ct); return Resource(result, result.Version); }
    [HttpPost("{userId}/reset-password"), ScreenPermission(AdministrationService.Users, "APPROVE"), EnableRateLimiting("AdministrationReset")]
    public async Task<IActionResult> Reset(string userId, ResetPasswordRequest r, CancellationToken ct)
    { var result = await Service.ChangeUser(Actor, userId, r, Match, Trace, ct); return Resource(result, result.Version); }
    [HttpPut("{userId}/roles"), ScreenPermission(AdministrationService.Users, "APPROVE")]
    public async Task<IActionResult> Roles(string userId, UserRolesRequest r, CancellationToken ct)
    { var result = await Service.ChangeUser(Actor, userId, r, Match, Trace, ct); return Resource(result, result.Version); }
}
[ApiController, Authorize, Route("api/roles"), ServiceFilter(typeof(BusinessExceptionFilter)), RequestSizeLimit(65536)]
public sealed class RolesController(AdministrationService service) : AdministrationController(service)
{
    [HttpGet, ScreenPermission(AdministrationService.Roles, "VIEW")]
    public async Task<IActionResult> List([FromQuery] PageQuery q, CancellationToken ct)
    { await Current(AdministrationService.Roles, "VIEW", ct); return Ok(await Service.RoleList(q, ct)); }
    [HttpGet("{id:long}"), ScreenPermission(AdministrationService.Roles, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct)
    { await Current(AdministrationService.Roles, "VIEW", ct); var r = await Service.Role(id, ct); return Resource(r, r.Version); }
    [HttpPost, ScreenPermission(AdministrationService.Roles, "NEW")]
    public async Task<IActionResult> Create(RoleRequest r, CancellationToken ct)
    { var result = (await Service.SaveRole(Actor, null, r, null, Trace, ct))!; Response.Headers.ETag = '"' + result.Version + '"'; return CreatedAtAction(nameof(Get), new { id = result.Id }, result); }
    [HttpPut("{id:long}"), ScreenPermission(AdministrationService.Roles, "UPDATE")]
    public async Task<IActionResult> Update(long id, RoleRequest r, CancellationToken ct)
    { var result = (await Service.SaveRole(Actor, id, r, Match, Trace, ct))!; return Resource(result, result.Version); }
    [HttpDelete("{id:long}"), ScreenPermission(AdministrationService.Roles, "DELETE")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct)
    { await Service.SaveRole(Actor, id, null, Match, Trace, ct); return NoContent(); }
    [HttpGet("{id:long}/users"), ScreenPermission(AdministrationService.Roles, "VIEW"), ScreenPermission(AdministrationService.Users, "VIEW")]
    public async Task<IActionResult> Users(long id, [FromQuery] PageQuery q, CancellationToken ct)
    { await Current(AdministrationService.Roles, "VIEW", ct); await Current(AdministrationService.Users, "VIEW", ct); return Ok(await Service.UserList(q, id, ct)); }
    [HttpGet("{id:long}/permissions"), ScreenPermission(AdministrationService.Permissions, "VIEW")]
    public async Task<IActionResult> Permissions(long id, CancellationToken ct)
    { await Current(AdministrationService.Permissions, "VIEW", ct); var r = await Service.Matrix(id, ct); return Resource(r, r.Version); }
    [HttpPut("{id:long}/permissions"), ScreenPermission(AdministrationService.Permissions, "UPDATE"), ScreenPermission(AdministrationService.Permissions, "APPROVE")]
    public async Task<IActionResult> UpdatePermissions(long id, PermissionMatrixRequest r, CancellationToken ct)
    { var result = await Service.SaveMatrix(Actor, id, r, Match, Trace, ct); return Resource(result, result.Version); }
}
[ApiController, Authorize, Route("api/authorization/actions"), ServiceFilter(typeof(BusinessExceptionFilter)), RequestSizeLimit(65536)]
public sealed class AuthorizationActionsController(AdministrationService service) : AdministrationController(service)
{
    [HttpGet, ScreenPermission(AdministrationService.Permissions, "VIEW")]
    public async Task<IActionResult> Get(CancellationToken ct)
    { await Current(AdministrationService.Permissions, "VIEW", ct); return Ok(AdministrationService.Actions()); }
}
