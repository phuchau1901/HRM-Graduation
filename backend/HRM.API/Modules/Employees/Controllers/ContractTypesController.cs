using System.IdentityModel.Tokens.Jwt;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Employees.Controllers;

[ApiController, Authorize, Route("api/contract-types"), ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ContractTypesController(ContractTypeService service) : ControllerBase
{
    private string Actor => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
    [HttpGet, ScreenPermission("WEB_CONTRACTS", "VIEW")]
    public async Task<IActionResult> List([FromQuery] ContractTypeQuery q, CancellationToken ct) => Ok(await service.ListAsync(q, ct));
    [HttpGet("{code}"), ScreenPermission("WEB_CONTRACTS", "VIEW")]
    public async Task<IActionResult> Get(string code, CancellationToken ct) => Ok(await service.GetAsync(code, ct));
    [HttpPost, ScreenPermission("WEB_CONTRACTS", "NEW")]
    public async Task<IActionResult> Create(ContractTypeRequest request, CancellationToken ct)
    {
        var type = await service.SaveAsync(Actor, null, request, ct);
        return CreatedAtAction(nameof(Get), new { code = type.Code }, type);
    }
    [HttpPut("{code}"), ScreenPermission("WEB_CONTRACTS", "UPDATE")]
    public async Task<IActionResult> Update(string code, ContractTypeUpdateRequest request, CancellationToken ct) => Ok(await service.SaveAsync(Actor, code, request, ct));
    [HttpDelete("{code}"), ScreenPermission("WEB_CONTRACTS", "DELETE")]
    public async Task<IActionResult> Delete(string code, CancellationToken ct) { await service.DeleteAsync(Actor, code, ct); return NoContent(); }
}
