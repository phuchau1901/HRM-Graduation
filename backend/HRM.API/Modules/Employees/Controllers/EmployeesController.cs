using System.IdentityModel.Tokens.Jwt;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Employees.Controllers;
[ApiController, Authorize, Route("api/employees"), ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class EmployeesController(EmployeeService service) : ControllerBase
{
    private string Actor => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
    [HttpGet, ScreenPermission("WEB_EMPLOYEES", "VIEW")]
    public async Task<IActionResult> List([FromQuery] EmployeeQuery q, CancellationToken ct) => Ok(await service.ListAsync(Actor, q, ct));
    [HttpGet("{id:int}"), ScreenPermission("WEB_EMPLOYEES", "VIEW")]
    public async Task<IActionResult> Get(int id, CancellationToken ct) => Ok(await service.GetAsync(Actor, id, ct));
    [HttpPost, ScreenPermission("WEB_EMPLOYEES", "NEW")]
    public async Task<IActionResult> Create(EmployeeCreateRequest request, CancellationToken ct)
    {
        var result = await service.CreateAsync(Actor, request, HttpContext.TraceIdentifier, ct);
        return CreatedAtAction(nameof(Get), new { id = result.Id }, result);
    }
    [HttpPut("{id:int}"), ScreenPermission("WEB_EMPLOYEES", "UPDATE")]
    public async Task<IActionResult> Update(int id, EmployeeProfileRequest request, CancellationToken ct) =>
        Ok(await service.UpdateAsync(Actor, id, request, HttpContext.TraceIdentifier, ct));
    [HttpDelete("{id:int}"), ScreenPermission("WEB_EMPLOYEES", "DELETE")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken ct)
    {
        await service.DeactivateAsync(Actor, id, HttpContext.TraceIdentifier, ct); return NoContent();
    }
    [HttpPatch("{id:int}/department"), ScreenPermission("WEB_EMPLOYEES", "UPDATE")]
    public async Task<IActionResult> Transfer(int id, DepartmentTransferRequest request, CancellationToken ct) =>
        Ok(await service.TransferAsync(Actor, id, request, HttpContext.TraceIdentifier, ct));
    [HttpGet("{id:int}/history"), ScreenPermission("WEB_EMPLOYEES", "VIEW")]
    public async Task<IActionResult> History(int id, [FromQuery] PageQuery q, CancellationToken ct) => Ok(await service.HistoryAsync(Actor, id, q, ct));
}
