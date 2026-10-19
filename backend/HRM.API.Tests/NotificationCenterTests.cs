using System.Net;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Xunit;

namespace HRM.API.Tests;

public sealed class NotificationCenterTests
{
    [Theory]
    [InlineData("USER", 1)] [InlineData("USERS", 2)] [InlineData("ROLE", 2)]
    [InlineData("DEPARTMENT", 1)] [InlineData("CUSTOM", 1)]
    public async Task ResolvesSupportedAudiencesAndSnapshotsMembership(string type, int expected)
    {
        await using var h = await Harness.Create();
        var department = new Department { DepartmentCode = "ENGINEERING", DepartmentName = "Engineering" };
        h.Db.Add(department); await h.Db.SaveChangesAsync();
        var employee = new Employee { EmployeeCode = "E01", FullName = "Test Employee", Email = "employee@example.invalid",
            DepartmentId = department.Id, HireDate = new DateOnly(2026, 1, 1) };
        h.Db.Add(employee); await h.Db.SaveChangesAsync();
        await h.Db.Set<User>().Where(x => x.UserId == "api-user").ExecuteUpdateAsync(s => s.SetProperty(x => x.EmployeeId, employee.Id));
        h.Db.Add(new User { UserId = "second", Email = "second@example.invalid", Status = "ACTIVE" });
        h.Db.Add(new User { UserId = "locked", Email = "locked@example.invalid", Status = "DISABLED" });
        var hr = await h.Db.Set<Role>().SingleAsync(x => x.Code == "HR");
        h.Db.Add(new UserRole { UserID = "second", RoleID = hr.ID }); await h.Db.SaveChangesAsync();
        var target = type switch
        {
            "USER" => new NotificationTargetRequest { Type = type, UserIds = ["api-user"] },
            "USERS" => new NotificationTargetRequest { Type = type, UserIds = ["api-user", "second", "second", "locked", "missing"] },
            "ROLE" => new NotificationTargetRequest { Type = type, RoleIds = [hr.ID] },
            "DEPARTMENT" => new NotificationTargetRequest { Type = type, DepartmentIds = [department.Id] },
            _ => new NotificationTargetRequest { Type = "CUSTOM", FilterCode = NotificationAudience.ActiveEmployees }
        };
        var receipt = await h.Service.CreateInternalAsync(Request(target), "WORKFLOW", "workflow-event", "test-trace");
        Assert.Empty(await h.Db.Set<NotificationRecipient>().ToListAsync()); Assert.Empty(h.Transport.Events);
        Assert.True(await h.Dispatcher.DistributeNextAsync());
        Assert.Equal(expected, await h.Db.Set<NotificationRecipient>().CountAsync());
        Assert.Equal("PUBLISHED", (await h.Db.Set<Notification>().AsNoTracking().SingleAsync()).Status);
        // Membership edits after publication cannot add/remove recipients.
        await h.Db.Set<UserRole>().ExecuteDeleteAsync();
        await h.Db.Set<Employee>().ExecuteUpdateAsync(s => s.SetProperty(x => x.EmploymentStatus, "INACTIVE"));
        Assert.False(await h.Dispatcher.DistributeNextAsync());
        Assert.Equal(expected, await h.Db.Set<NotificationRecipient>().CountAsync());
        Assert.Equal(receipt.Id, (await h.Service.ListAsync("api-user", null, 30, default)).Items.Single().Id);
    }

