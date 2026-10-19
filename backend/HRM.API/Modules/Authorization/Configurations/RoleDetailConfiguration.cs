using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Authorization.Configurations;

public class RoleDetailConfiguration
    : IEntityTypeConfiguration<RoleDetail>
{
    public void Configure(EntityTypeBuilder<RoleDetail> builder)
    {
        builder.ToTable("role_details");

        builder.HasKey(x => new { x.RoleID, x.ScreenID });

        builder.Property(x => x.RoleID)
            .HasColumnName("role_id");

        builder.Property(x => x.ScreenID)
            .HasColumnName("screen_id");

        builder.Property(x => x.CanNew)
            .HasColumnName("can_new")
            .HasMaxLength(1)
            .HasDefaultValue("N")
            .IsRequired();

        builder.Property(x => x.CanView)
            .HasColumnName("can_view")
            .HasMaxLength(1)
            .HasDefaultValue("N")
            .IsRequired();

        builder.Property(x => x.CanUpdate)
            .HasColumnName("can_update")
            .HasMaxLength(1)
            .HasDefaultValue("N")
            .IsRequired();

        builder.Property(x => x.CanDelete)
            .HasColumnName("can_delete")
            .HasMaxLength(1)
            .HasDefaultValue("N")
            .IsRequired();

        builder.Property(x => x.CanApprove)
            .HasColumnName("can_approve")
            .HasMaxLength(1)
            .HasDefaultValue("N")
            .IsRequired();

        builder.Property(x => x.CanExport)
            .HasColumnName("can_export")
            .HasMaxLength(1)
            .HasDefaultValue("N")
            .IsRequired();

        builder.HasOne(x => x.Role)
            .WithMany()
            .HasForeignKey(x => x.RoleID)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(x => x.Screen)
            .WithMany(x => x.RoleDetails)
            .HasForeignKey(x => x.ScreenID)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
