using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Organization.DTOs;
using HRM.API.Modules.Organization.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Organization.Controllers;
[ApiController, Authorize, Route("api/departments"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class DepartmentsController(OrganizationService service) : ControllerBase
{
    [HttpGet, ScreenPermission("WEB_DEPARTMENTS", "VIEW")]
    public async Task<IActionResult> List([FromQuery] OrganizationQuery query, CancellationToken ct) => Ok(await service.DepartmentsAsync(query, ct));
    [HttpGet("{id:int}"), ScreenPermission("WEB_DEPARTMENTS", "VIEW")]
    public async Task<IActionResult> Get(int id, CancellationToken ct) => Ok(await service.DepartmentAsync(id, ct));
    [HttpPost, ScreenPermission("WEB_DEPARTMENTS", "NEW")]
    public async Task<IActionResult> Create(DepartmentRequest request, CancellationToken ct)
    {
        var result = await service.SaveDepartmentAsync(null, request, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }
    [HttpPut("{id:int}"), ScreenPermission("WEB_DEPARTMENTS", "UPDATE")]
    public async Task<IActionResult> Update(int id, DepartmentRequest request, CancellationToken ct) => Ok(await service.SaveDepartmentAsync(id, request, ct));
    [HttpDelete("{id:int}"), ScreenPermission("WEB_DEPARTMENTS", "DELETE")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct) { await service.DeleteDepartmentAsync(id, ct); return NoContent(); }
}
