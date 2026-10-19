using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Performance.Configurations;

public class KpiCriterionConfiguration : IEntityTypeConfiguration<KpiCriterion>
{
    public void Configure(EntityTypeBuilder<KpiCriterion> entity)
    {
        entity.ToTable("kpi_criteria");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.TemplateID).HasColumnName("template_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasColumnType("varchar(200)").HasMaxLength(200).IsRequired();
        entity.Property(x => x.WeightPercent).HasColumnName("weight_percent").HasColumnType("decimal(5,2)").HasPrecision(5, 2).IsRequired();
        entity.Property(x => x.MaxScore).HasColumnName("max_score").HasColumnType("decimal(8,2)").HasPrecision(8, 2).IsRequired();
        entity.HasOne<KpiTemplate>().WithMany().HasForeignKey(x => x.TemplateID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_criteria_template_id");
    }
}
