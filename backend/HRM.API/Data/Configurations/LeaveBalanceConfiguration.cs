using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class LeaveBalanceConfiguration : IEntityTypeConfiguration<LeaveBalance>
{
    public void Configure(EntityTypeBuilder<LeaveBalance> entity)
    {
        entity.ToTable("leave_balances");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.LeaveTypeID).HasColumnName("leave_type_id").IsRequired();
        entity.Property(x => x.YearNo).HasColumnName("year_no").IsRequired();
        entity.Property(x => x.EntitledDays).HasColumnName("entitled_days").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.UsedDays).HasColumnName("used_days").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.ReservedDays).HasColumnName("reserved_days").IsRequired().HasDefaultValue(0);
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_balances_employee_id");
        entity.HasOne<LeaveType>().WithMany().HasForeignKey(x => x.LeaveTypeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_balances_leave_type_id");
    }
}
