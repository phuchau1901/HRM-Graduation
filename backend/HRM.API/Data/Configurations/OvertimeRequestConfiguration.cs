using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class OvertimeRequestConfiguration : IEntityTypeConfiguration<OvertimeRequest>
{
    public void Configure(EntityTypeBuilder<OvertimeRequest> entity)
    {
        entity.ToTable("overtime_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.StartAt).HasColumnName("start_at").IsRequired();
        entity.Property(x => x.EndAt).HasColumnName("end_at").IsRequired();
        entity.Property(x => x.RequestedHours).HasColumnName("requested_hours").IsRequired();
        entity.Property(x => x.ApprovedHours).HasColumnName("approved_hours");
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_overtime_requests_employee_id");
    }
}
