using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Performance.Configurations;
public class KpiMetricConfiguration : IEntityTypeConfiguration<KpiMetric> {
 public void Configure(EntityTypeBuilder<KpiMetric> e) {
 e.ToTable("kpi_metrics"); e.HasKey(x=>x.ID); e.Property(x=>x.ID).HasColumnName("id").ValueGeneratedOnAdd();
 e.Property(x=>x.Code).HasColumnName("code").HasMaxLength(30); e.HasIndex(x=>x.Code).IsUnique();
 e.Property(x=>x.Name).HasColumnName("name").HasMaxLength(200); e.Property(x=>x.Unit).HasColumnName("unit").HasMaxLength(30);
 e.Property(x=>x.UnitId).HasColumnName("unit_id");
 e.HasOne<KpiUnit>().WithMany().HasForeignKey(x=>x.UnitId).OnDelete(DeleteBehavior.Restrict);
 e.Property(x=>x.Direction).HasColumnName("direction").HasMaxLength(20); e.Property(x=>x.Method).HasColumnName("method").HasMaxLength(20);
 e.Property(x=>x.Source).HasColumnName("source").HasMaxLength(30); e.Property(x=>x.MaxScore).HasColumnName("max_score").HasPrecision(8,2);
 e.Property(x=>x.MilestonesJson).HasColumnName("milestones_json").HasColumnType("longtext"); e.Property(x=>x.IsActive).HasColumnName("is_active");
 e.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
 }}
