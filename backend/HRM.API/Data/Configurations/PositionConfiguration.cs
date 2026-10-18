using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class PositionConfiguration : IEntityTypeConfiguration<Position>
{
    public void Configure(EntityTypeBuilder<Position> entity)
    {
        entity.ToTable("positions");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.Code).HasColumnName("code").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").IsRequired();
        entity.Property(x => x.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_positions_code").IsUnique();
    }
}
