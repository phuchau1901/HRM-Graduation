using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Employees.Entities;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Attendance.Configurations;

public class AttendanceAdjustmentConfiguration : IEntityTypeConfiguration<AttendanceAdjustment>
{
    public void Configure(EntityTypeBuilder<AttendanceAdjustment> entity)
    {
        entity.ToTable("attendance_adjustments");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.AttendanceID).HasColumnName("attendance_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.ProposedCheckIn).HasColumnName("proposed_check_in").HasColumnType("datetime(6)").IsRequired(false);
        entity.Property(x => x.ProposedCheckOut).HasColumnName("proposed_check_out").HasColumnType("datetime(6)").IsRequired(false);
        entity.Property(x => x.Reason).HasColumnName("reason").HasColumnType("varchar(1000)").HasMaxLength(1000).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.HasOne<AttendanceEntity>().WithMany().HasForeignKey(x => x.AttendanceID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_adjustments_attendance_id");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_adjustments_employee_id");
    }
}
