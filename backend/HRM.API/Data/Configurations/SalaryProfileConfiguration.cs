using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class SalaryProfileConfiguration : IEntityTypeConfiguration<SalaryProfile>
{
    public void Configure(EntityTypeBuilder<SalaryProfile> entity)
    {
        entity.ToTable("salary_profiles");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.BaseSalary).HasColumnName("base_salary").IsRequired();
        entity.Property(x => x.AllowanceAmount).HasColumnName("allowance_amount").IsRequired().HasDefaultValue(0);
        entity.Property(x => x.EffectiveFrom).HasColumnName("effective_from").IsRequired();
        entity.Property(x => x.EffectiveTo).HasColumnName("effective_to");
        entity.Property(x => x.CurrencyCode).HasColumnName("currency_code").IsRequired().HasDefaultValue("VND");
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_salary_profiles_employee_id");
    }
}
