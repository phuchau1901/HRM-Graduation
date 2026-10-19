using System.Globalization;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Policies;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Notifications.Services;

public sealed class NotificationService(AppDbContext db, IAuthorizationService authorization)
{
    public const string ScreenCode = "WEB_NOTIFICATIONS";
    public async Task AuthorizeTargetsAsync(ClaimsPrincipal principal, IEnumerable<string> types, bool scheduled)
    {
        var actions = types.Select(NotificationAudience.RequiredAction).Distinct().ToList();
        if (scheduled) actions.Add("SCHEDULE");
        foreach (var action in actions)
            if (!(await authorization.AuthorizeAsync(principal, null, new ScreenPermissionRequirement(ScreenCode, action))).Succeeded)
                throw new NotificationException(403, "HRM_AUTH_003", "Notification permission denied.");
    }

    public async Task<NotificationReceipt> CreateAnnouncementAsync(CreateNotificationRequest request, string userId,
        ClaimsPrincipal principal, string idempotencyKey, string traceId, CancellationToken ct)
    {
        NotificationAudience.Validate(request);
        await AuthorizeTargetsAsync(principal, request.Targets.Select(x => x.Type), request.ScheduledAt.HasValue);
        return await CreateAsync(request, "ANNOUNCEMENT", userId, idempotencyKey, traceId, ct);
    }

    // Trusted application services (workflow/system/reminders) share the same durable pipeline.
    // This method is not exposed by HTTP; callers must supply a stable business event key.
    public Task<NotificationReceipt> CreateInternalAsync(CreateNotificationRequest request, string source,
        string eventKey, string traceId, CancellationToken ct = default)
    {
        if (source is not ("WORKFLOW" or "SYSTEM" or "REMINDER")) throw new ArgumentException("Invalid internal source.");
        return CreateAsync(request, source, null, eventKey, traceId, ct, publish: true);
    }

    private async Task<NotificationReceipt> CreateAsync(CreateNotificationRequest request, string source, string? actor,
        string key, string trace, CancellationToken ct, bool publish = false)
    {
        NotificationAudience.Validate(request);
        if (string.IsNullOrWhiteSpace(key) || key.Length > 100 || trace.Length > 64)
            throw new NotificationException(400, "HRM_NOTIFICATION_001", "A nonempty Idempotency-Key of at most 100 characters is required.");
        var dedup = Hash(JsonSerializer.Serialize(new { source, actor, key }));
        var hash = Hash(JsonSerializer.Serialize(request));
        var old = await db.Set<Notification>().AsNoTracking().SingleOrDefaultAsync(x => x.DeduplicationKey == dedup, ct);
        if (old is not null) return Existing(old, hash);
        var now = DateTime.UtcNow;
        if (request.ScheduledAt.HasValue && request.ScheduledAt.Value.UtcDateTime <= now)
            throw new NotificationException(400, "HRM_NOTIFICATION_001", "ScheduledAt must be in the future.");
        var notification = new Notification { Title = request.Title, Content = request.Content, Source = source,
            CreatedByUserID = actor, CreatedAt = now, ScheduledAt = request.ScheduledAt?.UtcDateTime,
            Status = publish || request.ScheduledAt.HasValue ? "SCHEDULED" : "DRAFT", ReferenceType = request.ReferenceType,
            ReferenceID = request.ReferenceId, DeduplicationKey = dedup, RequestHash = hash, TraceID = trace };
        // Workflow callers may own the business transaction. The notification/outbox then commit with it.
        var ownsTransaction = db.Database.CurrentTransaction is null;
        await using var transaction = ownsTransaction ? await db.Database.BeginTransactionAsync(ct) : null;
        try
        {
            db.Add(notification); await db.SaveChangesAsync(ct);
            db.AddRange(request.Targets.Select(t => new NotificationTarget { NotificationID = notification.ID, Type = t.Type, CriteriaJSON = JsonSerializer.Serialize(t) }));
            if (notification.Status == "SCHEDULED")
                db.Add(new NotificationOutbox { NotificationID = notification.ID, AvailableAt = notification.ScheduledAt ?? now });
            AddAudit(db, notification, "NOTIFICATION_CREATED", request.Targets.Select(t => t.Type), 0, actor, trace);
            await db.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
            return Receipt(notification);
        }
        catch (DbUpdateException) when (ownsTransaction)
        {
            await transaction!.RollbackAsync(ct); db.ChangeTracker.Clear();
            var duplicate = await db.Set<Notification>().AsNoTracking().SingleOrDefaultAsync(x => x.DeduplicationKey == dedup, ct);
            if (duplicate is null) throw;
            return Existing(duplicate, hash);
        }
    }

