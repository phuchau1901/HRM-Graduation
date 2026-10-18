using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class TimesheetPeriodConfiguration : IEntityTypeConfiguration<TimesheetPeriod>
{
    public void Configure(EntityTypeBuilder<TimesheetPeriod> entity)
    {
        entity.ToTable("timesheet_periods");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.PeriodKey).HasColumnName("period_key").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.Property(x => x.ClosedAt).HasColumnName("closed_at");
        entity.Property(x => x.ClosedByUserID).HasColumnName("closed_by_user_id");
        entity.HasIndex(x => new { x.PeriodKey }).HasDatabaseName("uq_timesheet_periods_period_key").IsUnique();
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ClosedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_timesheet_periods_closed_by_user_id");
    }
}
