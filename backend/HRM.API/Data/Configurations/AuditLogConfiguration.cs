using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> entity)
    {
        entity.ToTable("audit_logs");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.ActorUserID).HasColumnName("actor_user_id");
        entity.Property(x => x.Action).HasColumnName("action").IsRequired();
        entity.Property(x => x.EntityType).HasColumnName("entity_type").IsRequired();
        entity.Property(x => x.EntityID).HasColumnName("entity_id").IsRequired();
        entity.Property(x => x.BeforeJSON).HasColumnName("before_json");
        entity.Property(x => x.AfterJSON).HasColumnName("after_json");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_audit_logs_actor_user_id");
    }
}
