using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Leave.Configurations;

public class LeaveBalanceConfiguration : IEntityTypeConfiguration<LeaveBalance>
{
    public void Configure(EntityTypeBuilder<LeaveBalance> entity)
    {
        entity.ToTable("leave_balances");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.LeaveTypeID).HasColumnName("leave_type_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.YearNo).HasColumnName("year_no").HasColumnType("smallint").IsRequired();
        entity.Property(x => x.EntitledDays).HasColumnName("entitled_days").HasColumnType("decimal(7,2)").HasPrecision(7, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.UsedDays).HasColumnName("used_days").HasColumnType("decimal(7,2)").HasPrecision(7, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.ReservedDays).HasColumnName("reserved_days").HasColumnType("decimal(7,2)").HasPrecision(7, 2).IsRequired().HasDefaultValue(0.00m);
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_balances_employee_id");
        entity.HasOne<LeaveType>().WithMany().HasForeignKey(x => x.LeaveTypeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_balances_leave_type_id");
    }
}
