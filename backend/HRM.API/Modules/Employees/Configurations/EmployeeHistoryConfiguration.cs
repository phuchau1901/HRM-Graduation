using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Organization.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Employees.Configurations;

public class EmployeeHistoryConfiguration : IEntityTypeConfiguration<EmployeeHistory>
{
    public void Configure(EntityTypeBuilder<EmployeeHistory> entity)
    {
        entity.ToTable("employee_histories");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.OldDepartmentID).HasColumnName("old_department_id").HasColumnType("int").IsRequired(false);
        entity.Property(x => x.NewDepartmentID).HasColumnName("new_department_id").HasColumnType("int").IsRequired(false);
        entity.Property(x => x.OldPositionID).HasColumnName("old_position_id").HasColumnType("bigint").IsRequired(false);
        entity.Property(x => x.NewPositionID).HasColumnName("new_position_id").HasColumnType("bigint").IsRequired(false);
        entity.Property(x => x.EffectiveDate).HasColumnName("effective_date").HasColumnType("date").IsRequired();
        entity.Property(x => x.Reason).HasColumnName("reason").HasColumnType("varchar(500)").HasMaxLength(500).IsRequired(false);
        entity.Property(x => x.ChangedByUserID).HasColumnName("changed_by_user_id").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired(false);
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_employee_histories_employee_id");
        entity.HasOne<Department>().WithMany().HasForeignKey(x => x.OldDepartmentID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_employee_histories_old_department_id");
        entity.HasOne<Department>().WithMany().HasForeignKey(x => x.NewDepartmentID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_employee_histories_new_department_id");
        entity.HasOne<Position>().WithMany().HasForeignKey(x => x.OldPositionID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_employee_histories_old_position_id");
        entity.HasOne<Position>().WithMany().HasForeignKey(x => x.NewPositionID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_employee_histories_new_position_id");
        entity.HasOne<User>().WithMany().HasForeignKey(x => x.ChangedByUserID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_employee_histories_changed_by_user_id");
    }
}
