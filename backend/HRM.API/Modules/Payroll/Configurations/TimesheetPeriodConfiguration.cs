using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Payroll.Configurations;

public class TimesheetPeriodConfiguration : IEntityTypeConfiguration<TimesheetPeriod>
{
    public void Configure(EntityTypeBuilder<TimesheetPeriod> entity)
    {
        entity.ToTable("timesheet_periods");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.PeriodKey).HasColumnName("period_key").HasColumnType("char(7)").HasMaxLength(7).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.ClosedAt).HasColumnName("closed_at").HasColumnType("datetime(6)").IsRequired(false);
        entity.Property(x => x.ClosedByUserID).HasColumnName("closed_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired(false);
        entity.HasIndex(x => new { x.PeriodKey }).HasDatabaseName("uq_timesheet_periods_period_key").IsUnique();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ClosedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_timesheet_periods_closed_by_user_id");
    }
}
