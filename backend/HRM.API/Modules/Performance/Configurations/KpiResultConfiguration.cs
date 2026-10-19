using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Performance.Configurations;

public class KpiResultConfiguration : IEntityTypeConfiguration<KpiResult>
{
    public void Configure(EntityTypeBuilder<KpiResult> entity)
    {
        entity.ToTable("kpi_results");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.TargetID).HasColumnName("target_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.CriterionID).HasColumnName("criterion_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.SelfScore).HasColumnName("self_score").HasColumnType("decimal(8,2)").HasPrecision(8, 2).IsRequired(false);
        entity.Property(x => x.ManagerScore).HasColumnName("manager_score").HasColumnType("decimal(8,2)").HasPrecision(8, 2).IsRequired(false);
        entity.Property(x => x.Comment).HasColumnName("comment").HasColumnType("varchar(1000)").HasMaxLength(1000).IsRequired(false);
        entity.HasOne<KpiTarget>().WithMany().HasForeignKey(x => x.TargetID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_results_target_id");
        entity.HasOne<KpiCriterion>().WithMany().HasForeignKey(x => x.CriterionID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_results_criterion_id");
    }
}
