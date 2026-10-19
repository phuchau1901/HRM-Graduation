using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Leave.Configurations;

public class OvertimeRequestConfiguration : IEntityTypeConfiguration<OvertimeRequest>
{
    public void Configure(EntityTypeBuilder<OvertimeRequest> entity)
    {
        entity.ToTable("overtime_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.StartAt).HasColumnName("start_at").HasColumnType("datetime(6)").IsRequired();
        entity.Property(x => x.EndAt).HasColumnName("end_at").HasColumnType("datetime(6)").IsRequired();
        entity.Property(x => x.RequestedHours).HasColumnName("requested_hours").HasColumnType("decimal(8,2)").HasPrecision(8, 2).IsRequired();
        entity.Property(x => x.ApprovedHours).HasColumnName("approved_hours").HasColumnType("decimal(8,2)").HasPrecision(8, 2).IsRequired(false);
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_overtime_requests_employee_id");
    }
}
