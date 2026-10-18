using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> entity)
    {
        entity.ToTable("users");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id");
        entity.Property(x => x.Username).HasColumnName("username").IsRequired();
        entity.Property(x => x.Email).HasColumnName("email").IsRequired();
        entity.Property(x => x.PasswordHash).HasColumnName("password_hash").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired().HasDefaultValue("ACTIVE");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasIndex(x => new { x.EmployeeID }).HasDatabaseName("uq_users_employee_id").IsUnique();
        entity.HasIndex(x => new { x.Username }).HasDatabaseName("uq_users_username").IsUnique();
        entity.HasIndex(x => new { x.Email }).HasDatabaseName("uq_users_email").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_users_employee_id");
    }
}
