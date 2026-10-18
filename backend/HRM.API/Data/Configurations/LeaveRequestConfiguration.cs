using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> entity)
    {
        entity.ToTable("leave_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.LeaveTypeID).HasColumnName("leave_type_id").IsRequired();
        entity.Property(x => x.FromDate).HasColumnName("from_date").IsRequired();
        entity.Property(x => x.ToDate).HasColumnName("to_date").IsRequired();
        entity.Property(x => x.RequestedDays).HasColumnName("requested_days").IsRequired();
        entity.Property(x => x.Reason).HasColumnName("reason");
        entity.Property(x => x.Status).HasColumnName("status").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_requests_employee_id");
        entity.HasOne<LeaveType>().WithMany().HasForeignKey(x => x.LeaveTypeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_requests_leave_type_id");
    }
}
