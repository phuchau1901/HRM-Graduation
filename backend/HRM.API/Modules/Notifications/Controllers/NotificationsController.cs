using System.IdentityModel.Tokens.Jwt;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
namespace HRM.API.Modules.Notifications.Controllers;

[ApiController, Authorize, EnableCors("NotificationClients"), Route("api/notifications")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class NotificationsController(NotificationService notifications) : ControllerBase
{
    private string UserId => User.FindFirst(JwtRegisteredClaimNames.Sub)!.Value;
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] long? beforeId, [FromQuery] int limit = 30, CancellationToken ct = default) =>
        Ok(await notifications.ListAsync(UserId, beforeId, limit, ct));
    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount(CancellationToken ct) => Ok(new { count = await notifications.UnreadCountAsync(UserId, ct) });
    [HttpPatch("{id:long}/read")]
    public Task<IActionResult> Read(long id, CancellationToken ct) => Execute(async () => { await notifications.ReadAsync(id, UserId, ct); return NoContent(); });
    [HttpPatch("read-all")]
    public async Task<IActionResult> ReadAll(CancellationToken ct) => Ok(new { updated = await notifications.ReadAllAsync(UserId, ct) });
    [HttpPost("announcements"), RequestSizeLimit(131072)]
    public Task<IActionResult> Create([FromBody] CreateNotificationRequest request, CancellationToken ct) => Execute(async () =>
        StatusCode(201, await notifications.CreateAnnouncementAsync(request, UserId, User,
            Request.Headers["Idempotency-Key"].ToString(), HttpContext.TraceIdentifier, ct)));
    [HttpPost("{id:long}/publish")]
    public Task<IActionResult> Publish(long id, CancellationToken ct) => Execute(async () =>
        Accepted(await notifications.PublishAsync(id, User, UserId, HttpContext.TraceIdentifier, ct)));
    [HttpPost("{id:long}/cancel"), ScreenPermission(NotificationService.ScreenCode, "CANCEL")]
    public Task<IActionResult> Cancel(long id, CancellationToken ct) => Execute(async () =>
        Ok(await notifications.CancelAsync(id, UserId, HttpContext.TraceIdentifier, ct)));
    private async Task<IActionResult> Execute(Func<Task<IActionResult>> action)
    {
        try { return await action(); }
        catch (NotificationException ex)
        {
            return StatusCode(ex.Status, ApiErrors.Create(HttpContext, ex.Code,
                ex.Status == 403 ? "PERMISSION_DENIED" : "NOTIFICATION_ERROR", ex.Message));
        }
    }
}
