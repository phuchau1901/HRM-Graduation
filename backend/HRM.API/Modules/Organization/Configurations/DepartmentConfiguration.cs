using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Organization.Configurations;

public class DepartmentConfiguration
    : IEntityTypeConfiguration<Department>
{
    public void Configure(EntityTypeBuilder<Department> builder)
    {
        builder.ToTable("departments");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.DepartmentCode).HasColumnName("DepartmentCode").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();

        builder.HasIndex(x => x.DepartmentCode)
            .IsUnique();

        builder.Property(x => x.DepartmentName).HasColumnName("DepartmentName").HasColumnType("varchar(150)").HasMaxLength(150).IsRequired();

        builder.Property(x => x.Description).HasColumnName("Description").HasColumnType("varchar(500)").HasMaxLength(500).IsRequired(false);

        // Explicit Railway column mappings from HRM_DB_COLUMNS.csv.
        builder.Property(x => x.Id).HasColumnName("Id").HasColumnType("int").IsRequired().ValueGeneratedOnAdd();
        builder.Property(x => x.IsActive).HasColumnName("IsActive").HasColumnType("tinyint(1)").IsRequired();
        builder.Property(x => x.CreatedAt).HasColumnName("CreatedAt").HasColumnType("datetime(6)").IsRequired();
    }
}
