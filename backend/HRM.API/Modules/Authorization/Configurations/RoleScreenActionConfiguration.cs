using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Authorization.Configurations;
public sealed class RoleScreenActionConfiguration : IEntityTypeConfiguration<RoleScreenAction>
{
    public void Configure(EntityTypeBuilder<RoleScreenAction> e)
    {
        e.ToTable("role_screen_actions");
        e.HasKey(x => new { x.RoleID, x.ScreenID, x.ActionCode });
        e.Property(x => x.RoleID).HasColumnName("role_id").HasColumnType("bigint");
        e.Property(x => x.ScreenID).HasColumnName("screen_id").HasColumnType("bigint");
        e.Property(x => x.ActionCode).HasColumnName("action_code").HasColumnType("varchar(40)").HasMaxLength(40);
        e.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleID).OnDelete(DeleteBehavior.Restrict);
        e.HasOne<Screen>().WithMany().HasForeignKey(x => x.ScreenID).OnDelete(DeleteBehavior.Restrict);
    }
}
