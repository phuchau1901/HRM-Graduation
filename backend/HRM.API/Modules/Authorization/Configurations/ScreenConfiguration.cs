using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Authorization.Configurations;

public class ScreenConfiguration : IEntityTypeConfiguration<Screen>
{
    public void Configure(EntityTypeBuilder<Screen> builder)
    {
        builder.ToTable("screens");

        builder.HasKey(x => x.ID);

        builder.Property(x => x.ID)
            .HasColumnName("id")
            .ValueGeneratedOnAdd();

        builder.Property(x => x.Code)
            .HasColumnName("code")
            .HasMaxLength(100)
            .IsRequired();

        builder.HasIndex(x => x.Code)
            .IsUnique();

        builder.Property(x => x.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(x => x.Platform)
            .HasColumnName("platform")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(x => x.Route)
            .HasColumnName("route")
            .HasMaxLength(255);

        builder.Property(x => x.Icon)
            .HasColumnName("icon")
            .HasMaxLength(100);

        builder.Property(x => x.ParentID)
            .HasColumnName("parent_id");

        builder.Property(x => x.SortOrder)
            .HasColumnName("sort_order");

        builder.Property(x => x.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(x => x.SupportedActions)
            .HasColumnName("supported_actions")
            .HasColumnType("json")
            .IsRequired();

        builder.HasOne<Screen>()
            .WithMany()
            .HasForeignKey(x => x.ParentID)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
