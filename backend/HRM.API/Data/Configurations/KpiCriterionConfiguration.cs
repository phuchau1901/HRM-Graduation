using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class KpiCriterionConfiguration : IEntityTypeConfiguration<KpiCriterion>
{
    public void Configure(EntityTypeBuilder<KpiCriterion> entity)
    {
        entity.ToTable("kpi_criteria");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.TemplateID).HasColumnName("template_id").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").IsRequired();
        entity.Property(x => x.WeightPercent).HasColumnName("weight_percent").IsRequired();
        entity.Property(x => x.MaxScore).HasColumnName("max_score").IsRequired();
        entity.HasOne<KpiTemplate>().WithMany().HasForeignKey(x => x.TemplateID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_criteria_template_id");
    }
}
