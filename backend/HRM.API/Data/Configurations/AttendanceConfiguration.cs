using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class AttendanceConfiguration : IEntityTypeConfiguration<Attendance>
{
    public void Configure(EntityTypeBuilder<Attendance> entity)
    {
        entity.ToTable("attendances");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.ScheduleID).HasColumnName("schedule_id").IsRequired();
        entity.Property(x => x.CheckInAt).HasColumnName("check_in_at");
        entity.Property(x => x.CheckOutAt).HasColumnName("check_out_at");
        entity.Property(x => x.CheckInQRID).HasColumnName("check_in_qr_id");
        entity.Property(x => x.CheckOutQRID).HasColumnName("check_out_qr_id");
        entity.Property(x => x.LateMinutes).HasColumnName("late_minutes").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.EarlyMinutes).HasColumnName("early_minutes").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.HasIndex(x => new { x.ScheduleID }).HasDatabaseName("uq_attendances_schedule_id").IsUnique();
        entity.HasOne<WorkSchedule>().WithMany().HasForeignKey(x => x.ScheduleID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendances_schedule_id");
        entity.HasOne<QRSession>().WithMany().HasForeignKey(x => x.CheckInQRID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendances_check_in_qr_id");
        entity.HasOne<QRSession>().WithMany().HasForeignKey(x => x.CheckOutQRID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendances_check_out_qr_id");
    }
}
