using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Performance.Controllers;
[ApiController,Authorize,ServiceFilter(typeof(BusinessExceptionFilter)),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/kpi/configuration")]
public sealed class KpiConfigurationController(KpiService service):ControllerBase {
 private string Actor=>User.FindFirst("sub")!.Value;
 [HttpGet("units"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Units([FromQuery]KpiUnitQuery q,CancellationToken ct)=>Ok(await service.Units(Actor,q,ct));
 [HttpGet("units/{id:long}"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Unit(long id,CancellationToken ct)=>Ok(new{success=true,data=await service.Unit(Actor,id,ct)});
 [HttpPost("units"),ScreenPermission(KpiScreens.Configuration,"NEW")]
 public async Task<IActionResult> CreateUnit(KpiUnitRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveUnit(Actor,null,r,ct)});
 [HttpPut("units/{id:long}"),ScreenPermission(KpiScreens.Configuration,"UPDATE")]
 public async Task<IActionResult> UpdateUnit(long id,KpiUnitRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveUnit(Actor,id,r,ct)});
 [HttpGet("lookups"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Lookups(CancellationToken ct)=>Ok(await service.Lookups(Actor,ct,true));
 [HttpGet("periods"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Periods([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Periods(Actor,q,ct));
 [HttpPost("periods"),ScreenPermission(KpiScreens.Configuration,"NEW")]
 public async Task<IActionResult> CreatePeriod(PeriodRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.CreatePeriod(Actor,r,ct)});
 [HttpPost("periods/{id:long}/close"),ScreenPermission(KpiScreens.Configuration,"UPDATE")]
 public async Task<IActionResult> Close(long id,KpiVersion r,CancellationToken ct)=>Ok(new{success=true,data=await service.ClosePeriod(Actor,id,r,ct)});
 [HttpGet("metrics"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Metrics([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Metrics(Actor,q,ct));
 [HttpPost("metrics"),ScreenPermission(KpiScreens.Configuration,"NEW")]
 public async Task<IActionResult> CreateMetric(MetricRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveMetric(Actor,null,r,ct)});
 [HttpPut("metrics/{id:long}"),ScreenPermission(KpiScreens.Configuration,"UPDATE")]
 public async Task<IActionResult> UpdateMetric(long id,MetricRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveMetric(Actor,id,r,ct)});
 [HttpGet("templates"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Templates([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Templates(Actor,q,ct));
 [HttpGet("templates/{id:long}"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Template(long id,CancellationToken ct)=>Ok(await service.Template(Actor,id,ct));
 [HttpPost("templates"),ScreenPermission(KpiScreens.Configuration,"NEW")]
 public async Task<IActionResult> CreateTemplate(TemplateRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveTemplate(Actor,null,r,ct)});
 [HttpPut("templates/{id:long}"),ScreenPermission(KpiScreens.Configuration,"UPDATE")]
 public async Task<IActionResult> UpdateTemplate(long id,TemplateRequest r,CancellationToken ct)=>Ok(new{success=true,data=await service.SaveTemplate(Actor,id,r,ct)});
 [HttpPost("templates/{id:long}/publish"),ScreenPermission(KpiScreens.Configuration,"UPDATE")]
 public async Task<IActionResult> Publish(long id,KpiVersion r,CancellationToken ct)=>Ok(new{success=true,data=await service.Publish(Actor,id,r,ct)});
 [HttpGet("employees"),ScreenPermission(KpiScreens.Configuration,"VIEW")]
 public async Task<IActionResult> Employees([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Employees(Actor,q,ct,true));
 [HttpPost("assignments"),ScreenPermission(KpiScreens.Configuration,"NEW")]
 public async Task<IActionResult> Assign(AssignmentRequest r,CancellationToken ct)=>Ok(await service.Assign(Actor,r,ct));
}
[ApiController,Authorize,ServiceFilter(typeof(BusinessExceptionFilter)),ResponseCache(NoStore=true,Location=ResponseCacheLocation.None)]
[Route("api/kpi/evaluations")]
public sealed class KpiEvaluationsController(KpiService service):ControllerBase {
 private string Actor=>User.FindFirst("sub")!.Value;
 [HttpGet,ScreenPermission(KpiScreens.Evaluation,"VIEW")]
 public async Task<IActionResult> List([FromQuery]KpiQuery q,CancellationToken ct)=>Ok(await service.Evaluations(Actor,q,ct));
 [HttpGet("lookups"),ScreenPermission(KpiScreens.Evaluation,"VIEW")]
 public async Task<IActionResult> Lookups(CancellationToken ct)=>Ok(await service.Lookups(Actor,ct,false));
 [HttpGet("periods"),ScreenPermission(KpiScreens.Evaluation,"VIEW")]
 public async Task<IActionResult> Periods([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Periods(Actor,q,ct,true));
 [HttpGet("employees"),ScreenPermission(KpiScreens.Evaluation,"VIEW")]
 public async Task<IActionResult> Employees([FromQuery]PageQuery q,CancellationToken ct)=>Ok(await service.Employees(Actor,q,ct,false));
 [HttpGet("statistics"),ScreenPermission(KpiScreens.Evaluation,"VIEW")]
 public async Task<IActionResult> Statistics([FromQuery]KpiQuery q,CancellationToken ct)=>Ok(await service.Statistics(Actor,q,ct));
 [HttpGet("export"),ScreenPermission(KpiScreens.Evaluation,"EXPORT")]
 public async Task<IActionResult> Export([FromQuery]KpiQuery q,CancellationToken ct)=>File(KpiWorkbook.Create(await service.Export(Actor,q,ct)),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","kpi.xlsx");
 [HttpGet("{id:long}"),ScreenPermission(KpiScreens.Evaluation,"VIEW")]
 public async Task<IActionResult> Get(long id,CancellationToken ct)=>Ok(await service.Detail(Actor,id,ct));
 [HttpPost("{id:long}/start"),ScreenPermission(KpiScreens.Evaluation,"UPDATE")]
 public async Task<IActionResult> Start(long id,KpiVersion r,CancellationToken ct)=>Ok(await service.Start(Actor,id,r,ct));
 [HttpPut("{id:long}/results"),ScreenPermission(KpiScreens.Evaluation,"UPDATE")]
 public async Task<IActionResult> Results(long id,ResultsRequest r,CancellationToken ct)=>Ok(await service.SaveResults(Actor,id,r,ct));
 [HttpPost("{id:long}/submit"),ScreenPermission(KpiScreens.Evaluation,"UPDATE")]
 public async Task<IActionResult> Submit(long id,KpiVersion r,CancellationToken ct)=>Ok(await service.Submit(Actor,id,r,ct));
 [HttpPost("{id:long}/review"),ScreenPermission(KpiScreens.Evaluation,"APPROVE")]
 public async Task<IActionResult> Review(long id,ReviewRequest r,CancellationToken ct)=>Ok(await service.Review(Actor,id,r,ct));
}
