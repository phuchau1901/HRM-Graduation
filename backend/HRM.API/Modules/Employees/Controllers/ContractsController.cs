using System.IdentityModel.Tokens.Jwt;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Employees.Controllers;

[ApiController, Authorize, Route("api/contracts"), ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ContractsController(ContractStatisticsService service, EmployeeService employees) : ControllerBase
{
    [HttpPost, ScreenPermission("WEB_CONTRACTS", "NEW")]
    public async Task<IActionResult> Create(ContractCreateRequest request, CancellationToken ct)
    {
        var result = await employees.SaveContractAsync(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value, request.EmployeeId, null, request, HttpContext.TraceIdentifier, ct);
        return CreatedAtAction(nameof(EmployeeContractsController.Get), "EmployeeContracts", new { employeeId = result.EmployeeId, id = result.Id }, result);
    }
    [HttpGet("statistics"), ScreenPermission("WEB_CONTRACTS", "VIEW")]
    public async Task<IActionResult> Statistics([FromQuery] ContractStatisticsQuery query, CancellationToken ct) =>
        Ok(await service.GetAsync(User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value, query, ct));
}
