using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class WorkScheduleConfiguration : IEntityTypeConfiguration<WorkSchedule>
{
    public void Configure(EntityTypeBuilder<WorkSchedule> entity)
    {
        entity.ToTable("work_schedules");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.ShiftID).HasColumnName("shift_id").IsRequired();
        entity.Property(x => x.WorkDate).HasColumnName("work_date").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired().HasDefaultValue("SCHEDULED");
        entity.Property(x => x.UniqueWorkKey).HasColumnName("unique_work_key").IsRequired();
        entity.HasIndex(x => new { x.UniqueWorkKey }).HasDatabaseName("uq_work_schedules_unique_work_key").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_work_schedules_employee_id");
        entity.HasOne<Shift>().WithMany().HasForeignKey(x => x.ShiftID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_work_schedules_shift_id");
    }
}
