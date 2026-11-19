using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.System.Controllers;
public abstract class SystemController : ControllerBase
{
    protected string Actor => User.FindFirst("sub")!.Value;
    protected IActionResult Versioned(object value, long version) { Response.Headers.ETag = $"\"{version}\""; return Ok(value); }
}
[ApiController, Authorize, Route("api/shifts"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class ShiftsController(AttendanceConfigurationService service) : SystemController
{
    [HttpGet, ScreenPermission(SystemScreens.Shifts, "VIEW")]
    public async Task<IActionResult> List([FromQuery] PageQuery q, CancellationToken ct) => Ok(await service.Shifts(Actor, q, ct));
    [HttpGet("{id:long}"), ScreenPermission(SystemScreens.Shifts, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) { var r = await service.Shift(Actor, id, ct); return Versioned(r, r.Version); }
    [HttpPost, ScreenPermission(SystemScreens.Shifts, "NEW")]
    public async Task<IActionResult> Create(ShiftRequest request, CancellationToken ct)
    { var r = await service.SaveShift(Actor, null, request, null, ct); Response.Headers.ETag = $"\"{r.Version}\""; return CreatedAtAction(nameof(Get), new { id = r.Id }, r); }
    [HttpPut("{id:long}"), ScreenPermission(SystemScreens.Shifts, "UPDATE")]
    public async Task<IActionResult> Update(long id, ShiftRequest request, CancellationToken ct)
    { var r = await service.SaveShift(Actor, id, request, Request.Headers.IfMatch, ct); return Versioned(r, r.Version); }
}
[ApiController, Authorize, Route("api/work-schedules"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class WorkSchedulesController(AttendanceConfigurationService service, AttendanceOperationsService operations) : SystemController
{
    [HttpGet, ScreenPermission(SystemScreens.Schedules, "VIEW")]
    public async Task<IActionResult> List([FromQuery] ScheduleQuery q, CancellationToken ct) => Ok(await service.Schedules(Actor, q, ct));
    [HttpGet("calendar"), ScreenPermission(SystemScreens.Schedules, "VIEW")]
    public async Task<IActionResult> Calendar([FromQuery] ScheduleCalendarQuery q, CancellationToken ct) => Ok(await service.Calendar(Actor, q, ct));
    [HttpPost("bulk/preview"), ScreenPermission(SystemScreens.Schedules, "NEW")]
    public async Task<IActionResult> Preview(ScheduleBulkRequest r, CancellationToken ct) => Ok(await service.Preview(Actor, r, ct));
    [HttpPost("bulk"), ScreenPermission(SystemScreens.Schedules, "NEW")]
    public async Task<IActionResult> Bulk(ScheduleBulkRequest r, CancellationToken ct) => Ok(await service.Assign(Actor, r, false, ct));
    [HttpPost("copy"), ScreenPermission(SystemScreens.Schedules, "NEW")]
    public async Task<IActionResult> Copy(ScheduleBulkRequest r, CancellationToken ct) => Ok(await service.Assign(Actor, r, true, ct));
    [HttpGet("export"), ScreenPermission(SystemScreens.Schedules, "EXPORT")]
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
    [HttpGet("{id:long}"), ScreenPermission(SystemScreens.Schedules, "VIEW")]
    public async Task<IActionResult> Get(long id, CancellationToken ct) { var r = await service.Schedule(Actor, id, ct); return Versioned(r, r.Version); }
    [HttpPost, ScreenPermission(SystemScreens.Schedules, "NEW")]
    public async Task<IActionResult> Create(ScheduleRequest request, CancellationToken ct)
    { var r = await service.SaveSchedule(Actor, null, request, null, ct); Response.Headers.ETag = $"\"{r.Version}\""; return CreatedAtAction(nameof(Get), new { id = r.Id }, r); }
    [HttpPut("{id:long}"), ScreenPermission(SystemScreens.Schedules, "UPDATE")]
    public async Task<IActionResult> Update(long id, ScheduleRequest request, CancellationToken ct)
    { var r = await service.SaveSchedule(Actor, id, request, Request.Headers.IfMatch, ct); return Versioned(r, r.Version); }
    [HttpPatch("{id:long}/cancel"), ScreenPermission(SystemScreens.Schedules, "DELETE")]
    public async Task<IActionResult> Cancel(long id, CancellationToken ct) { await service.Cancel(Actor, id, Request.Headers.IfMatch, ct); return NoContent(); }
    [HttpPost("{id:long}/close"), ScreenPermission(SystemScreens.Attendance, "APPROVE")]
    public async Task<IActionResult> Close(long id, CancellationToken ct) => Ok(await operations.Close(Actor, id, ct));
}
[ApiController, Authorize, Route("api/attendances"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class AttendancesController(AttendanceOperationsService service) : SystemController
{
    [HttpGet, ScreenPermission(SystemScreens.Attendance, "VIEW")]
    public async Task<IActionResult> List([FromQuery] ScheduleQuery q, CancellationToken ct) => Ok(await service.List(Actor, q, ct));
    [HttpPost("check-in"), ScreenPermission(SystemScreens.Attendance, "NEW")]
    public async Task<IActionResult> CheckIn(PunchRequest request, CancellationToken ct) => Ok(await service.Punch(Actor, request, true, ct));
    [HttpPost("check-out"), ScreenPermission(SystemScreens.Attendance, "UPDATE")]
    public async Task<IActionResult> CheckOut(PunchRequest request, CancellationToken ct) => Ok(await service.Punch(Actor, request, false, ct));
}
[ApiController, Authorize, Route("api/qr-sessions"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class QrSessionsController(AttendanceOperationsService service) : SystemController
{
    [HttpGet, ScreenPermission(SystemScreens.Qr, "VIEW")]
    public async Task<IActionResult> List([FromQuery] PageQuery q, CancellationToken ct) => Ok(await service.QrList(Actor, q, ct));
    [HttpPost, ScreenPermission(SystemScreens.Qr, "NEW")]
    public async Task<IActionResult> Create(QrCreateRequest request, CancellationToken ct) { var r = await service.CreateQr(Actor, request, ct); return StatusCode(201, r); }
}
