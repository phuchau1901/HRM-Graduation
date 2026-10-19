using System.IdentityModel.Tokens.Jwt;
using HRM.API.Modules.Notifications.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
namespace HRM.API.Modules.Notifications.Realtime;
[Authorize]
public sealed class NotificationHub : Hub { }
public sealed class NotificationUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) => connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}
public sealed class SignalRNotificationTransport(IHubContext<NotificationHub> hub) : INotificationTransport
{
    public Task NotifyAsync(string userId, long notificationId, string eventId, CancellationToken ct) =>
        hub.Clients.User(userId).SendAsync("notification.available", new { notificationId, eventId }, ct);
}
