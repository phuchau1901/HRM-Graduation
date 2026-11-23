using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Performance.Configurations;
public class KpiPeriodConfiguration : IEntityTypeConfiguration<KpiPeriod> {
 public void Configure(EntityTypeBuilder<KpiPeriod> e) {
 e.ToTable("kpi_periods"); e.HasKey(x=>x.ID); e.Property(x=>x.ID).HasColumnName("id").ValueGeneratedOnAdd();
 e.Property(x=>x.Code).HasColumnName("code").HasMaxLength(7); e.HasIndex(x=>x.Code).IsUnique();
 e.Property(x=>x.PeriodType).HasColumnName("period_type").HasMaxLength(20);
 e.Property(x=>x.StartDate).HasColumnName("start_date"); e.Property(x=>x.EndDate).HasColumnName("end_date");
 e.Property(x=>x.IsClosed).HasColumnName("is_closed"); e.Property(x=>x.ClosedAt).HasColumnName("closed_at");
 e.Property(x=>x.ClosedBy).HasColumnName("closed_by").HasMaxLength(100);
 e.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
 }}
