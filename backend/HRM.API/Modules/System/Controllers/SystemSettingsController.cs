using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.System.Controllers;
[ApiController, Authorize, Route("api/system-settings"), ServiceFilter(typeof(BusinessExceptionFilter)), RequestSizeLimit(65536)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SystemSettingsController(SystemSettingsService service) : ControllerBase
{
    private string Actor => User.FindFirst("sub")!.Value;
    private IActionResult Result<T>(SettingsView<T> view) { Response.Headers.ETag = $"\"{view.Version}\""; return Ok(view); }
    [HttpGet("password-policy")]
    public async Task<IActionResult> Password(CancellationToken ct) => Result(await service.Read<PasswordPolicyRequest>(SettingsDefaults.PasswordKey, ct));
    [HttpPut("password-policy"), ScreenPermission(SystemSettingsService.Screen, "UPDATE")]
    public async Task<IActionResult> Password(PasswordPolicyRequest request, CancellationToken ct) => Result(await service.Put(Actor, SettingsDefaults.PasswordKey, request, Request.Headers.IfMatch, ct));
    [HttpGet("attendance"), ScreenPermission(SystemSettingsService.Screen, "VIEW")]
    public async Task<IActionResult> Attendance(CancellationToken ct) => Result(await service.Get<AttendanceSettingsRequest>(Actor, SettingsDefaults.AttendanceKey, ct));
    [HttpPut("attendance"), ScreenPermission(SystemSettingsService.Screen, "UPDATE")]
    public async Task<IActionResult> Attendance(AttendanceSettingsRequest request, CancellationToken ct) => Result(await service.Put(Actor, SettingsDefaults.AttendanceKey, request, Request.Headers.IfMatch, ct));
}
