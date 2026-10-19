using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Authorization.Configurations;

public class UserRoleConfiguration : IEntityTypeConfiguration<UserRole>
{
    public void Configure(EntityTypeBuilder<UserRole> entity)
    {
        entity.ToTable("user_roles");
        entity.HasKey(x => new { x.UserID, x.RoleID });
        entity.Property(x => x.UserID).HasColumnName("user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.RoleID).HasColumnName("role_id").HasColumnType("bigint").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_user_roles_user_id");
        entity.HasOne<Role>().WithMany().HasForeignKey(x => x.RoleID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_user_roles_role_id");
    }
}
