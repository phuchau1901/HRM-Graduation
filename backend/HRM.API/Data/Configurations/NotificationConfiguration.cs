using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> entity)
    {
        entity.ToTable("notifications");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.UserID).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").IsRequired();
        entity.Property(x => x.Content).HasColumnName("content").IsRequired();
        entity.Property(x => x.IsRead).HasColumnName("is_read").IsRequired().HasDefaultValue(false);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_notifications_user_id");
    }
}
