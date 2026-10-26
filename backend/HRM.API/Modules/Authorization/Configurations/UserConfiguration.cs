using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Authorization.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> entity)
    {
        entity.ToTable("users");
        entity.HasKey(x => x.UserId);
        entity.Property(x => x.UserId).ValueGeneratedNever().HasColumnName("user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.EmployeeId).HasColumnName("employee_id").HasColumnType("int").IsRequired(false);
        entity.Property(x => x.Email).HasColumnName("email").HasColumnType("varchar(255)").HasMaxLength(255).IsRequired();
        entity.Property(x => x.PasswordHash).HasColumnName("password_hash").HasColumnType("varchar(500)").HasMaxLength(500).IsRequired();
        entity.Property(x => x.Salt).HasColumnName("salt").HasColumnType("varchar(44)").HasMaxLength(44).IsRequired(false);

        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired().HasDefaultValue("ACTIVE");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.Property(x => x.AuthVersion).HasColumnName("auth_version").HasColumnType("bigint").HasDefaultValue(0L).IsRequired();
        entity.HasIndex(x => new { x.EmployeeId }).HasDatabaseName("uq_users_employee_id").IsUnique();
        entity.HasIndex(x => new { x.Email }).HasDatabaseName("uq_users_email").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeId).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_users_employee_id");
    }
}
