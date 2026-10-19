using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Payroll.Configurations;

public class TimesheetDetailConfiguration : IEntityTypeConfiguration<TimesheetDetail>
{
    public void Configure(EntityTypeBuilder<TimesheetDetail> entity)
    {
        entity.ToTable("timesheet_details");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.PeriodID).HasColumnName("period_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.WorkedDays).HasColumnName("worked_days").HasColumnType("decimal(7,2)").HasPrecision(7, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.PaidLeaveDays).HasColumnName("paid_leave_days").HasColumnType("decimal(7,2)").HasPrecision(7, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.OvertimeHours).HasColumnName("overtime_hours").HasColumnType("decimal(9,2)").HasPrecision(9, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.LateMinutes).HasColumnName("late_minutes").HasColumnType("int").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.CalculatedAt).HasColumnName("calculated_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasOne<TimesheetPeriod>().WithMany().HasForeignKey(x => x.PeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_timesheet_details_period_id");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_timesheet_details_employee_id");
    }
}
