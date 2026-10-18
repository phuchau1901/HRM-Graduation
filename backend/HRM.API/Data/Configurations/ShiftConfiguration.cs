using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> entity)
    {
        entity.ToTable("shifts");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.Code).HasColumnName("code").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").IsRequired();
        entity.Property(x => x.StartTime).HasColumnName("start_time").IsRequired();
        entity.Property(x => x.EndTime).HasColumnName("end_time").IsRequired();
        entity.Property(x => x.BreakMinutes).HasColumnName("break_minutes").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.LateGraceMinutes).HasColumnName("late_grace_minutes").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.IsActive).HasColumnName("is_active").IsRequired().HasDefaultValue(true);
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_shifts_code").IsUnique();
    }
}
