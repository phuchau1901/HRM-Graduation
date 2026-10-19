using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Leave.Configurations;

public class ApprovalRequestConfiguration : IEntityTypeConfiguration<ApprovalRequest>
{
    public void Configure(EntityTypeBuilder<ApprovalRequest> entity)
    {
        entity.ToTable("approval_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.RequestType).HasColumnName("request_type").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.ReferenceID).HasColumnName("reference_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.RequestedByUserID).HasColumnName("requested_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.RequestedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_approval_requests_requested_by_user_id");
    }
}
