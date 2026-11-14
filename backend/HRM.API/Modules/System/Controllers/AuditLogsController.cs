using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.System.Controllers;

[ApiController, Authorize, Route("api/audit-logs"), ServiceFilter(typeof(BusinessExceptionFilter))]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuditLogsController(AuditLogService service) : ControllerBase
{
    private string Actor => User.FindFirst("sub")!.Value;
    [HttpGet, ScreenPermission(AuditLogService.Screen, "VIEW")]
    public async Task<IActionResult> List([FromQuery] AuditLogQuery query, CancellationToken ct) => Ok(await service.List(Actor, query, ct));
    [HttpGet("{id:long}"), ScreenPermission(AuditLogService.Screen, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) => Ok(await service.Get(Actor, id, ct));
}
