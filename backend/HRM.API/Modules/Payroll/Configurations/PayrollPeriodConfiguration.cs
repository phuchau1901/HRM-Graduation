using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Payroll.Configurations;

public class PayrollPeriodConfiguration : IEntityTypeConfiguration<PayrollPeriod>
{
    public void Configure(EntityTypeBuilder<PayrollPeriod> entity)
    {
        entity.ToTable("payroll_periods");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.PeriodKey).HasColumnName("period_key").HasColumnType("char(7)").HasMaxLength(7).IsRequired();
        entity.Property(x => x.TimesheetPeriodID).HasColumnName("timesheet_period_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.ApprovedByUserID).HasColumnName("approved_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired(false);
        entity.Property(x => x.PublishedAt).HasColumnName("published_at").HasColumnType("datetime(6)").IsRequired(false);
        entity.HasIndex(x => new { x.PeriodKey }).HasDatabaseName("uq_payroll_periods_period_key").IsUnique();
        entity.HasOne<TimesheetPeriod>().WithMany().HasForeignKey(x => x.TimesheetPeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_periods_timesheet_period_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ApprovedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_periods_approved_by_user_id");
    }
}
