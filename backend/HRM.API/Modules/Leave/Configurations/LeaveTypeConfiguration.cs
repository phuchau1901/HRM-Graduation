using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Leave.Configurations;

public class LeaveTypeConfiguration : IEntityTypeConfiguration<LeaveType>
{
    public void Configure(EntityTypeBuilder<LeaveType> entity)
    {
        entity.ToTable("leave_types");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.Code).HasColumnName("code").HasColumnType("varchar(30)").HasMaxLength(30).IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.Paid).HasColumnName("paid").HasColumnType("tinyint(1)").IsRequired().HasDefaultValue(false);
        entity.Property(x => x.RequiresBalance).HasColumnName("requires_balance").HasColumnType("tinyint(1)").IsRequired().HasDefaultValue(true);
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_leave_types_code").IsUnique();
    }
}