    [Fact]
    public async Task AllFiveThousandUsesOneContentAndBatchesWithStableReplay()
    {
        await using var h = await Harness.Create();
        h.Db.AddRange(Enumerable.Range(1, 4999).Select(i => new User { UserId = "bulk-" + i,
            Email = $"bulk-{i}@example.invalid", Status = "ACTIVE" }));
        h.Db.Add(new User { UserId = "disabled", Email = "disabled@example.invalid", Status = "DISABLED" });
        await h.Db.SaveChangesAsync(); h.Db.ChangeTracker.Clear();
        var request = Request(new() { Type = "ALL" });
        var first = await h.Service.CreateInternalAsync(request, "SYSTEM", "bulk-event", "bulk-trace");
        var again = await h.Service.CreateInternalAsync(request, "SYSTEM", "bulk-event", "bulk-trace");
        Assert.Equal(first.Id, again.Id); Assert.Single(await h.Db.Set<Notification>().ToListAsync());
        Assert.Empty(h.Transport.Events); Assert.Equal(0, await h.Db.Set<NotificationRecipient>().CountAsync());
        await h.Dispatcher.DistributeNextAsync();
        Assert.Equal(5000, await h.Db.Set<NotificationRecipient>().CountAsync());
        Assert.Equal(5000, (await h.Db.Set<Notification>().AsNoTracking().SingleAsync()).RecipientCount);
        // A replayed completed job must never INSERT or send another copy of the inbox item.
        await h.Db.Set<NotificationOutbox>().ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "PENDING"));
        await h.Dispatcher.DistributeNextAsync();
        Assert.Equal(5000, await h.Db.Set<NotificationRecipient>().CountAsync());
        Assert.Equal(100, await h.Dispatcher.DeliverBatchAsync());
        Assert.Equal(100, h.Transport.Events.Count); // bounded background work, never in HTTP
        Assert.Contains(await h.Db.Set<AuditLog>().ToListAsync(), x => x.Action == "NOTIFICATION_GROUP_DISTRIBUTED");
    }

    [Fact]
    public async Task OverlappingTargetsUseOrAndDoNotDuplicateRecipientsOrCompletedDelivery()
    {
        await using var h = await Harness.Create();
        var roles = await h.Db.Set<Role>().Select(x => x.ID).ToArrayAsync();
        var request = Request(new() { Type = "USER", UserIds = ["api-user"] });
        request.Targets = [request.Targets[0], new() { Type = "USERS", UserIds = ["api-user", "api-user"] },
            new() { Type = "ROLE", RoleIds = roles }, new() { Type = "ALL" }];
        await h.Service.CreateInternalAsync(request, "REMINDER", "overlap", "trace");
        await h.Dispatcher.DistributeNextAsync();
        Assert.Single(await h.Db.Set<NotificationRecipient>().ToListAsync());
        Assert.Equal(1, await h.Dispatcher.DeliverBatchAsync()); Assert.Equal(0, await h.Dispatcher.DeliverBatchAsync());
        Assert.Equal("api-user", Assert.Single(h.Transport.Events).UserId);
        Assert.Equal(1, await h.Service.UnreadCountAsync("api-user", default));
    }

    [Fact]
    public async Task OfflineInboxPersistsEvenIfRealtimeFailsAndRetriesUseSameEventId()
    {
        await using var h = await Harness.Create(); h.Transport.Fail = true;
        var receipt = await h.Service.CreateInternalAsync(Request(new() { UserIds = ["api-user"] }), "SYSTEM", "offline", "trace");
        await h.Dispatcher.DistributeNextAsync();
        await h.Dispatcher.DeliverBatchAsync();
        var recipient = await h.Db.Set<NotificationRecipient>().AsNoTracking().SingleAsync();
        Assert.Equal("RETRY", recipient.DeliveryStatus); Assert.Equal(1, recipient.DeliveryAttempts);
        Assert.Equal(receipt.Id, (await h.Service.ListAsync("api-user", null, 20, default)).Items.Single().Id);
        Assert.Equal(1, await h.Service.UnreadCountAsync("api-user", default));
        h.Transport.Fail = false;
        await h.Db.Set<NotificationRecipient>().ExecuteUpdateAsync(s => s.SetProperty(x => x.NextAttemptAt, DateTime.UtcNow.AddMinutes(-1)));
        await h.Dispatcher.DeliverBatchAsync();
        Assert.Equal(recipient.EventID, h.Transport.Events.Last().EventId);
        Assert.Equal(h.Transport.Events.First().EventId, h.Transport.Events.Last().EventId);
        Assert.Equal("SENT", (await h.Db.Set<NotificationRecipient>().AsNoTracking().SingleAsync()).DeliveryStatus);
        var audit = await h.Db.Set<AuditLog>().SingleAsync(x => x.Action == "NOTIFICATION_DELIVERY_RETRY");
        Assert.Contains("trace", audit.AfterJSON); Assert.DoesNotContain("private-content", audit.AfterJSON);
    }

    [Fact]
    public async Task ActiveLeaseIsNotStolenAndExpiredLeaseCanRecover()
    {
        await using var h = await Harness.Create();
        await h.Service.CreateInternalAsync(Request(new() { Type = "ALL" }), "SYSTEM", "lease", "trace");
        await h.Db.Set<NotificationOutbox>().ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "PROCESSING")
            .SetProperty(x => x.LeaseToken, "abandoned").SetProperty(x => x.LockedUntil, DateTime.UtcNow.AddMinutes(1)));
        Assert.False(await h.Dispatcher.DistributeNextAsync());
        await h.Db.Set<NotificationOutbox>().ExecuteUpdateAsync(s => s.SetProperty(x => x.LockedUntil, DateTime.UtcNow.AddMinutes(-1)));
        Assert.True(await h.Dispatcher.DistributeNextAsync()); Assert.Single(await h.Db.Set<NotificationRecipient>().ToListAsync());
    }

    [Fact]
    public async Task ScheduledAudienceIsResolvedWhenPublishedAndCancelledJobsNeverDistribute()
    {
        await using var h = await Harness.Create();
        var request = Request(new() { Type = "ALL" }); request.ScheduledAt = DateTimeOffset.UtcNow.AddDays(1);
        var receipt = await h.Service.CreateInternalAsync(request, "REMINDER", "schedule", "trace");
        Assert.False(await h.Dispatcher.DistributeNextAsync()); Assert.Empty(await h.Db.Set<NotificationRecipient>().ToListAsync());
        h.Db.Add(new User { UserId = "joined-later", Email = "joined@example.invalid", Status = "ACTIVE" }); await h.Db.SaveChangesAsync();
        await h.Db.Set<NotificationOutbox>().ExecuteUpdateAsync(s => s.SetProperty(x => x.AvailableAt, DateTime.UtcNow.AddSeconds(-1)));
        await h.Dispatcher.DistributeNextAsync(); Assert.Equal(2, await h.Db.Set<NotificationRecipient>().CountAsync());
        Assert.Equal(receipt.Id, (await h.Service.ListAsync("joined-later", null, 30, default)).Items.Single().Id);
    }

    [Fact]
    public async Task RejectsRawConditionsUnknownFiltersAndConflictingIdempotencyKeys()
    {
        await using var h = await Harness.Create();
        await Assert.ThrowsAsync<NotificationException>(() => h.Service.CreateInternalAsync(
            Request(new() { Type = "CUSTOM", FilterCode = "SELECT * FROM users" }), "SYSTEM", "unsafe", "trace"));
        var request = Request(new() { UserIds = ["api-user"] });
        await h.Service.CreateInternalAsync(request, "SYSTEM", "key", "trace"); request.Content = "changed";
        Assert.Equal(409, (await Assert.ThrowsAsync<NotificationException>(() => h.Service.CreateInternalAsync(request, "SYSTEM", "key", "trace"))).Status);
    }

    [Fact]
    public async Task ApiRequiresJwtAndSendAllGrantAndOnlyRecipientCanRead()
    {
        await using var h = await Harness.Create();
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/notifications")).StatusCode);
        await h.Login();
        var denied = await h.Post(Request(new() { Type = "ALL" }), "all");
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        using (var body = JsonDocument.Parse(await denied.Content.ReadAsStringAsync()))
            Assert.Equal("HRM_AUTH_003", body.RootElement.GetProperty("code").GetString());
        Assert.Empty(await h.Db.Set<Notification>().ToListAsync());
        var receipt = await h.Service.CreateInternalAsync(Request(new() { UserIds = ["api-user"] }), "SYSTEM", "private", "trace");
        await h.Dispatcher.DistributeNextAsync();
        Assert.Single((await h.Client.GetFromJsonAsync<NotificationPage>("/api/notifications"))!.Items);
        using (var inbox = JsonDocument.Parse(await h.Client.GetStringAsync("/api/notifications")))
            Assert.EndsWith("Z", inbox.RootElement.GetProperty("items")[0].GetProperty("publishedAt").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await h.Client.PatchAsync($"/api/notifications/{receipt.Id}/read", null)).StatusCode);
        Assert.Equal(0, await h.Service.UnreadCountAsync("api-user", default));
        await Assert.ThrowsAsync<NotificationException>(() => h.Service.ReadAsync(receipt.Id, "someone-else", default));
        Assert.Empty((await h.Service.ListAsync("someone-else", null, 30, default)).Items);
        h.Db.Add(new User { UserId = "other", Email = "other@example.invalid", Status = "ACTIVE" }); await h.Db.SaveChangesAsync();
        var privateToOther = await h.Service.CreateInternalAsync(Request(new() { UserIds = ["other"] }), "SYSTEM", "other-private", "trace");
        await h.Dispatcher.DistributeNextAsync();
        Assert.Equal(HttpStatusCode.NotFound, (await h.Client.PatchAsync($"/api/notifications/{privateToOther.Id}/read", null)).StatusCode);
        var own = (await h.Client.GetFromJsonAsync<NotificationPage>("/api/notifications?userId=other"))!;
        Assert.DoesNotContain(own.Items, x => x.Id == privateToOther.Id);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PatchAsync("/api/notifications/read-all", null)).StatusCode);
        Assert.Equal(1, await h.Service.UnreadCountAsync("other", default));
    }

    [Fact]
    public async Task AnnouncementDraftPublishCancelAndJwtActionsWorkEndToEnd()
    {
        await using var h = await Harness.Create();
        await h.Grant("SEND_USER", "SEND_GROUP", "SEND_ALL", "SCHEDULE", "CANCEL"); await h.Login();
        var response = await h.Post(Request(new() { UserIds = ["api-user"] }), "draft");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = (await response.Content.ReadFromJsonAsync<NotificationReceipt>())!; Assert.Equal("DRAFT", created.Status);
        Assert.False(await h.Dispatcher.DistributeNextAsync());
        Assert.Equal(HttpStatusCode.Accepted, (await h.Client.PostAsync($"/api/notifications/{created.Id}/publish", null)).StatusCode);
        Assert.Equal(HttpStatusCode.Accepted, (await h.Client.PostAsync($"/api/notifications/{created.Id}/publish", null)).StatusCode);
        await h.Dispatcher.DistributeNextAsync(); Assert.Single(await h.Db.Set<NotificationRecipient>().ToListAsync());
        Assert.Equal(HttpStatusCode.Conflict, (await h.Client.PostAsync($"/api/notifications/{created.Id}/cancel", null)).StatusCode);
        var scheduled = Request(new() { Type = "ALL" }); scheduled.ScheduledAt = DateTimeOffset.UtcNow.AddHours(1);
        var pending = (await (await h.Post(scheduled, "scheduled")).Content.ReadFromJsonAsync<NotificationReceipt>())!;
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsync($"/api/notifications/{pending.Id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsync($"/api/notifications/{pending.Id}/cancel", null)).StatusCode);
        Assert.Equal("CANCELLED", (await h.Db.Set<NotificationOutbox>().AsNoTracking().SingleAsync(x => x.NotificationID == pending.Id)).Status);
        Assert.False(await h.Dispatcher.DistributeNextAsync());
    }

    [Fact]
    public async Task ScheduleAndMixedGroupsRequireEveryRelevantGrant()
    {
        await using var h = await Harness.Create(); await h.Grant("SEND_USER"); await h.Login();
        var request = Request(new() { UserIds = ["api-user"] }); request.ScheduledAt = DateTimeOffset.UtcNow.AddHours(1);
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Post(request, "missing-schedule")).StatusCode);
        request.ScheduledAt = null; request.Targets = [request.Targets[0], new() { Type = "ALL" }];
        Assert.Equal(HttpStatusCode.Forbidden, (await h.Post(request, "mixed")).StatusCode);
        Assert.Empty(await h.Db.Set<Notification>().ToListAsync());
    }

    [Fact]
    public async Task BusinessTransactionRollbackAlsoRollsBackNotificationAndOutbox()
    {
        await using var h = await Harness.Create();
        await using (var transaction = await h.Db.Database.BeginTransactionAsync())
        {
            await h.Service.CreateInternalAsync(Request(new() { Type = "ALL" }), "WORKFLOW", "rollback", "trace");
            Assert.Single(await h.Db.Set<NotificationOutbox>().ToListAsync());
            await transaction.RollbackAsync();
        }
        h.Db.ChangeTracker.Clear();
        Assert.Empty(await h.Db.Set<Notification>().ToListAsync());
        Assert.Empty(await h.Db.Set<NotificationOutbox>().ToListAsync());
        Assert.Empty(await h.Db.Set<AuditLog>().ToListAsync());
    }

    [Fact]
    public async Task DistributionFailureRetriesAndEventuallyStopsWithoutPartialRecipients()
    {
        await using var h = await Harness.Create();
        await h.Service.CreateInternalAsync(Request(new() { Type = "ALL" }), "SYSTEM", "bad-stored-target", "trace");
        await h.Db.Set<NotificationTarget>().ExecuteUpdateAsync(s => s.SetProperty(x => x.CriteriaJSON, "{}"));
        await h.Dispatcher.DistributeNextAsync();
        var job = await h.Db.Set<NotificationOutbox>().AsNoTracking().SingleAsync();
        Assert.Equal("PENDING", job.Status); Assert.Equal(1, job.Attempts);
        Assert.Equal("DISTRIBUTION_FAILED", job.LastErrorCode);
        Assert.Empty(await h.Db.Set<NotificationRecipient>().ToListAsync());
        await h.Db.Set<NotificationOutbox>().ExecuteUpdateAsync(s => s.SetProperty(x => x.Attempts, 4)
            .SetProperty(x => x.AvailableAt, DateTime.UtcNow.AddMinutes(-1)));
        await h.Dispatcher.DistributeNextAsync();
        Assert.Equal("DEAD", (await h.Db.Set<NotificationOutbox>().AsNoTracking().SingleAsync()).Status);
        Assert.Contains(await h.Db.Set<AuditLog>().ToListAsync(), x => x.Action == "NOTIFICATION_DISTRIBUTION_FAILED");
    }

    [Fact]
    public async Task DeliveryCanFailPermanentlyWithoutLosingInbox()
    {
        await using var h = await Harness.Create(); h.Transport.Fail = true;
        await h.Service.CreateInternalAsync(Request(new() { Type = "ALL" }), "SYSTEM", "delivery-fail", "trace");
        var dispatcher = new NotificationDispatcher(h.Db, h.Transport, Options.Create(new NotificationOptions { MaxAttempts = 1 }));
        await dispatcher.DistributeNextAsync(); await dispatcher.DeliverBatchAsync();
        Assert.Equal("FAILED", (await h.Db.Set<NotificationRecipient>().AsNoTracking().SingleAsync()).DeliveryStatus);
        Assert.Single((await h.Service.ListAsync("api-user", null, 30, default)).Items);
        Assert.Contains(await h.Db.Set<AuditLog>().ToListAsync(), x => x.Action == "NOTIFICATION_DELIVERY_FAILED");
    }

    [Fact]
    public async Task AbandonedDeliveryAtAttemptLimitDoesNotResendIndefinitely()
    {
        await using var h = await Harness.Create();
        await h.Service.CreateInternalAsync(Request(new() { Type = "ALL" }), "SYSTEM", "abandoned-send", "trace");
        await h.Dispatcher.DistributeNextAsync();
        await h.Db.Set<NotificationRecipient>().ExecuteUpdateAsync(s => s.SetProperty(x => x.DeliveryAttempts, 5)
            .SetProperty(x => x.LockedUntil, DateTime.UtcNow.AddMinutes(-1)).SetProperty(x => x.LeaseToken, "old"));
        await h.Dispatcher.DeliverBatchAsync();
        Assert.Empty(h.Transport.Events);
        Assert.Equal("FAILED", (await h.Db.Set<NotificationRecipient>().AsNoTracking().SingleAsync()).DeliveryStatus);
        Assert.Single((await h.Service.ListAsync("api-user", null, 30, default)).Items);
    }

    [Fact]
    public async Task CrossOriginNotificationClientsMustBeExplicitlyAllowed()
    {
        using var app = new AuthApiFactory { NotificationOrigin = "https://hrm.example.invalid" };
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        foreach (var path in new[] { "/api/notifications", "/hubs/notifications/negotiate" })
        {
            foreach (var allowed in new[] { true, false })
            {
                using var request = new HttpRequestMessage(HttpMethod.Options, path);
                request.Headers.Add("Origin", allowed ? "https://hrm.example.invalid" : "https://untrusted.example.invalid");
                request.Headers.Add("Access-Control-Request-Method", path.StartsWith("/api/") ? "GET" : "POST");
                request.Headers.Add("Access-Control-Request-Headers", "Authorization");
                var response = await client.SendAsync(request);
                Assert.Equal(allowed, response.Headers.Contains("Access-Control-Allow-Origin"));
            }
        }
    }

    [Fact]
    public async Task HubUsesJwtAndQueryTokenIsNotAcceptedByRestApis()
    {
        await using var h = await Harness.Create();
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsync("/hubs/notifications/negotiate?negotiateVersion=1", null)).StatusCode);
        await h.Login();
        var token = h.Client.DefaultRequestHeaders.Authorization!.Parameter!;
        h.Client.DefaultRequestHeaders.Authorization = null;
        Assert.Equal(HttpStatusCode.OK, (await h.Client.PostAsync("/hubs/notifications/negotiate?negotiateVersion=1&access_token=" + Uri.EscapeDataString(token), null)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.GetAsync("/api/notifications?access_token=" + Uri.EscapeDataString(token))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await h.Client.PostAsync("/hubs/notifications/negotiate?access_token=invalid", null)).StatusCode);
    }

    [Fact]
    public async Task RealtimeUserIdComesFromSubInsteadOfNameOrRole()
    {
        await using var connection = new Microsoft.AspNetCore.Connections.DefaultConnectionContext();
        connection.Features.Set<Microsoft.AspNetCore.Connections.Features.IConnectionUserFeature>(new ConnectionUser
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", "hr01"), new Claim("name", "admin"), new Claim("role", "ADMIN")], "test"))
        });
        var hub = new Microsoft.AspNetCore.SignalR.HubConnectionContext(connection,
            new Microsoft.AspNetCore.SignalR.HubConnectionContextOptions(), Microsoft.Extensions.Logging.Abstractions.NullLoggerFactory.Instance);
        Assert.Equal("hr01", new HRM.API.Modules.Notifications.Realtime.NotificationUserIdProvider().GetUserId(hub));
    }
    private sealed class ConnectionUser : Microsoft.AspNetCore.Connections.Features.IConnectionUserFeature
    {
        public ClaimsPrincipal? User { get; set; }
    }

    private static CreateNotificationRequest Request(NotificationTargetRequest target) => new()
        { Title = "Notification", Content = "private-content", Targets = [target] };

    private sealed class FakeTransport : INotificationTransport
    {
        public bool Fail { get; set; }
        public List<(string UserId, long Id, string EventId)> Events { get; } = [];
        public Task NotifyAsync(string userId, long notificationId, string eventId, CancellationToken ct)
        {
            Events.Add((userId, notificationId, eventId));
            return Fail ? Task.FromException(new InvalidOperationException("not logged")) : Task.CompletedTask;
        }
    }
    private sealed class Harness : IAsyncDisposable
    {
        private readonly AuthApiFactory _app = new();
        private IServiceScope _scope = null!;
        public HttpClient Client { get; private set; } = null!;
        public AppDbContext Db => _scope.ServiceProvider.GetRequiredService<AppDbContext>();
        public NotificationService Service => _scope.ServiceProvider.GetRequiredService<NotificationService>();
        public FakeTransport Transport { get; } = new();
        public NotificationDispatcher Dispatcher => new(Db, Transport, Options.Create(new NotificationOptions()));
        public static async Task<Harness> Create()
        {
            var h = new Harness(); h.Client = h._app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
            await h._app.PrepareAsync(); h._scope = h._app.Services.CreateScope(); return h;
        }
        public async Task Login()
        {
            var response = await Client.PostAsJsonAsync("/api/auth/login", new { userId = "api-user", password = _app.Password });
            response.EnsureSuccessStatusCode();
            Client.DefaultRequestHeaders.Authorization = new("Bearer", (await response.Content.ReadFromJsonAsync<LoginResponse>())!.AccessToken);
        }
        public async Task Grant(params string[] actions)
        {
            var screen = new Screen { Code = NotificationService.ScreenCode, Name = "Notifications", IsActive = true };
            Db.Add(screen); await Db.SaveChangesAsync();
            var role = await Db.Set<Role>().FirstAsync();
            Db.AddRange(actions.Select(action => new RoleScreenAction { RoleID = role.ID, ScreenID = screen.ID, ActionCode = action }));
            await Db.SaveChangesAsync();
        }
        public Task<HttpResponseMessage> Post(CreateNotificationRequest request, string key)
        {
            var message = new HttpRequestMessage(HttpMethod.Post, "/api/notifications/announcements") { Content = JsonContent.Create(request) };
            message.Headers.Add("Idempotency-Key", key); return Client.SendAsync(message);
        }
        public ValueTask DisposeAsync() { _scope.Dispose(); Client.Dispose(); _app.Dispose(); return ValueTask.CompletedTask; }
    }
}
