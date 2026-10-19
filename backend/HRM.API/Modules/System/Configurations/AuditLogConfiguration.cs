using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.System.Configurations;

public class AuditLogConfiguration : IEntityTypeConfiguration<AuditLog>
{
    public void Configure(EntityTypeBuilder<AuditLog> entity)
    {
        entity.ToTable("audit_logs");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.ActorUserID).HasColumnName("actor_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired(false);
        entity.Property(x => x.Action).HasColumnName("action").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.EntityType).HasColumnName("entity_type").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.EntityID).HasColumnName("entity_id").HasColumnType("varchar(60)").HasMaxLength(60).IsRequired();
        entity.Property(x => x.BeforeJSON).HasColumnName("before_json").HasColumnType("json").IsRequired(false);
        entity.Property(x => x.AfterJSON).HasColumnName("after_json").HasColumnType("json").IsRequired(false);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ActorUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_audit_logs_actor_user_id");
    }
}
