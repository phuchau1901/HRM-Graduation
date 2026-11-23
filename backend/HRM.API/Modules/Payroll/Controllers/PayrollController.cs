using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Payroll.Controllers;
[ApiController,Authorize,ServiceFilter(typeof(BusinessExceptionFilter)),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/payroll")]
public sealed class PayrollController(PayrollService service):ControllerBase {
 private string Actor=>User.FindFirst("sub")!.Value;
 [HttpGet("employees"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Employees([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Employees(Actor,q,ct,false));
 [HttpGet("policies"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Policies([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Policies(Actor,q,ct,true));
 [HttpGet("timesheets"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Timesheets([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Timesheets(Actor,q,ct));
 [HttpPost("timesheets"),ScreenPermission(PayrollScreens.Payroll,"NEW")]
 public async Task<IActionResult> CreateTimesheet(TimesheetCreateRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.CreateTimesheet(Actor,r,ct)});
 [HttpPost("timesheets/{id:long}/calculate"),ScreenPermission(PayrollScreens.Payroll,"UPDATE")]
 public async Task<IActionResult> CalculateTimesheet(long id,PayrollCalculationRequest r,CancellationToken ct)=>Ok(await service.CalculateTimesheet(Actor,id,r,ct));
 [HttpPost("timesheets/{id:long}/lock"),ScreenPermission(PayrollScreens.Payroll,"APPROVE")]
 public async Task<IActionResult> LockTimesheet(long id,PayrollVersion r,CancellationToken ct)=>Ok(new{success=true,data=await service.LockTimesheet(Actor,id,r,ct)});
 [HttpGet("periods"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Periods([FromQuery]PayrollQuery q,CancellationToken ct)=>Ok(await service.Periods(Actor,q,ct));
 [HttpPost("periods"),ScreenPermission(PayrollScreens.Payroll,"NEW")]
 public async Task<IActionResult> CreatePeriod(PayrollCreateRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.CreatePeriod(Actor,r,ct)});
 [HttpPost("periods/{id:long}/calculate"),ScreenPermission(PayrollScreens.Payroll,"UPDATE")]
 public async Task<IActionResult> Calculate(long id,PayrollCalculationRequest r,CancellationToken ct)=>Ok(await service.Calculate(Actor,id,r,ct));
 [HttpPost("periods/{id:long}/submit"),ScreenPermission(PayrollScreens.Payroll,"UPDATE")]
 public async Task<IActionResult> Submit(long id,PayrollVersion r,CancellationToken ct)=>Ok(new{success=true,data=await service.Submit(Actor,id,r,ct)});
 [HttpPost("periods/{id:long}/lock"),ScreenPermission(PayrollScreens.Payroll,"APPROVE")]
 public async Task<IActionResult> Lock(long id,PayrollVersion r,CancellationToken ct)=>Ok(new{success=true,data=await service.Lock(Actor,id,r,ct)});
 [HttpPost("periods/{id:long}/paid"),ScreenPermission(PayrollScreens.Payroll,"APPROVE")]
 public async Task<IActionResult> Paid(long id,PayrollPaymentRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.Paid(Actor,id,r,ct)});
 [HttpPost("periods/{id:long}/adjustments"),ScreenPermission(PayrollScreens.Payroll,"UPDATE")]
 public async Task<IActionResult> Adjustment(long id,PayrollAdjustmentRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.Adjustment(Actor,id,r,ct)});
 [HttpGet("payslips"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Payslips([FromQuery]PayrollQuery q,CancellationToken ct)=>Ok(await service.Payslips(Actor,q,false,ct));
 [HttpGet("payslips/{id:long}"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Detail(long id,CancellationToken ct)=>Ok(new{success=true,data=await service.Detail(Actor,id,false,ct)});
 [HttpGet("statistics"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Statistics([FromQuery]PayrollQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Statistics(Actor,q,ct)});
 [HttpGet("export"),ScreenPermission(PayrollScreens.Payroll,"EXPORT")]
 public async Task<IActionResult> Export([FromQuery]PayrollQuery q,CancellationToken ct)=>File(await service.Export(Actor,q,ct),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","payroll.xlsx");
 [HttpGet("lookups"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Lookups(CancellationToken ct)=>Ok(await service.Lookups(Actor,false,ct));
 [HttpGet("timesheets/{id:long}"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> TimesheetDetails(long id,CancellationToken ct)=>Ok(new{success=true,data=await service.TimesheetDetails(Actor,id,ct)});
 [HttpGet("periods/{id:long}/adjustments"),ScreenPermission(PayrollScreens.Payroll,"VIEW")]
 public async Task<IActionResult> Adjustments(long id,CancellationToken ct)=>Ok(new{success=true,data=await service.Adjustments(Actor,id,ct)});
 [HttpPost("periods/{id:long}/adjustments/{adjustmentId:long}/cancel"),ScreenPermission(PayrollScreens.Payroll,"UPDATE")]
 public async Task<IActionResult> CancelAdjustment(long id,long adjustmentId,PayrollVersion r,CancellationToken ct)=>Ok(new{success=true,data=await service.CancelAdjustment(Actor,id,adjustmentId,r,ct)});
}
