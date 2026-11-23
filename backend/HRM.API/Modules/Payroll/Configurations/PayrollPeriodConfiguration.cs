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
        entity.HasOne<TimesheetPeriod>().WithMany().HasForeignKey(x => x.TimesheetPeriodID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_periods_timesheet_period_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ApprovedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_payroll_periods_approved_by_user_id");
        entity.Property(x=>x.DepartmentId).HasColumnName("department_id");
        entity.Property(x=>x.ScopeKey).HasColumnName("scope_key").HasMaxLength(40).HasDefaultValue("ALL");
        entity.Property(x=>x.PolicyId).HasColumnName("policy_id");
        entity.Property(x=>x.CreatedBy).HasColumnName("created_by").HasMaxLength(100);
        entity.Property(x=>x.CalculatedBy).HasColumnName("calculated_by").HasMaxLength(100);
        entity.Property(x=>x.ApprovalId).HasColumnName("approval_id");
        entity.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
        entity.Property(x=>x.InputHash).HasColumnName("input_hash").HasMaxLength(64);
        entity.Property(x=>x.LastCalculationKey).HasColumnName("last_calculation_key").HasMaxLength(100);
        entity.Property(x=>x.ErrorsJson).HasColumnName("errors_json").HasColumnType("json");
        entity.Property(x=>x.LockedAt).HasColumnName("locked_at");
        entity.Property(x=>x.PaidAt).HasColumnName("paid_at");
        entity.Property(x=>x.PaymentReference).HasColumnName("payment_reference").HasMaxLength(150);
        entity.Property(x=>x.PaidBy).HasColumnName("paid_by").HasMaxLength(100);
        entity.HasIndex(x=>new{x.PeriodKey,x.ScopeKey}).IsUnique();
entity.HasOne<PayrollPolicy>().WithMany().HasForeignKey(x=>x.PolicyId).OnDelete(DeleteBehavior.Restrict);
entity.HasOne<HRM.API.Modules.Organization.Entities.Department>().WithMany().HasForeignKey(x=>x.DepartmentId).OnDelete(DeleteBehavior.Restrict);
entity.HasOne<HRM.API.Modules.Approvals.Entities.ApprovalRequest>().WithMany().HasForeignKey(x=>x.ApprovalId).OnDelete(DeleteBehavior.Restrict);
    }
}
