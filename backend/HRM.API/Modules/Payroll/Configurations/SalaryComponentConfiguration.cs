using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Payroll.Configurations;
public sealed class SalaryComponentConfiguration : IEntityTypeConfiguration<SalaryComponent> {
 public void Configure(EntityTypeBuilder<SalaryComponent> entity) {
 entity.ToTable("salary_components"); entity.HasKey(x=>x.ID); entity.Property(x=>x.ID).HasColumnName("id").ValueGeneratedOnAdd();
 entity.Property(x=>x.Code).HasColumnName("code").HasMaxLength(30);
 entity.Property(x=>x.Name).HasColumnName("name").HasMaxLength(150);
 entity.Property(x=>x.Kind).HasColumnName("kind").HasMaxLength(20);
 entity.Property(x=>x.Taxable).HasColumnName("taxable");
 entity.Property(x=>x.TaxDeductible).HasColumnName("tax_deductible");
 entity.Property(x=>x.OvertimeIncluded).HasColumnName("overtime_included");
 entity.Property(x=>x.IsActive).HasColumnName("is_active");
 entity.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
 entity.HasIndex(x=>x.Code).IsUnique();
 }}
