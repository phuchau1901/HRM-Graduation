using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> entity)
    {
        entity.ToTable("user_roles");
        entity.HasKey(x => new { x.UserID, x.RoleID });
        entity.Property(x => x.UserID).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.RoleID).HasColumnName("role_id").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_user_roles_user_id");
        entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_user_roles_role_id");
    }
}
