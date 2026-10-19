using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.System.Configurations;
public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> e)
    {
        e.ToTable("notifications"); e.HasKey(x => x.ID);
        e.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint");
        e.Property(x => x.Title).HasColumnName("title").HasColumnType("varchar(200)").HasMaxLength(200).IsRequired();
        e.Property(x => x.Content).HasColumnName("content").HasColumnType("varchar(1000)").HasMaxLength(1000).IsRequired();
        e.Property(x => x.Source).HasColumnName("source").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        e.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        e.Property(x => x.CreatedByUserID).HasColumnName("created_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100);
        e.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)");
        e.Property(x => x.ScheduledAt).HasColumnName("scheduled_at").HasColumnType("datetime(6)");
        e.Property(x => x.PublishedAt).HasColumnName("published_at").HasColumnType("datetime(6)");
        e.Property(x => x.CancelledAt).HasColumnName("cancelled_at").HasColumnType("datetime(6)");
        e.Property(x => x.ReferenceType).HasColumnName("reference_type").HasColumnType("varchar(60)").HasMaxLength(60);
        e.Property(x => x.ReferenceID).HasColumnName("reference_id").HasColumnType("varchar(100)").HasMaxLength(100);
        e.Property(x => x.DeduplicationKey).HasColumnName("deduplication_key").HasColumnType("varchar(64)").HasMaxLength(64).IsRequired();
        e.Property(x => x.RequestHash).HasColumnName("request_hash").HasColumnType("varchar(64)").HasMaxLength(64).IsRequired();
        e.Property(x => x.TraceID).HasColumnName("trace_id").HasColumnType("varchar(64)").HasMaxLength(64).IsRequired();
        e.Property(x => x.RecipientCount).HasColumnName("recipient_count").HasColumnType("int");
        e.HasIndex(x => x.DeduplicationKey).IsUnique(); e.HasIndex(x => new { x.Status, x.ScheduledAt });
        e.HasOne<User>().WithMany().HasForeignKey(x => x.CreatedByUserID).OnDelete(DeleteBehavior.Restrict);
    }
}
