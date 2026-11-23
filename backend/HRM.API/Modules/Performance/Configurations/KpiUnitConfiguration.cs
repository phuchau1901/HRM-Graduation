using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Performance.Configurations;
public sealed class KpiUnitConfiguration : IEntityTypeConfiguration<KpiUnit>
{
    public void Configure(EntityTypeBuilder<KpiUnit> e)
    {
        e.ToTable("kpi_units"); e.HasKey(x => x.ID);
        e.Property(x => x.ID).HasColumnName("id").ValueGeneratedOnAdd();
        e.Property(x => x.Code).HasColumnName("code").HasMaxLength(30); e.HasIndex(x => x.Code).IsUnique();
        e.Property(x => x.Name).HasColumnName("name").HasMaxLength(100);
        e.Property(x => x.IsActive).HasColumnName("is_active");
        e.Property(x => x.SortOrder).HasColumnName("sort_order");
        e.Property(x => x.Version).HasColumnName("version").IsConcurrencyToken();
        var codes = new[] { "%", "VND", "Điểm", "Số lượng", "Giờ", "Ngày", "Lần", "Sản phẩm", "Công việc", "Khách hàng", "Hợp đồng" };
        e.HasData(codes.Select((code, index) => new KpiUnit { ID = index + 1, Code = code, Name = code == "%" ? "Phần trăm (%)" : code == "VND" ? "Tiền (VND)" : code, SortOrder = index + 1 }));
    }
}
