
using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class DepartmentConfiguration
    : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("departments");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.DepartmentCode)
            .HasMaxLength(20)
            .IsRequired();

        builder.HasIndex(x => x.DepartmentCode)
            .IsUnique();

        builder.Property(x => x.DepartmentName)
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(x => x.Description)
            .HasMaxLength(500);
    }
}
