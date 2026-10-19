using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Performance.Configurations;

public class KpiTemplateConfiguration : IEntityTypeConfiguration<KpiTemplate>
{
    public void Configure(EntityTypeBuilder<KpiTemplate> entity)
    {
        entity.ToTable("kpi_templates");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasColumnType("varchar(200)").HasMaxLength(200).IsRequired();
        entity.Property(x => x.PeriodType).HasColumnName("period_type").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_kpi_templates_code").IsUnique();
    }
}
