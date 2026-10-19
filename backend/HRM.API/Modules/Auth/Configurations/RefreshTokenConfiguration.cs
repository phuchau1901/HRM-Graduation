using HRM.API.Modules.Auth.Entities;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Auth.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> entity)
    {
        entity.ToTable("refresh_tokens");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.UserID).HasColumnName("user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.TokenHash).HasColumnName("token_hash").HasColumnType("char(64)").HasMaxLength(64).IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime(6)").IsRequired();
        entity.Property(x => x.RevokedAt).HasColumnName("revoked_at").HasColumnType("datetime(6)").IsRequired(false);
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasIndex(x => new { x.TokenHash }).HasDatabaseName("uq_refresh_tokens_token_hash").IsUnique();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_refresh_tokens_user_id");
    }
}
