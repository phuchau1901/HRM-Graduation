using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> entity)
    {
        entity.ToTable("refresh_tokens");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.UserID).HasColumnName("user_id").IsRequired();
        entity.Property(x => x.TokenHash).HasColumnName("token_hash").IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
        entity.Property(x => x.RevokedAt).HasColumnName("revoked_at");
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasIndex(x => new { x.TokenHash }).HasDatabaseName("uq_refresh_tokens_token_hash").IsUnique();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_refresh_tokens_user_id");
    }
}
