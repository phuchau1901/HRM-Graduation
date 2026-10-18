using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class PayrollPeriodConfiguration : IEntityTypeConfiguration<PayrollPeriod>
{
    public void Configure(EntityTypeBuilder<PayrollPeriod> entity)
    {
        entity.ToTable("payroll_periods");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.PeriodKey).HasColumnName("period_key").IsRequired();
        entity.Property(x => x.TimesheetPeriodID).HasColumnName("timesheet_period_id").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.Property(x => x.ApprovedByUserID).HasColumnName("approved_by_user_id");
        entity.Property(x => x.PublishedAt).HasColumnName("published_at");
        entity.HasIndex(x => new { x.PeriodKey }).HasDatabaseName("uq_payroll_periods_period_key").IsUnique();
        entity.HasOne<TimesheetPeriod>().WithMany().HasForeignKey(x => x.TimesheetPeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_periods_timesheet_period_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ApprovedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_periods_approved_by_user_id");
    }
}
