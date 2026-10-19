using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Payroll.Configurations;

public class SalaryProfileConfiguration : IEntityTypeConfiguration<SalaryProfile>
{
    public void Configure(EntityTypeBuilder<SalaryProfile> entity)
    {
        entity.ToTable("salary_profiles");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.BaseSalary).HasColumnName("base_salary").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired();
        entity.Property(x => x.AllowanceAmount).HasColumnName("allowance_amount").HasColumnType("decimal(18,2)").HasPrecision(18, 2).IsRequired().HasDefaultValue(0.00m);
        entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").HasColumnType("date").IsRequired();
        entity.Property(x => x.EffectiveTo).HasColumnName("effective_to").HasColumnType("date").IsRequired(false);
        entity.Property(x => x.CurrencyCode).HasColumnName("currency_code").HasColumnType("char(3)").HasMaxLength(3).IsRequired().HasDefaultValue("VND");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_salary_profiles_employee_id");
    }
}
