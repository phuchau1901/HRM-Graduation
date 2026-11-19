using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Work.DTOs;
using HRM.API.Modules.Work.Services;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Work.Controllers;
public abstract class WorkController : ControllerBase
{
    protected string Actor => User.FindFirst("sub")!.Value;
    protected IActionResult Versioned(object value, long version) { Response.Headers.ETag = $"\"{version}\""; return Ok(value); }
}
[ApiController, Authorize, Route("api/shifts"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class ShiftsController(WorkScheduleService service) : WorkController
{
    [HttpGet, ScreenPermission(WorkScreens.Shifts, "VIEW")]
    public async Task<IActionResult> List([FromQuery] PageQuery q, CancellationToken ct) => Ok(await service.Shifts(Actor, q, ct));
    [HttpGet("{id:long}"), ScreenPermission(WorkScreens.Shifts, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) { var r = await service.Shift(Actor, id, ct); return Versioned(r, r.Version); }
    [HttpPost, ScreenPermission(WorkScreens.Shifts, "NEW")]
    public async Task<IActionResult> Create(ShiftRequest request, CancellationToken ct)
    { var r = await service.SaveShift(Actor, null, request, null, ct); Response.Headers.ETag = $"\"{r.Version}\""; return CreatedAtAction(nameof(Get), new { id = r.Id }, r); }
    [HttpPut("{id:long}"), ScreenPermission(WorkScreens.Shifts, "UPDATE")]
    public async Task<IActionResult> Update(long id, ShiftRequest request, CancellationToken ct)
    { var r = await service.SaveShift(Actor, id, request, Request.Headers.IfMatch, ct); return Versioned(r, r.Version); }
}
[ApiController, Authorize, Route("api/work-schedules"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class WorkSchedulesController(WorkScheduleService service, AttendanceOperationsService operations) : WorkController
{
    [HttpGet, ScreenPermission(WorkScreens.Schedules, "VIEW")]
    public async Task<IActionResult> List([FromQuery] ScheduleQuery q, CancellationToken ct) => Ok(await service.Schedules(Actor, q, ct));
    [HttpGet("calendar"), ScreenPermission(WorkScreens.Schedules, "VIEW")]
    public async Task<IActionResult> Calendar([FromQuery] ScheduleCalendarQuery q, CancellationToken ct) => Ok(await service.Calendar(Actor, q, ct));
    [HttpPost("bulk/preview"), ScreenPermission(WorkScreens.Schedules, "NEW")]
    public async Task<IActionResult> Preview(ScheduleBulkRequest r, CancellationToken ct) => Ok(await service.Preview(Actor, r, ct));
    [HttpPost("bulk"), ScreenPermission(WorkScreens.Schedules, "NEW")]
    public async Task<IActionResult> Bulk(ScheduleBulkRequest r, CancellationToken ct) => Ok(await service.Assign(Actor, r, false, ct));
    [HttpPost("copy"), ScreenPermission(WorkScreens.Schedules, "NEW")]
    public async Task<IActionResult> Copy(ScheduleBulkRequest r, CancellationToken ct) => Ok(await service.Assign(Actor, r, true, ct));
    [HttpGet("export"), ScreenPermission(WorkScreens.Schedules, "EXPORT")]
    public async Task<IActionResult> Export([FromQuery] ScheduleCalendarQuery q, CancellationToken ct)
    {
        var calendar = await service.Calendar(Actor, q, ct, "EXPORT");
        string Cell(string value) => "\"" + ((value.Length > 0 && "=+-@\t\r".Contains(value[0])) ? "'" + value : value).Replace("\"", "\"\"") + "\"";
        var rows = new List<string> { "EmployeeCode,EmployeeName,Date,Shift,Status" };
        foreach (var employee in calendar.Employees)
        foreach (var schedule in calendar.Schedules.Where(s => s.EmployeeId == employee.Id))
            rows.Add(string.Join(',', Cell(employee.EmployeeCode), Cell(employee.FullName), schedule.WorkDate.ToString("yyyy-MM-dd"), Cell(schedule.Rules?.ShiftCode ?? ""), Cell(schedule.Status)));
        return File(global::System.Text.Encoding.UTF8.GetPreamble().Concat(global::System.Text.Encoding.UTF8.GetBytes(string.Join("\r\n", rows))).ToArray(), "text/csv; charset=utf-8", "work-schedules.csv");
    }
    [HttpGet("{id:long}"), ScreenPermission(WorkScreens.Schedules, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) { var r = await service.Schedule(Actor, id, ct); return Versioned(r, r.Version); }
    [HttpPost, ScreenPermission(WorkScreens.Schedules, "NEW")]
    public async Task<IActionResult> Create(ScheduleRequest request, CancellationToken ct)
    { var r = await service.SaveSchedule(Actor, null, request, null, ct); Response.Headers.ETag = $"\"{r.Version}\""; return CreatedAtAction(nameof(Get), new { id = r.Id }, r); }
    [HttpPut("{id:long}"), ScreenPermission(WorkScreens.Schedules, "UPDATE")]
    public async Task<IActionResult> Update(long id, ScheduleRequest request, CancellationToken ct)
    { var r = await service.SaveSchedule(Actor, id, request, Request.Headers.IfMatch, ct); return Versioned(r, r.Version); }
    [HttpPatch("{id:long}/cancel"), ScreenPermission(WorkScreens.Schedules, "DELETE")]
    public async Task<IActionResult> Cancel(long id, CancellationToken ct) { await service.Cancel(Actor, id, Request.Headers.IfMatch, ct); return NoContent(); }
    [HttpPost("{id:long}/close"), ScreenPermission(AttendanceScreens.Attendance, "APPROVE")]
    public async Task<IActionResult> Close(long id, CancellationToken ct) => Ok(await operations.Close(Actor, id, ct));
}
