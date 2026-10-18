using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class PayrollDetailConfiguration : IEntityTypeConfiguration<PayrollDetail>
{
    public void Configure(EntityTypeBuilder<PayrollDetail> entity)
    {
        entity.ToTable("payroll_details");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.PayrollPeriodID).HasColumnName("payroll_period_id").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.BaseSalary).HasColumnName("base_salary").IsRequired();
        entity.Property(x => x.Allowances).HasColumnName("allowances").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.OvertimePay).HasColumnName("overtime_pay").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.KPIBonus).HasColumnName("kpi_bonus").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.Deductions).HasColumnName("deductions").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.NetSalary).HasColumnName("net_salary").IsRequired();
        entity.Property(x => x.CalculationSnapshot).HasColumnName("calculation_snapshot").IsRequired();
        entity.HasOne<PayrollPeriod>().WithMany().HasForeignKey(x => x.PayrollPeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_details_payroll_period_id");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_details_employee_id");
    }
}
