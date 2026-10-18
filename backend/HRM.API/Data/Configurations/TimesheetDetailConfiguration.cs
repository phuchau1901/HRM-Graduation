using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class TimesheetDetailConfiguration : IEntityTypeConfiguration<TimesheetDetail>
{
    public void Configure(EntityTypeBuilder<TimesheetDetail> entity)
    {
        entity.ToTable("timesheet_details");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.PeriodID).HasColumnName("period_id").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.WorkedDays).HasColumnName("worked_days").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.PaidLeaveDays).HasColumnName("paid_leave_days").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.OvertimeHours).HasColumnName("overtime_hours").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.LateMinutes).HasColumnName("late_minutes").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.CalculatedAt).HasColumnName("calculated_at").IsRequired();
        entity.HasOne<TimesheetPeriod>().WithMany().HasForeignKey(x => x.PeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_timesheet_details_period_id");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_timesheet_details_employee_id");
    }
}
