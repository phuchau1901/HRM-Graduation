using System.Data;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
namespace HRM.API.Modules.Notifications.Services;

public sealed class NotificationOptions
{
    // Opt in only after the reviewed migration has been applied by the operator.
    public bool WorkerEnabled { get; set; }
    public int PollSeconds { get; set; } = 5;
    public int RecipientBatchSize { get; set; } = 250;
    public int DeliveryBatchSize { get; set; } = 100;
    public int MaxAttempts { get; set; } = 5;
    public int LeaseSeconds { get; set; } = 120;
}
public interface INotificationTransport
{
    // A wake-up event only: no title, body, employee information or push credentials.
    Task NotifyAsync(string userId, long notificationId, string eventId, CancellationToken ct);
}

public sealed class NotificationDispatcher(AppDbContext db, INotificationTransport transport, IOptions<NotificationOptions> options)
{
    public async Task<bool> DistributeNextAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var id = await db.Set<NotificationOutbox>().AsNoTracking()
            .Where(x => (x.Status == "PENDING" || x.Status == "PROCESSING") && x.AvailableAt <= now &&
                (x.LockedUntil == null || x.LockedUntil < now))
            .OrderBy(x => x.AvailableAt).ThenBy(x => x.NotificationID).Select(x => (long?)x.NotificationID).FirstOrDefaultAsync(ct);
        if (id is null) return false;
        var token = Guid.NewGuid().ToString("N"); var lease = now.AddSeconds(options.Value.LeaseSeconds);
        var claimed = await db.Set<NotificationOutbox>().Where(x => x.NotificationID == id &&
            (x.Status == "PENDING" || x.Status == "PROCESSING") && x.AvailableAt <= now && (x.LockedUntil == null || x.LockedUntil < now))
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseToken, token).SetProperty(x => x.LockedUntil, lease)
                .SetProperty(x => x.Status, "PROCESSING").SetProperty(x => x.Attempts, x => x.Attempts + 1), ct);
        if (claimed != 1) return false;
        // ExecuteUpdate bypasses tracking; discard stale job/state from a previous unit of work.
        db.ChangeTracker.Clear();
        try
        {
            // One atomic publication. SERIALIZABLE fixes the audience at publication and coordinates
            // cancel/other workers. Batch INSERTs share the transaction; no network send occurs here.
            await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
            // Lock the notification first, matching cancellation's lock order.
            var n = await db.Set<Notification>().SingleAsync(x => x.ID == id, ct);
            var job = await db.Set<NotificationOutbox>().SingleAsync(x => x.NotificationID == id, ct);
            if (job.LeaseToken != token) return true;
            if (n.Status != "SCHEDULED")
            {
                job.Status = n.Status == "CANCELLED" ? "CANCELLED" : "COMPLETED";
                job.LockedUntil = null; job.LeaseToken = null;
                await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); return true;
            }
            if (job.Attempts > options.Value.MaxAttempts)
                throw new InvalidOperationException("Distribution attempt limit exceeded.");
            var targets = await db.Set<NotificationTarget>().AsNoTracking().Where(x => x.NotificationID == id).ToListAsync(ct);
            var userIds = await NotificationAudience.ResolveAsync(db, targets, ct);
            var publishedAt = DateTime.UtcNow;
            foreach (var batch in userIds.Chunk(options.Value.RecipientBatchSize))
            {
                var recipients = batch.Select(userId => new NotificationRecipient { NotificationID = n.ID,
                    UserID = userId, CreatedAt = publishedAt, NextAttemptAt = publishedAt }).ToArray();
                db.AddRange(recipients); await db.SaveChangesAsync(ct);
                foreach (var recipient in recipients) db.Entry(recipient).State = EntityState.Detached;
            }
            n.Status = "PUBLISHED"; n.PublishedAt = publishedAt; n.RecipientCount = userIds.Count;
            job.Status = "COMPLETED"; job.LeaseToken = null; job.LockedUntil = null; job.LastErrorCode = null;
            NotificationService.AddAudit(db, n, "NOTIFICATION_PUBLISHED", targets.Select(x => x.Type), userIds.Count);
            if (targets.Any(x => x.Type is "ALL" or "ROLE" or "DEPARTMENT" or "CUSTOM" or "USERS"))
                NotificationService.AddAudit(db, n, "NOTIFICATION_GROUP_DISTRIBUTED", targets.Select(x => x.Type), userIds.Count);
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); db.ChangeTracker.Clear();
            return true;
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { db.ChangeTracker.Clear(); throw; }
        catch (Exception)
        {
            db.ChangeTracker.Clear();
            await RecordDistributionFailureAsync(id.Value, token, ct);
            return true;
        }
    }

    private async Task RecordDistributionFailureAsync(long id, string token, CancellationToken ct)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var job = await db.Set<NotificationOutbox>().SingleAsync(x => x.NotificationID == id, ct);
        if (job.LeaseToken != token || job.Status != "PROCESSING") return;
        job.Status = job.Attempts >= options.Value.MaxAttempts ? "DEAD" : "PENDING";
        job.AvailableAt = DateTime.UtcNow.AddSeconds(Backoff(job.Attempts));
        job.LockedUntil = null; job.LeaseToken = null; job.LastErrorCode = "DISTRIBUTION_FAILED";
        var n = await db.Set<Notification>().AsNoTracking().SingleAsync(x => x.ID == id, ct);
        var types = await db.Set<NotificationTarget>().Where(x => x.NotificationID == id).Select(x => x.Type).ToListAsync(ct);
        NotificationService.AddAudit(db, n, job.Status == "DEAD" ? "NOTIFICATION_DISTRIBUTION_FAILED" : "NOTIFICATION_DISTRIBUTION_RETRY", types, n.RecipientCount);
        await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); db.ChangeTracker.Clear();
    }

    public async Task<int> DeliverBatchAsync(CancellationToken ct = default)
    {
        var now = DateTime.UtcNow;
        var pending = await db.Set<NotificationRecipient>().AsNoTracking().Where(x =>
            (x.DeliveryStatus == "PENDING" || x.DeliveryStatus == "RETRY") && x.NextAttemptAt <= now &&
            (x.LockedUntil == null || x.LockedUntil < now) &&
            db.Set<Notification>().Any(n => n.ID == x.NotificationID && n.Status == "PUBLISHED"))
            .OrderBy(x => x.NextAttemptAt).ThenBy(x => x.NotificationID).ThenBy(x => x.UserID)
            .Take(options.Value.DeliveryBatchSize).Select(x => new { x.NotificationID, x.UserID, x.EventID, x.DeliveryAttempts }).ToListAsync(ct);
        var processed = 0;
        foreach (var row in pending)
        {
            now = DateTime.UtcNow;
            var token = Guid.NewGuid().ToString("N"); var lease = now.AddSeconds(options.Value.LeaseSeconds);
            var recipient = db.Set<NotificationRecipient>().Where(x => x.NotificationID == row.NotificationID && x.UserID == row.UserID);
            if (await recipient.Where(x => (x.DeliveryStatus == "PENDING" || x.DeliveryStatus == "RETRY") &&
                    x.NextAttemptAt <= now && x.DeliveryAttempts == row.DeliveryAttempts && (x.LockedUntil == null || x.LockedUntil < now))
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.LeaseToken, token).SetProperty(x => x.LockedUntil, lease)
                    .SetProperty(x => x.DeliveryAttempts, x => x.DeliveryAttempts + 1), ct) != 1) continue;
            var active = await db.Set<User>().AsNoTracking().AnyAsync(x => x.UserId == row.UserID && x.Status == "ACTIVE", ct);
            string state;
            try
            {
                if (active && row.DeliveryAttempts < options.Value.MaxAttempts)
                {
                    using var sendTimeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
                    sendTimeout.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, options.Value.LeaseSeconds / 2)));
                    await transport.NotifyAsync(row.UserID, row.NotificationID, row.EventID, sendTimeout.Token);
                }
                state = !active ? "SKIPPED" : row.DeliveryAttempts >= options.Value.MaxAttempts ? "FAILED" : "SENT";
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception) { state = "RETRY"; }
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var attempts = await recipient.AsNoTracking().Select(x => x.DeliveryAttempts).SingleAsync(ct);
            if (state == "RETRY" && attempts >= options.Value.MaxAttempts) state = "FAILED";
            var next = DateTime.UtcNow.AddSeconds(Backoff(attempts));
            DateTime? sentAt = state == "SENT" ? DateTime.UtcNow : null;
            var updated = await recipient.Where(x => x.LeaseToken == token).ExecuteUpdateAsync(s =>
                s.SetProperty(x => x.DeliveryStatus, state).SetProperty(x => x.SentAt, sentAt)
                    .SetProperty(x => x.NextAttemptAt, next).SetProperty(x => x.LockedUntil, (DateTime?)null)
                    .SetProperty(x => x.LeaseToken, (string?)null), ct);
            if (updated == 1 && state is "RETRY" or "FAILED")
            {
                var n = await db.Set<Notification>().AsNoTracking().SingleAsync(x => x.ID == row.NotificationID, ct);
                var types = await db.Set<NotificationTarget>().Where(x => x.NotificationID == n.ID).Select(x => x.Type).ToListAsync(ct);
                NotificationService.AddAudit(db, n, state == "RETRY" ? "NOTIFICATION_DELIVERY_RETRY" : "NOTIFICATION_DELIVERY_FAILED", types, n.RecipientCount);
            }
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct); processed += updated;
        }
        return processed;
    }
    private static int Backoff(int attempt) => Math.Min(3600, 10 * (1 << Math.Min(attempt, 8)));
}
