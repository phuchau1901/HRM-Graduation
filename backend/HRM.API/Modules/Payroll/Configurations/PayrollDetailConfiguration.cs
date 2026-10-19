using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Payroll.Configurations;

public class PayrollDetailConfiguration : IEntityTypeConfiguration<PayrollDetail>
{
    public void Configure(EntityTypeBuilder<PayrollDetail> entity)
    {
        entity.ToTable("payroll_details");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.PayrollPeriodID).HasColumnName("payroll_period_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.BaseSalary).HasColumnName("base_salary").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired();
        entity.Property(x => x.Allowances).HasColumnName("allowances").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.OvertimePay).HasColumnName("overtime_pay").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.KPIBonus).HasColumnName("kpi_bonus").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.Deductions).HasColumnName("deductions").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.NetSalary).HasColumnName("net_salary").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired();
        entity.Property(x => x.CalculationSnapshot).HasColumnName("calculation_snapshot").HasColumnType("json").IsRequired();
        entity.HasOne<PayrollPeriod>().WithMany().HasForeignKey(x => x.PayrollPeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_details_payroll_period_id");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_details_employee_id");
    }
}
