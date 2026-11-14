using System.IdentityModel.Tokens.Jwt;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Organization.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Organization.Controllers;

[ApiController, Authorize, Route("api/teams"), ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TeamsController(TeamService service) : ControllerBase
{
    private string Actor => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
    [HttpGet, ScreenPermission("WEB_TEAMS", "VIEW")]
    public async Task<IActionResult> List([FromQuery] TeamQuery q, CancellationToken ct) => Ok(await service.ListAsync(q, ct));
    [HttpGet("{id:int}"), ScreenPermission("WEB_TEAMS", "VIEW")]
    public async Task<IActionResult> Get(int id, CancellationToken ct) => Ok(await service.GetAsync(id, ct));
    [HttpPost, ScreenPermission("WEB_TEAMS", "NEW")]
    public async Task<IActionResult> Create(TeamRequest request, CancellationToken ct)
    {
        var result = await service.SaveAsync(Actor, null, request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }
    [HttpPut("{id:int}"), ScreenPermission("WEB_TEAMS", "UPDATE")]
    public async Task<IActionResult> Update(int id, TeamRequest request, CancellationToken ct) => Ok(await service.SaveAsync(Actor, id, request, ct));
    [HttpDelete("{id:int}"), ScreenPermission("WEB_TEAMS", "DELETE")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) { await service.DeleteAsync(Actor, id, ct); return NoContent(); }
}
