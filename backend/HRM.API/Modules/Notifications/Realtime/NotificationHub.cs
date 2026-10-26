using System.IdentityModel.Tokens.Jwt;
using HRM.API.Data;
using HRM.API.Security;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Notifications.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Notifications.Realtime;
[Authorize]
public sealed class NotificationHub(AppDbContext db) : Hub
{
    public override async Task OnConnectedAsync()
    {
        var id = Context.User?.FindFirst("sub")?.Value;
        var identity = await db.Set<User>().AsNoTracking().Where(x => x.UserId == id && x.Status == "ACTIVE")
            .Select(x => new { x.AuthVersion }).SingleOrDefaultAsync(Context.ConnectionAborted);
        if (identity is null || !AuthSessionVersion.Matches(Context.User, identity.AuthVersion)) { Context.Abort(); return; }
        await Groups.AddToGroupAsync(Context.ConnectionId, AuthSessionVersion.NotificationGroup(id!, identity.AuthVersion), Context.ConnectionAborted);
        await base.OnConnectedAsync();
    }
}
public sealed class NotificationUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) => connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}
public sealed class SignalRNotificationTransport(IHubContext<NotificationHub> hub, AppDbContext db) : INotificationTransport
{
    public async Task NotifyAsync(string userId, long notificationId, string eventId, CancellationToken ct)
    {
        var identity = await db.Set<User>().AsNoTracking().Where(x => x.UserId == userId && x.Status == "ACTIVE")
            .Select(x => new { x.AuthVersion }).SingleOrDefaultAsync(ct);
        if (identity != null) await hub.Clients.Group(AuthSessionVersion.NotificationGroup(userId, identity.AuthVersion))
            .SendAsync("notification.available", new { notificationId, eventId }, ct);
    }
}
