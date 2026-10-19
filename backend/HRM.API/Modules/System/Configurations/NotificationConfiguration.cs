using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.System.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> entity)
    {
        entity.ToTable("notifications");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.UserID).HasColumnName("user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.Title).HasColumnName("title").HasColumnType("varchar(200)").HasMaxLength(200).IsRequired();
        entity.Property(x => x.Content).HasColumnName("content").HasColumnType("varchar(1000)").HasMaxLength(1000).IsRequired();
        entity.Property(x => x.IsRead).HasColumnName("is_read").HasColumnType("tinyint(1)").IsRequired().HasDefaultValue(false);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_notifications_user_id");
    }
}
