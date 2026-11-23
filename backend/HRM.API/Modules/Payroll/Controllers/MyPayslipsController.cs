using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Payroll.Controllers;
[ApiController,Authorize,ServiceFilter(typeof(BusinessExceptionFilter)),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/payslips/me")]
public sealed class MyPayslipsController(PayrollService service):ControllerBase {
 private string Actor=>User.FindFirst("sub")!.Value;
 [HttpGet(""),ScreenPermission(PayrollScreens.Mine,"VIEW")]
 public async Task<IActionResult> Payslips([FromQuery]PayrollQuery q,CancellationToken ct)=>Ok(await service.Payslips(Actor,q,true,ct));
 [HttpGet("{id:long}"),ScreenPermission(PayrollScreens.Mine,"VIEW")]
 public async Task<IActionResult> Detail(long id,CancellationToken ct)=>Ok(new{success=true,data=await service.Detail(Actor,id,true,ct)});
 [HttpGet("{id:long}/pdf"),ScreenPermission(PayrollScreens.Mine,"EXPORT")]
 public async Task<IActionResult> Pdf(long id,CancellationToken ct)=>File(await service.Pdf(Actor,id,ct),"application/pdf","payslip.pdf");
}
