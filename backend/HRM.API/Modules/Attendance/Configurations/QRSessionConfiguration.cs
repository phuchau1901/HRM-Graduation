using HRM.API.Modules.Attendance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Attendance.Configurations;

public class QRSessionConfiguration : IEntityTypeConfiguration<QRSession>
{
    public void Configure(EntityTypeBuilder<QRSession> entity)
    {
        entity.ToTable("qr_sessions");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.LocationCode).HasColumnName("location_code").HasColumnType("varchar(50)").HasMaxLength(50).IsRequired();
        entity.Property(x => x.NonceHash).HasColumnName("nonce_hash").HasColumnType("char(64)").HasMaxLength(64).IsRequired();
        entity.Property(x => x.ValidFrom).HasColumnName("valid_from").HasColumnType("datetime(6)").IsRequired();
        entity.Property(x => x.ExpiresAt).HasColumnName("expires_at").HasColumnType("datetime(6)").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.HasIndex(x => new { x.NonceHash }).HasDatabaseName("uq_qr_sessions_nonce_hash").IsUnique();
    }
}
