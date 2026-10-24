using System.IdentityModel.Tokens.Jwt;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Employees.Controllers;
[ApiController, Authorize, Route("api/employees/{employeeId:int}/contracts"), ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class EmployeeContractsController(EmployeeService service) : ControllerBase
{
    private string Actor => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
    [HttpGet, ScreenPermission("WEB_CONTRACTS", "VIEW")]
    public async Task<IActionResult> List(int employeeId, [FromQuery] PageQuery q, CancellationToken ct) => Ok(await service.ContractsAsync(Actor, employeeId, q, ct));
    [HttpGet("{id:long}"), ScreenPermission("WEB_CONTRACTS", "VIEW")]
    public async Task<IActionResult> Get(int employeeId, long id, CancellationToken ct) => Ok(await service.ContractAsync(Actor, employeeId, id, ct));
    [HttpPost, ScreenPermission("WEB_CONTRACTS", "NEW")]
    public async Task<IActionResult> Create(int employeeId, ContractRequest request, CancellationToken ct)
    {
        var result = await service.SaveContractAsync(Actor, employeeId, null, request, HttpContext.TraceIdentifier, ct);
        return CreatedAtAction(nameof(Get), new { employeeId, id = result.Id }, result);
    }
    [HttpPut("{id:long}"), ScreenPermission("WEB_CONTRACTS", "UPDATE")]
    public async Task<IActionResult> Update(int employeeId, long id, ContractRequest request, CancellationToken ct) =>
        Ok(await service.SaveContractAsync(Actor, employeeId, id, request, HttpContext.TraceIdentifier, ct));
}
