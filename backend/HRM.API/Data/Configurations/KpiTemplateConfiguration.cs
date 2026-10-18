using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class KpiTemplateConfiguration : IEntityTypeConfiguration<KpiTemplate>
{
    public void Configure(EntityTypeBuilder<KpiTemplate> entity)
    {
        entity.ToTable("kpi_templates");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.Code).HasColumnName("code").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").IsRequired();
        entity.Property(x => x.PeriodType).HasColumnName("period_type").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_kpi_templates_code").IsUnique();
    }
}
