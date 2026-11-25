using HRM.API.Common;
using HRM.API.Modules.Dashboard.DTOs;
using HRM.API.Modules.Dashboard.Services;
using HRM.API.Modules.Authorization.Policies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Dashboard.Controllers;
[ApiController,Authorize,Route("api/dashboard"),ServiceFilter(typeof(BusinessExceptionFilter)),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
public sealed class DashboardController(DashboardService service):ControllerBase {
 private string Actor=>User.FindFirst("sub")!.Value;
 // Composite/personal responses enforce live source permissions in the service; no implicit admin role.
 [HttpGet("summary")] public async Task<IActionResult> Summary([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Summary(Actor,q,ct)});
 [HttpGet("attendance-trend"),ScreenPermission("WEB_ATTENDANCE","VIEW")] public async Task<IActionResult> Attendance([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.AttendanceTrend(Actor,q,ct)});
 [HttpGet("department-distribution"),ScreenPermission("WEB_EMPLOYEES","VIEW")] public async Task<IActionResult> Departments([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Departments(Actor,q,ct)});
 [HttpGet("pending-tasks"),ScreenPermission("WEB_APPROVALS","VIEW")] public async Task<IActionResult> Pending([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Pending(Actor,q,ct)});
 [HttpGet("kpi-overview"),ScreenPermission("WEB_KPI_EVALUATION","VIEW")] public async Task<IActionResult> Kpi([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Kpi(Actor,q,ct)});
 [HttpGet("payroll-overview"),ScreenPermission("WEB_PAYROLL","VIEW")] public async Task<IActionResult> Payroll([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Payroll(Actor,q,ct)});
 [HttpGet("my-overview")] public async Task<IActionResult> Mine([FromQuery]DashboardQuery q,CancellationToken ct)=>Ok(new{success=true,data=await service.Mine(Actor,q,ct)});
}
