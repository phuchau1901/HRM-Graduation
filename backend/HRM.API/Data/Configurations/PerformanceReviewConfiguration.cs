using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class PerformanceReviewConfiguration : IEntityTypeConfiguration<PerformanceReview>
{
    public void Configure(EntityTypeBuilder<PerformanceReview> entity)
    {
        entity.ToTable("performance_reviews");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.TargetID).HasColumnName("target_id").IsRequired();
        entity.Property(x => x.FinalScore).HasColumnName("final_score").IsRequired();
        entity.Property(x => x.Rating).HasColumnName("rating").IsRequired();
        entity.Property(x => x.ReviewedByUserID).HasColumnName("reviewed_by_user_id").IsRequired();
        entity.Property(x => x.ReviewedAt).HasColumnName("reviewed_at").IsRequired();
        entity.HasIndex(x => new { x.TargetID }).HasDatabaseName("uq_performance_reviews_target_id").IsUnique();
        entity.HasOne<KpiTarget>().WithMany().HasForeignKey(x => x.TargetID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_performance_reviews_target_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ReviewedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_performance_reviews_reviewed_by_user_id");
    }
}
