using HRM.API.Modules.Attendance.Entities;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Attendance.Configurations;

public class AttendanceConfiguration : IEntityTypeConfiguration<AttendanceEntity>
{
    public void Configure(EntityTypeBuilder<AttendanceEntity> entity)
    {
        entity.ToTable("attendances");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.ScheduleID).HasColumnName("schedule_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.CheckInAt).HasColumnName("check_in_at").HasColumnType("datetime(6)").IsRequired(false);
        entity.Property(x => x.CheckOutAt).HasColumnName("check_out_at").HasColumnType("datetime(6)").IsRequired(false);
        entity.Property(x => x.CheckInQRID).HasColumnName("check_in_qr_id").HasColumnType("bigint").IsRequired(false);
        entity.Property(x => x.CheckOutQRID).HasColumnName("check_out_qr_id").HasColumnType("bigint").IsRequired(false);
        entity.Property(x => x.LateMinutes).HasColumnName("late_minutes").HasColumnType("int").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.EarlyMinutes).HasColumnName("early_minutes").HasColumnType("int").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.HasIndex(x => new { x.ScheduleID }).HasDatabaseName("uq_attendances_schedule_id").IsUnique();
        entity.HasOne<WorkSchedule>().WithMany().HasForeignKey(x => x.ScheduleID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendances_schedule_id");
        entity.HasOne<QRSession>().WithMany().HasForeignKey(x => x.CheckInQRID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendances_check_in_qr_id");
        entity.HasOne<QRSession>().WithMany().HasForeignKey(x => x.CheckOutQRID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendances_check_out_qr_id");
    }
}
