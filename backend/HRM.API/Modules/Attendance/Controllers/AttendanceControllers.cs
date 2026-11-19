using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Work.DTOs;
using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Attendance.Controllers;
public abstract class AttendanceController : ControllerBase
{
    protected string Actor => User.FindFirst("sub")!.Value;
    protected IActionResult Versioned(object value, long version) { Response.Headers.ETag = $"\"{version}\""; return Ok(value); }
}
[ApiController, Authorize, Route("api/attendances"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class AttendancesController(AttendanceOperationsService service) : AttendanceController
{
    [HttpGet, ScreenPermission(AttendanceScreens.Attendance, "VIEW")]
    public async Task<IActionResult> List([FromQuery] ScheduleQuery q, CancellationToken ct) => Ok(await service.List(Actor, q, ct));
    [HttpPost("check-in"), ScreenPermission(AttendanceScreens.Attendance, "NEW")]
    public async Task<IActionResult> CheckIn(PunchRequest request, CancellationToken ct) => Ok(await service.Punch(Actor, request, true, ct));
    [HttpPost("check-out"), ScreenPermission(AttendanceScreens.Attendance, "UPDATE")]
    public async Task<IActionResult> CheckOut(PunchRequest request, CancellationToken ct) => Ok(await service.Punch(Actor, request, false, ct));
}
[ApiController, Authorize, Route("api/qr-sessions"), ServiceFilter(typeof(BusinessExceptionFilter))]
public sealed class QrSessionsController(AttendanceOperationsService service) : AttendanceController
{
    [HttpGet, ScreenPermission(AttendanceScreens.Qr, "VIEW")]
    public async Task<IActionResult> List([FromQuery] PageQuery q, CancellationToken ct) => Ok(await service.QrList(Actor, q, ct));
    [HttpPost, ScreenPermission(AttendanceScreens.Qr, "NEW")]
    public async Task<IActionResult> Create(QrCreateRequest request, CancellationToken ct) { var r = await service.CreateQr(Actor, request, ct); return StatusCode(201, r); }
}
