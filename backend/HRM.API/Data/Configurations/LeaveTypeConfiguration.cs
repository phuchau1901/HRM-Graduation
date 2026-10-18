using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class LeaveTypeConfiguration : IEntityTypeConfiguration<LeaveType>
{
    public void Configure(EntityTypeBuilder<LeaveType> entity)
    {
        entity.ToTable("leave_types");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.Code).HasColumnName("code").IsRequired();
        entity.Property(x => x.Name).HasColumnName("name").IsRequired();
        entity.Property(x => x.Paid).HasColumnName("paid").IsRequired().HasDefaultValue(false);
        entity.Property(x => x.RequiresBalance).HasColumnName("requires_balance").IsRequired().HasDefaultValue(true);
        entity.HasIndex(x => new { x.Code }).HasDatabaseName("uq_leave_types_code").IsUnique();
    }
}
