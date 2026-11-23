using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Payroll.Configurations;
public sealed class PayrollPolicyConfiguration : IEntityTypeConfiguration<PayrollPolicy> {
 public void Configure(EntityTypeBuilder<PayrollPolicy> entity) {
 entity.ToTable("payroll_policies"); entity.HasKey(x=>x.ID); entity.Property(x=>x.ID).HasColumnName("id").ValueGeneratedOnAdd();
 entity.Property(x=>x.Code).HasColumnName("code").HasMaxLength(40);
 entity.Property(x=>x.Name).HasColumnName("name").HasMaxLength(150);
 entity.Property(x=>x.EffectiveFrom).HasColumnName("effective_from");
 entity.Property(x=>x.EffectiveTo).HasColumnName("effective_to");
 entity.Property(x=>x.Status).HasColumnName("status").HasMaxLength(20);
 entity.Property(x=>x.RulesJson).HasColumnName("rules_json").HasColumnType("json");
 entity.Property(x=>x.LegalReference).HasColumnName("legal_reference").HasMaxLength(1000);
 entity.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
 entity.HasIndex(x=>x.Code).IsUnique(); entity.HasIndex(x=>new{x.Status,x.EffectiveFrom});
 }}
