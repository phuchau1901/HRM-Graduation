using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class KpiTargetConfiguration : IEntityTypeConfiguration<KpiTarget>
{
    public void Configure(EntityTypeBuilder<KpiTarget> entity)
    {
        entity.ToTable("kpi_targets");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.TemplateID).HasColumnName("template_id").IsRequired();
        entity.Property(x => x.PeriodKey).HasColumnName("period_key").IsRequired();
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.Property(x => x.AssignedByUserID).HasColumnName("assigned_by_user_id").IsRequired();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_targets_employee_id");
        entity.HasOne<KpiTemplate>().WithMany().HasForeignKey(x => x.TemplateID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_targets_template_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.AssignedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_kpi_targets_assigned_by_user_id");
    }
}
