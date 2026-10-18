using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class ApprovalRequestConfiguration : IEntityTypeConfiguration<ApprovalRequest>
{
    public void Configure(EntityTypeBuilder<ApprovalRequest> entity)
    {
        entity.ToTable("approval_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.RequestType).HasColumnName("request_type").IsRequired();
        entity.Property(x => x.ReferenceID).HasColumnName("reference_id").IsRequired();
        entity.Property(x => x.RequestedByUserID).HasColumnName("requested_by_user_id").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.RequestedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_approval_requests_requested_by_user_id");
    }
}