    public async Task<NotificationReceipt> PublishAsync(long id, ClaimsPrincipal principal, string actor, string trace, CancellationToken ct)
    {
        var n = await db.Set<Notification>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw Missing();
        var types = await db.Set<NotificationTarget>().Where(x => x.NotificationID == id).Select(x => x.Type).ToListAsync(ct);
        await AuthorizeTargetsAsync(principal, types, n.ScheduledAt.HasValue);
        if (n.Source != "ANNOUNCEMENT") throw Conflict();
        if (n.Status is "SCHEDULED" or "PUBLISHED") return Receipt(n);
        if (n.Status != "DRAFT") throw Conflict();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        if (await db.Set<Notification>().Where(x => x.ID == id && x.Status == "DRAFT")
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "SCHEDULED").SetProperty(x => x.TraceID, trace), ct) != 1) throw Conflict();
        db.Add(new NotificationOutbox { NotificationID = id, AvailableAt = n.ScheduledAt ?? DateTime.UtcNow });
        AddAudit(db, n, "NOTIFICATION_QUEUED", types, 0, actor, trace);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        n.Status = "SCHEDULED"; return Receipt(n);
    }

    public async Task<NotificationReceipt> CancelAsync(long id, string actor, string trace, CancellationToken ct)
    {
        var n = await db.Set<Notification>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw Missing();
        if (n.Source != "ANNOUNCEMENT") throw Conflict();
        if (n.Status == "CANCELLED") return Receipt(n);
        if (n.Status is not ("DRAFT" or "SCHEDULED")) throw Conflict();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var now = DateTime.UtcNow;
        if (await db.Set<Notification>().Where(x => x.ID == id && (x.Status == "DRAFT" || x.Status == "SCHEDULED"))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "CANCELLED").SetProperty(x => x.CancelledAt, now), ct) != 1) throw Conflict();
        await db.Set<NotificationOutbox>().Where(x => x.NotificationID == id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, "CANCELLED"), ct);
        var types = await db.Set<NotificationTarget>().Where(x => x.NotificationID == id).Select(x => x.Type).ToListAsync(ct);
        AddAudit(db, n, "NOTIFICATION_CANCELLED", types, n.RecipientCount, actor, trace);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
        n.Status = "CANCELLED"; return Receipt(n);
    }

    private IQueryable<NotificationRecipient> Inbox(string userId) => db.Set<NotificationRecipient>().AsNoTracking()
        .Where(r => r.UserID == userId && db.Set<Notification>().Any(n => n.ID == r.NotificationID && n.Status == "PUBLISHED"));
    public async Task<NotificationPage> ListAsync(string userId, long? beforeId, int limit, CancellationToken ct)
    {
        var rows = await (from r in Inbox(userId) join n in db.Set<Notification>() on r.NotificationID equals n.ID
                          where !beforeId.HasValue || n.ID < beforeId.Value
                          orderby n.ID descending
                          select new NotificationItem(n.ID, n.Title, n.Content, n.Source,
                              DateTime.SpecifyKind(n.CreatedAt, DateTimeKind.Utc),
                              n.PublishedAt.HasValue ? DateTime.SpecifyKind(n.PublishedAt.Value, DateTimeKind.Utc) : null,
                              r.ReadAt.HasValue ? DateTime.SpecifyKind(r.ReadAt.Value, DateTimeKind.Utc) : null, n.ReferenceType, n.ReferenceID)).Take(Math.Clamp(limit, 1, 100) + 1).ToListAsync(ct);
        var size = Math.Clamp(limit, 1, 100); var more = rows.Count > size;
        return new(rows.Take(size).ToList(), more ? rows[size - 1].Id : null);
    }
    public Task<int> UnreadCountAsync(string userId, CancellationToken ct) => Inbox(userId).CountAsync(r => r.ReadAt == null, ct);
    public async Task ReadAsync(long id, string userId, CancellationToken ct)
    {
        if (!await Inbox(userId).AnyAsync(x => x.NotificationID == id, ct)) throw Missing();
        await Inbox(userId).Where(x => x.NotificationID == id && x.ReadAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTime.UtcNow), ct);
    }
    public Task<int> ReadAllAsync(string userId, CancellationToken ct) => Inbox(userId).Where(x => x.ReadAt == null)
        .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReadAt, DateTime.UtcNow), ct);
    public static NotificationReceipt Receipt(Notification n) => new(n.ID, n.Status, n.ScheduledAt.HasValue ? DateTime.SpecifyKind(n.ScheduledAt.Value, DateTimeKind.Utc) : null, n.RecipientCount);
    private static NotificationReceipt Existing(Notification n, string hash) => n.RequestHash == hash ? Receipt(n)
        : throw new NotificationException(409, "HRM_NOTIFICATION_002", "Idempotency-Key was already used for a different request.");
    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));
    private static NotificationException Missing() => new(404, "HRM_NOTIFICATION_003", "Notification not found.");
    private static NotificationException Conflict() => new(409, "HRM_NOTIFICATION_004", "Notification state no longer allows this operation.");
    public static void AddAudit(AppDbContext db, Notification n, string action, IEnumerable<string> types, int count,
        string? actor = null, string? trace = null)
    {
        db.Add(new AuditLog { ActorUserID = actor ?? n.CreatedByUserID, Action = action, EntityType = "Notification",
            EntityID = n.ID.ToString(CultureInfo.InvariantCulture), CreatedAt = DateTime.UtcNow,
            AfterJSON = JsonSerializer.Serialize(new { notificationId = n.ID, targetTypes = types.Distinct().OrderBy(x => x),
                recipientCount = count, traceId = trace ?? n.TraceID }) });
    }
}
