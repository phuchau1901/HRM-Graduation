using System.IdentityModel.Tokens.Jwt;
using HRM.API.Common;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Organization.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Organization.Controllers;

[ApiController, Authorize, ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrganizationController(OrganizationTreeService service) : ControllerBase
{
    private string Actor => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
    [HttpGet("api/organization/tree"), ScreenPermission("WEB_ORGANIZATION", "VIEW")]
    public async Task<IActionResult> Tree(CancellationToken ct) => Ok(await service.TreeAsync(Actor, ct));

    [HttpGet("api/teams/{teamId:int}/members"), ScreenPermission("WEB_ORGANIZATION", "VIEW"), ScreenPermission("WEB_EMPLOYEES", "VIEW")]
    public async Task<IActionResult> Members(int teamId, [FromQuery] OrganizationMembersQuery q, CancellationToken ct) => Ok(await service.MembersAsync(Actor, teamId, null, q, ct));

    [HttpGet("api/departments/{departmentId:int}/unassigned-members"), ScreenPermission("WEB_ORGANIZATION", "VIEW"), ScreenPermission("WEB_EMPLOYEES", "VIEW")]
    public async Task<IActionResult> Unassigned(int departmentId, [FromQuery] OrganizationMembersQuery q, CancellationToken ct) => Ok(await service.MembersAsync(Actor, null, departmentId, q, ct));
}
