using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class KpiResultConfiguration : IEntityTypeConfiguration<KpiResult>
{
    public void Configure(EntityTypeBuilder<KpiResult> entity)
    {
        entity.ToTable("kpi_results");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.TargetID).HasColumnName("target_id").IsRequired();
        entity.Property(x => x.CriterionID).HasColumnName("criterion_id").IsRequired();
        entity.Property(x => x.SelfScore).HasColumnName("self_score");
        entity.Property(x => x.ManagerScore).HasColumnName("manager_score");
        entity.Property(x => x.Comment).HasColumnName("comment");
        entity.HasOne<KpiTarget>().WithMany().HasForeignKey(x => x.TargetID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_results_target_id");
        entity.HasOne<KpiCriterion>().WithMany().HasForeignKey(x => x.CriterionID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_results_criterion_id");
    }
}
