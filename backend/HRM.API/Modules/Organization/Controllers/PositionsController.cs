using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Organization.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Organization.Controllers;
[ApiController, Authorize, Route("api/positions"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class PositionsController(OrganizationService service) : ControllerBase
{
    [HttpGet, ScreenPermission("WEB_POSITIONS", "VIEW")]
    public async Task<IActionResult> List([FromQuery] OrganizationQuery query, CancellationToken ct) => Ok(await service.PositionsAsync(query, ct));
    [HttpGet("{id:long}"), ScreenPermission("WEB_POSITIONS", "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) => Ok(await service.PositionAsync(id, ct));
    [HttpPost, ScreenPermission("WEB_POSITIONS", "NEW")]
    public async Task<IActionResult> Create(PositionRequest request, CancellationToken ct)
    {
        var result = await service.SavePositionAsync(null, request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }
    [HttpPut("{id:long}"), ScreenPermission("WEB_POSITIONS", "UPDATE")]
    public async Task<IActionResult> Update(long id, PositionRequest request, CancellationToken ct) => Ok(await service.SavePositionAsync(id, request, ct));
    [HttpDelete("{id:long}"), ScreenPermission("WEB_POSITIONS", "DELETE")]
    public async Task<IActionResult> Delete(long id, CancellationToken ct) { await service.DeletePositionAsync(id, ct); return NoContent(); }
}
