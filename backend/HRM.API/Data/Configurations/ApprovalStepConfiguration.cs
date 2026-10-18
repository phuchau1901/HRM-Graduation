using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class ApprovalStepConfiguration : IEntityTypeConfiguration<ApprovalStep>
{
    public void Configure(EntityTypeBuilder<ApprovalStep> entity)
    {
        entity.ToTable("approval_steps");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.ApprovalRequestID).HasColumnName("approval_request_id").IsRequired();
        entity.Property(x => x.StepNo).HasColumnName("step_no").IsRequired();
        entity.Property(x => x.ApproverUserID).HasColumnName("approver_user_id").IsRequired();
        entity.Property(x => x.Decision).HasColumnName("decision").IsRequired().HasDefaultValue("PENDING");
        entity.Property(x => x.Comment).HasColumnName("comment");
        entity.Property(x => x.DecidedAt).HasColumnName("decided_at");
        entity.HasOne<ApprovalRequest>().WithMany().HasForeignKey(x => x.ApprovalRequestID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_approval_steps_approval_request_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ApproverUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_approval_steps_approver_user_id");
    }
}
