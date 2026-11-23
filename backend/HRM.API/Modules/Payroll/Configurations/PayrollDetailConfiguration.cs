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
        entity.Property(x=>x.GrossSalary).HasColumnName("gross_salary").HasPrecision(18,2);
        entity.Property(x=>x.TaxAmount).HasColumnName("tax_amount").HasPrecision(18,2);
        entity.Property(x=>x.InsuranceAmount).HasColumnName("insurance_amount").HasPrecision(18,2);
        entity.Property(x=>x.EmployerInsurance).HasColumnName("employer_insurance").HasPrecision(18,2);
        entity.Property(x=>x.UniqueKey).HasColumnName("unique_key").HasMaxLength(60);
        entity.Property(x=>x.EmployeePeriodKey).HasColumnName("employee_period_key").HasMaxLength(60);
        entity.HasIndex(x=>x.PayrollPeriodID); entity.HasIndex(x=>x.EmployeeID); entity.HasIndex(x=>x.UniqueKey).IsUnique(); entity.HasIndex(x=>x.EmployeePeriodKey).IsUnique();
    }
}
