using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Leave.Configurations;

public class ApprovalStepConfiguration : IEntityTypeConfiguration<ApprovalStep>
{
    public void Configure(EntityTypeBuilder<ApprovalStep> entity)
    {
        entity.ToTable("approval_steps");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.ApprovalRequestID).HasColumnName("approval_request_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.StepNo).HasColumnName("step_no").HasColumnType("int").IsRequired();
        entity.Property(x => x.ApproverUserID).HasColumnName("approver_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.Decision).HasColumnName("decision").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired().HasDefaultValue("PENDING");
        entity.Property(x => x.Comment).HasColumnName("comment").HasColumnType("varchar(1000)").HasMaxLength(1000).IsRequired(false);
        entity.Property(x => x.DecidedAt).HasColumnName("decided_at").HasColumnType("datetime(6)").IsRequired(false);
        entity.HasOne<ApprovalRequest>().WithMany().HasForeignKey(x => x.ApprovalRequestID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_approval_steps_approval_request_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ApproverUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_approval_steps_approver_user_id");
    }
}
