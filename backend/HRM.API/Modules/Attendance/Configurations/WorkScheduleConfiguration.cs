using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Attendance.Configurations;

public class WorkScheduleConfiguration : IEntityTypeConfiguration<WorkSchedule>
{
    public void Configure(EntityTypeBuilder<WorkSchedule> entity)
    {
        entity.ToTable("work_schedules");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.ShiftID).HasColumnName("shift_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.WorkDate).HasColumnName("work_date").HasColumnType("date").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired().HasDefaultValue("SCHEDULED");
        entity.Property(x => x.UniqueWorkKey).HasColumnName("unique_work_key").HasColumnType("varchar(80)").HasMaxLength(80).IsRequired();
        entity.HasIndex(x => new { x.UniqueWorkKey }).HasDatabaseName("uq_work_schedules_unique_work_key").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_work_schedules_employee_id");
        entity.HasOne<Shift>().WithMany().HasForeignKey(x => x.ShiftID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_work_schedules_shift_id");
    }
}
