using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Performance.Configurations;

public class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> entity)
    {
        entity.ToTable("performance_reviews");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.TargetID).HasColumnName("target_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.FinalScore).HasColumnName("final_score").HasColumnType("decimal(8,2)").HasPrecision(8, 2).IsRequired();
        entity.Property(x => x.Rating).HasColumnName("rating").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.ReviewedByUserID).HasColumnName("reviewed_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.ReviewedAt).HasColumnName("reviewed_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasIndex(x => new { x.TargetID }).HasDatabaseName("uq_performance_reviews_target_id").IsUnique();
        entity.HasOne<KpiTarget>().WithMany().HasForeignKey(x => x.TargetID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_performance_reviews_target_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ReviewedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_performance_reviews_reviewed_by_user_id");
    }
}
