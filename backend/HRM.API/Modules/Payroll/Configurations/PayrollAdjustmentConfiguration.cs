using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Payroll.Configurations;
public sealed class PayrollAdjustmentConfiguration : IEntityTypeConfiguration<PayrollAdjustment> {
 public void Configure(EntityTypeBuilder<PayrollAdjustment> entity) {
 entity.ToTable("payroll_adjustments"); entity.HasKey(x=>x.ID); entity.Property(x=>x.ID).HasColumnName("id").ValueGeneratedOnAdd();
 entity.Property(x=>x.PayrollPeriodId).HasColumnName("payroll_period_id");
 entity.Property(x=>x.EmployeeId).HasColumnName("employee_id");
 entity.Property(x=>x.ComponentId).HasColumnName("component_id");
 entity.Property(x=>x.Amount).HasColumnName("amount").HasPrecision(18,2);
 entity.Property(x=>x.Reason).HasColumnName("reason").HasMaxLength(1000);
 entity.Property(x=>x.ComponentSnapshotJson).HasColumnName("component_snapshot_json").HasColumnType("json");
 entity.Property(x=>x.RequestKey).HasColumnName("request_key").HasMaxLength(100);
 entity.Property(x=>x.IsCancelled).HasColumnName("is_cancelled");
 entity.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
 entity.Property(x=>x.CreatedBy).HasColumnName("created_by").HasMaxLength(100);
 entity.Property(x=>x.CreatedAt).HasColumnName("created_at");
 entity.HasIndex(x=>x.RequestKey).IsUnique();
entity.HasOne<PayrollPeriod>().WithMany().HasForeignKey(x=>x.PayrollPeriodId).OnDelete(DeleteBehavior.Restrict);
entity.HasOne<HRM.API.Modules.Employees.Entities.Employee>().WithMany().HasForeignKey(x=>x.EmployeeId).OnDelete(DeleteBehavior.Restrict);
entity.HasOne<SalaryComponent>().WithMany().HasForeignKey(x=>x.ComponentId).OnDelete(DeleteBehavior.Restrict);
 }}
