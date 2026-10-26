using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Notifications.Realtime;
using HRM.API.Security;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;

public sealed class AdministrationRealtimeTests
{
    [Fact]
    public async Task DeliveryUsesCurrentSessionVersionAndStopsForLockedAccount()
    {
        using var app = new AuthApiFactory(); using var client = app.CreateClient(new() { BaseAddress = new("https://localhost") });
        await app.PrepareAsync(); using var scope = app.Services.CreateScope(); var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var clients = new RecordingClients(); var transport = new SignalRNotificationTransport(new RecordingContext(clients), db);
        await transport.NotifyAsync("api-user", 42, "event-key", default);
        Assert.Equal(AuthSessionVersion.NotificationGroup("api-user", 0), clients.LastGroup);
        Assert.Equal("notification.available", clients.Proxy.Method); Assert.Equal(1, clients.Proxy.Calls);
        await db.Set<User>().ExecuteUpdateAsync(s => s.SetProperty(x => x.AuthVersion, 1));
        await transport.NotifyAsync("api-user", 42, "event-key", default);
        Assert.Equal(AuthSessionVersion.NotificationGroup("api-user", 1), clients.LastGroup); Assert.Equal(2, clients.Proxy.Calls);
        await db.Set<User>().ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "LOCKED"));
        await transport.NotifyAsync("api-user", 42, "event-key", default);
        Assert.Equal(2, clients.Proxy.Calls);
    }
    private sealed class RecordingContext(RecordingClients clients) : IHubContext<NotificationHub>
    {
        public IHubClients Clients => clients;
        public IGroupManager Groups => throw new NotSupportedException();
    }
    private sealed class RecordingProxy : IClientProxy
    {
        public int Calls; public string? Method;
        public Task SendCoreAsync(string method, object?[] args, CancellationToken ct = default)
        { Calls++; Method = method; return Task.CompletedTask; }
    }
    private sealed class RecordingClients : IHubClients
    {
        public readonly RecordingProxy Proxy = new(); public string? LastGroup;
        public IClientProxy Group(string name) { LastGroup = name; return Proxy; }
        public IClientProxy All => throw new NotSupportedException();
        public IClientProxy AllExcept(IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy Client(string id) => throw new NotSupportedException();
        public IClientProxy Clients(IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy GroupExcept(string name, IReadOnlyList<string> ids) => throw new NotSupportedException();
        public IClientProxy Groups(IReadOnlyList<string> names) => throw new NotSupportedException();
        public IClientProxy User(string id) => throw new NotSupportedException();
        public IClientProxy Users(IReadOnlyList<string> ids) => throw new NotSupportedException();
    }
}
