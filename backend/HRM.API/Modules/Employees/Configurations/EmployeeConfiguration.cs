using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Employees.Configurations;

public class EmployeeConfiguration
    : IEntityTypeConfiguration<Employee>
{
    public void Configure(EntityTypeBuilder<Employee> builder)
    {
        builder.ToTable("employees");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.EmployeeCode).HasColumnName("EmployeeCode").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();

        builder.HasIndex(x => x.EmployeeCode)
            .IsUnique();

        builder.Property(x => x.FullName).HasColumnName("FullName").HasColumnType("varchar(150)").HasMaxLength(150).IsRequired();

        builder.Property(x => x.Email).HasColumnName("Email").HasColumnType("varchar(255)").HasMaxLength(255).IsRequired();

        builder.HasIndex(x => x.Email)
            .IsUnique();

        builder.Property(x => x.PhoneNumber).HasColumnName("PhoneNumber").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired(false);

        builder.Property(x => x.EmploymentStatus).HasColumnName("EmploymentStatus").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();

        builder.HasOne(x => x.Department)
            .WithMany(x => x.Employees)
            .HasForeignKey(x => x.DepartmentId)
            .OnDelete(DeleteBehavior.Restrict);

        // Explicit Railway column mappings from HRM_DB_COLUMNS.csv.
        builder.Property(x => x.Id).HasColumnName("Id").HasColumnType("int").IsRequired().ValueGeneratedOnAdd();
        builder.Property(x => x.DateOfBirth).HasColumnName("DateOfBirth").HasColumnType("date").IsRequired(false);
        builder.Property(x => x.HireDate).HasColumnName("HireDate").HasColumnType("date").IsRequired();
        builder.Property(x => x.DepartmentId).HasColumnName("DepartmentId").HasColumnType("int").IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnName("CreatedAt").HasColumnType("datetime(6)").IsRequired();
    }
}
