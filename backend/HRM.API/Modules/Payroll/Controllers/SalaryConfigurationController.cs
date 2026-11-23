using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Payroll.Controllers;
[ApiController,Authorize,ServiceFilter(typeof(BusinessExceptionFilter)),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/salary-configuration")]
public sealed class SalaryConfigurationController(PayrollService service):ControllerBase {
 private string Actor=>User.FindFirst("sub")!.Value;
 [HttpGet("employees"),ScreenPermission(PayrollScreens.Salary,"VIEW")]
 public async Task<IActionResult> Employees([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Employees(Actor,q,ct,true));
 [HttpGet("components"),ScreenPermission(PayrollScreens.Salary,"VIEW")]
 public async Task<IActionResult> Components([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Components(Actor,q,ct));
 [HttpPost("components"),ScreenPermission(PayrollScreens.Salary,"NEW")]
 public async Task<IActionResult> CreateComponent(SalaryComponentRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveComponent(Actor,null,r,ct)});
 [HttpPut("components/{id:long}"),ScreenPermission(PayrollScreens.Salary,"UPDATE")]
 public async Task<IActionResult> UpdateComponent(long id,SalaryComponentRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveComponent(Actor,id,r,ct)});
 [HttpGet("profiles"),ScreenPermission(PayrollScreens.Salary,"VIEW")]
 public async Task<IActionResult> Profiles([FromQuery]PayrollQuery q,CancellationToken ct)=>Ok(await service.Profiles(Actor,q,ct));
 [HttpPost("profiles"),ScreenPermission(PayrollScreens.Salary,"NEW")]
 public async Task<IActionResult> CreateProfile(SalaryProfileRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.CreateProfile(Actor,r,ct)});
 [HttpGet("policies"),ScreenPermission(PayrollScreens.Salary,"VIEW")]
 public async Task<IActionResult> Policies([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Policies(Actor,q,ct));
 [HttpPost("policies"),ScreenPermission(PayrollScreens.Salary,"NEW")]
 public async Task<IActionResult> CreatePolicy(PayrollPolicyRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SavePolicy(Actor,null,r,ct)});
 [HttpPut("policies/{id:long}"),ScreenPermission(PayrollScreens.Salary,"UPDATE")]
 public async Task<IActionResult> UpdatePolicy(long id,PayrollPolicyRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SavePolicy(Actor,id,r,ct)});
 [HttpPost("policies/{id:long}/publish"),ScreenPermission(PayrollScreens.Salary,"UPDATE")]
 public async Task<IActionResult> Publish(long id,PolicyPublishRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.PublishPolicy(Actor,id,r,ct)});
 [HttpGet("lookups"),ScreenPermission(PayrollScreens.Salary,"VIEW")]
 public async Task<IActionResult> Lookups(CancellationToken ct)=>Ok(await service.Lookups(Actor,true,ct));
}
