using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class QRSessionConfiguration : IEntityTypeConfiguration<QRSession>
{
    public void Configure(EntityTypeBuilder<QRSession> entity)
    {
        entity.ToTable("qr_sessions");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.LocationCode).HasColumnName("location_code").IsRequired();
        entity.Property(x => x.NonceHash).HasColumnName("nonce_hash").IsRequired();
        entity.Property(x => x.ValidFrom).HasColumnName("valid_from").IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.HasIndex(x => new { x.NonceHash }).HasDatabaseName("uq_qr_sessions_nonce_hash").IsUnique();
    }
}
