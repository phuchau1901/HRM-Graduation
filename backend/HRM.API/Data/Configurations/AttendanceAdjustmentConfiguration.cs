using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class AttendanceAdjustmentConfiguration : IEntityTypeConfiguration<AttendanceAdjustment>
{
    public void Configure(EntityTypeBuilder<AttendanceAdjustment> entity)
    {
        entity.ToTable("attendance_adjustments");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.AttendanceID).HasColumnName("attendance_id").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.ProposedCheckIn).HasColumnName("proposed_check_in");
        entity.Property(x => x.ProposedCheckOut).HasColumnName("proposed_check_out");
        entity.Property(x => x.Reason).HasColumnName("reason").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.HasOne<Attendance>().WithMany().HasForeignKey(x => x.AttendanceID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_adjustments_attendance_id");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_adjustments_employee_id");
    }
}
