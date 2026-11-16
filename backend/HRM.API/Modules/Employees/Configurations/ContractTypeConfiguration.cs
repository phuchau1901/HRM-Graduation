using HRM.API.Modules.Employees.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Employees.Configurations;

public sealed class ContractTypeConfiguration : IEntityTypeConfiguration<ContractType>
{
    public void Configure(EntityTypeBuilder<ContractType> entity)
    {
        entity.ToTable("contract_types");
        entity.HasKey(x => x.Code);
        entity.Property(x => x.Code).HasColumnName("code").HasColumnType("varchar(30)").HasMaxLength(30).ValueGeneratedNever();
        entity.Property(x => x.Name).HasColumnName("name").HasColumnType("varchar(150)").HasMaxLength(150).IsRequired();
        entity.Property(x => x.Description).HasColumnName("description").HasColumnType("varchar(500)").HasMaxLength(500);
        entity.Property(x => x.IsActive).HasColumnName("is_active").HasColumnType("tinyint(1)");
        entity.Property(x => x.SortOrder).HasColumnName("sort_order").HasColumnType("int");
        entity.HasIndex(x => new { x.IsActive, x.SortOrder });
    }
}
