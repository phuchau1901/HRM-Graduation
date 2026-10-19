using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Notifications.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Notifications.Configurations;
public sealed class NotificationTargetConfiguration : IEntityTypeConfiguration<NotificationTarget>
{
    public void Configure(EntityTypeBuilder<NotificationTarget> e)
    {
        e.ToTable("notification_targets"); e.HasKey(x => x.ID);
        e.Property(x => x.ID).HasColumnName("id").HasColumnType("bigint").ValueGeneratedOnAdd();
        e.Property(x => x.NotificationID).HasColumnName("notification_id").HasColumnType("bigint");
        e.Property(x => x.Type).HasColumnName("target_type").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        e.Property(x => x.CriteriaJSON).HasColumnName("criteria_json").HasColumnType("json").IsRequired();
        e.HasOne<Notification>().WithMany().HasForeignKey(x => x.NotificationID).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class NotificationRecipientConfiguration : IEntityTypeConfiguration<NotificationRecipient>
{
    public void Configure(EntityTypeBuilder<NotificationRecipient> e)
    {
        e.ToTable("notification_recipients"); e.HasKey(x => new { x.NotificationID, x.UserID });
        e.Property(x => x.NotificationID).HasColumnName("notification_id").HasColumnType("bigint");
        e.Property(x => x.UserID).HasColumnName("user_id").HasColumnType("varchar(100)").HasMaxLength(100);
        e.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)");
        e.Property(x => x.ReadAt).HasColumnName("read_at").HasColumnType("datetime(6)");
        e.Property(x => x.DeliveryStatus).HasColumnName("delivery_status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        e.Property(x => x.DeliveryAttempts).HasColumnName("delivery_attempts").HasColumnType("int");
        e.Property(x => x.NextAttemptAt).HasColumnName("next_attempt_at").HasColumnType("datetime(6)");
        e.Property(x => x.SentAt).HasColumnName("sent_at").HasColumnType("datetime(6)");
        e.Property(x => x.EventID).HasColumnName("event_id").HasColumnType("varchar(32)").HasMaxLength(32).IsRequired();
        e.Property(x => x.LeaseToken).HasColumnName("lease_token").HasColumnType("varchar(32)").HasMaxLength(32);
        e.Property(x => x.LockedUntil).HasColumnName("locked_until").HasColumnType("datetime(6)");
        e.HasIndex(x => new { x.UserID, x.ReadAt, x.NotificationID });
        e.HasIndex(x => new { x.DeliveryStatus, x.NextAttemptAt, x.LockedUntil });
        e.HasOne<Notification>().WithMany().HasForeignKey(x => x.NotificationID).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict);
    }
}
public sealed class NotificationOutboxConfiguration : IEntityTypeConfiguration<NotificationOutbox>
{
    public void Configure(EntityTypeBuilder<NotificationOutbox> e)
    {
        e.ToTable("notification_outbox"); e.HasKey(x => x.NotificationID);
        e.Property(x => x.NotificationID).HasColumnName("notification_id").HasColumnType("bigint").ValueGeneratedNever();
        e.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        e.Property(x => x.AvailableAt).HasColumnName("available_at").HasColumnType("datetime(6)");
        e.Property(x => x.Attempts).HasColumnName("attempts").HasColumnType("int");
        e.Property(x => x.LeaseToken).HasColumnName("lease_token").HasColumnType("varchar(32)").HasMaxLength(32);
        e.Property(x => x.LockedUntil).HasColumnName("locked_until").HasColumnType("datetime(6)");
        e.Property(x => x.LastErrorCode).HasColumnName("last_error_code").HasColumnType("varchar(40)").HasMaxLength(40);
        e.HasIndex(x => new { x.Status, x.AvailableAt, x.LockedUntil });
        e.HasOne<Notification>().WithMany().HasForeignKey(x => x.NotificationID).OnDelete(DeleteBehavior.Restrict);
    }
}
