using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Leave.Configurations;

public class LeaveRequestConfiguration : IEntityTypeConfiguration<LeaveRequest>
{
    public void Configure(EntityTypeBuilder<LeaveRequest> entity)
    {
        entity.ToTable("leave_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.LeaveTypeID).HasColumnName("leave_type_id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.FromDate).HasColumnName("from_date").HasColumnType("date").IsRequired();
        entity.Property(x => x.ToDate).HasColumnName("to_date").HasColumnType("date").IsRequired();
        entity.Property(x => x.RequestedDays).HasColumnName("requested_days").HasColumnType("decimal(7,2)").HasPrecision(7, 2).IsRequired();
        entity.Property(x => x.Reason).HasColumnName("reason").HasColumnType("varchar(1000)").HasMaxLength(1000).IsRequired(false);
        entity.Property(x => x.Status).HasColumnName("status").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_requests_employee_id");
        entity.HasOne<LeaveType>().WithMany().HasForeignKey(x => x.LeaveTypeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_leave_requests_leave_type_id");
    }
}
