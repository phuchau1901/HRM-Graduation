using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Performance.Configurations;

public class KpiTargetConfiguration : IEntityTypeConfiguration<KpiTarget>
{
    public void Configure(EntityTypeBuilder<KpiTarget> entity)
    {
        entity.ToTable("kpi_targets");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.TemplateID).HasColumnName("template_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.PeriodKey).HasColumnName("period_key").HasColumnType("varchar(7)").HasMaxLength(7).IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.AssignedByUserID).HasColumnName("assigned_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_targets_employee_id");
        entity.HasOne<KpiTemplate>().WithMany().HasForeignKey(x => x.TemplateID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_targets_template_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.AssignedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_targets_assigned_by_user_id");
        entity.Property(x=>x.PeriodId).HasColumnName("period_id");
        entity.Property(x=>x.ReviewerEmployeeId).HasColumnName("reviewer_employee_id");
        entity.Property(x=>x.SnapshotJson).HasColumnName("snapshot_json").HasColumnType("longtext");
        entity.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
        entity.Property(x=>x.FinalScore).HasColumnName("final_score").HasPrecision(8,2);
        entity.Property(x=>x.ReviewerComment).HasColumnName("reviewer_comment").HasMaxLength(1000);
        entity.Property(x=>x.SubmittedAt).HasColumnName("submitted_at");
        entity.Property(x=>x.ApprovalId).HasColumnName("approval_id");
        entity.HasIndex(x=>new {x.EmployeeID,x.PeriodId}).IsUnique();
        entity.HasIndex(x=>new {x.PeriodId,x.Status});
        entity.HasOne<KpiPeriod>().WithMany().HasForeignKey(x=>x.PeriodId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<Employee>().WithMany().HasForeignKey(x=>x.ReviewerEmployeeId).OnDelete(DeleteBehavior.Restrict);
        entity.HasOne<HRM.API.Modules.Approvals.Entities.ApprovalRequest>().WithMany().HasForeignKey(x=>x.ApprovalId).OnDelete(DeleteBehavior.Restrict);
    }
}
