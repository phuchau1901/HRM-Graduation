using HRM.API.Modules.Attendance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Attendance.Configurations;

public class ShiftConfiguration : IEntityTypeConfiguration<Shift>
{
    public void Configure(EntityTypeBuilder<Shift> entity)
    {
        entity.ToTable("shifts");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.StartTime).HasColumnName("start_time").HasColumnType("time").IsRequired();
        entity.Property(x => x.EndTime).HasColumnName("end_time").HasColumnType("time").IsRequired();
        entity.Property(x => x.BreakMinutes).HasColumnName("break_minutes").HasColumnType("int").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.LateGraceMinutes).HasColumnName("late_grace_minutes").HasColumnType("int").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.IsActive).HasColumnName("is_active").HasColumnType("tinyint(1)").IsRequired().HasDefaultValue(true);
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_shifts_code").IsUnique();
    }
}
