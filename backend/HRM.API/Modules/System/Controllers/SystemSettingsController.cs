using HRM.API.Common;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.System.Controllers;
[ApiController, Authorize, Route("api/system-settings"), ServiceFilter(typeof(BusinessExceptionFilter)), RequestSizeLimit(65536)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SystemSettingsController(SystemSettingsService service, TerminalLoggingSettingsService terminal) : ControllerBase
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
    [HttpGet("terminal-logging"), ScreenPermission(SystemSettingsService.Screen, "VIEW")]
    public async Task<IActionResult> TerminalLogging(CancellationToken ct) => Result(await terminal.Get(Actor, ct));
    [HttpPut("terminal-logging"), ScreenPermission(SystemSettingsService.Screen, "UPDATE")]
    public async Task<IActionResult> TerminalLogging(HRM.API.Logging.TerminalLoggingRequest request, CancellationToken ct) => Result(await terminal.Put(Actor, request, Request.Headers.IfMatch, ct));
    [HttpGet("terminal-logging/modules"), ScreenPermission(SystemSettingsService.Screen, "VIEW")]
    public async Task<IActionResult> TerminalLoggingModules(CancellationToken ct) => Ok(await terminal.Catalog(Actor, ct));
    [HttpGet("terminal-logging/me")]
    public async Task<IActionResult> TerminalLoggingMe(CancellationToken ct) => Result(await terminal.GetMe(Actor, ct));
    [HttpPut("terminal-logging/me")]
    public async Task<IActionResult> TerminalLoggingMe(HRM.API.Logging.TerminalUserLoggingRequest request, CancellationToken ct) => Result(await terminal.PutMe(Actor, request, Request.Headers.IfMatch, ct));
}
