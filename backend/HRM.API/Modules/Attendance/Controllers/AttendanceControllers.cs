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
public sealed class AttendancesController(AttendanceOperationsService service, AttendanceManagementService management) : AttendanceController
{
    [HttpGet, ScreenPermission(AttendanceScreens.Attendance, "VIEW")]
    public async Task<IActionResult> List([FromQuery] ScheduleQuery q, CancellationToken ct) => Ok(await service.List(Actor, q, ct));
    [HttpGet("daily"), ScreenPermission(AttendanceScreens.Attendance, "VIEW")]
    public async Task<IActionResult> Daily([FromQuery] DailyAttendanceQuery q, CancellationToken ct) => Ok(await management.Daily(Actor,q,ct));
    [HttpGet("statistics"), ScreenPermission(AttendanceScreens.Attendance, "VIEW")]
    public async Task<IActionResult> Statistics([FromQuery] DailyAttendanceQuery q, CancellationToken ct) => Ok(await management.Statistics(Actor,q,ct));
    [HttpGet("me"), ScreenPermission(AttendanceScreens.MyAttendance, "VIEW")]
    public async Task<IActionResult> Me([FromQuery] DailyAttendanceQuery q, CancellationToken ct) => Ok(await management.Daily(Actor,q,ct,me:true));
    [HttpGet("filters"), ScreenPermission(AttendanceScreens.Attendance, "VIEW")]
    public async Task<IActionResult> Filters(CancellationToken ct) => Ok(await management.Filters(Actor,ct));
    [HttpGet("daily/detail"), AnyScreenPermission("VIEW", AttendanceScreens.MyAttendance, AttendanceScreens.Attendance)]
    public async Task<IActionResult> Detail([FromQuery] int employeeId,[FromQuery] DateOnly date,[FromQuery] long? scheduleId,CancellationToken ct) => Ok(await management.Detail(Actor,employeeId,date,scheduleId,ct));
    [HttpGet("export"), ScreenPermission(AttendanceScreens.Attendance, "EXPORT")]
    public async Task<IActionResult> Export([FromQuery] DailyAttendanceQuery q,CancellationToken ct) => File(await management.Export(Actor,q,ct),"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","attendance.xlsx");
    [HttpPost("check-in"), ScreenPermission(AttendanceScreens.MyAttendance, "UPDATE")]
    public async Task<IActionResult> CheckIn(PunchRequest request, CancellationToken ct) => Ok(await service.Punch(Actor, request, true, ct));
    [HttpPost("check-out"), ScreenPermission(AttendanceScreens.MyAttendance, "UPDATE")]
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
