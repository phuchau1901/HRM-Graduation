using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Employees.Entities;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Modules.Attendance.Configurations;

public class AttendanceRequestConfiguration : IEntityTypeConfiguration<AttendanceRequest>
{
    public void Configure(EntityTypeBuilder<AttendanceRequest> entity)
    {
        entity.ToTable("attendance_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).ValueGeneratedOnAdd().HasColumnName("id").HasColumnType("bigint").IsRequired();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").HasColumnType("int").IsRequired();
        entity.Property(x => x.RequestKey).HasColumnName("request_key").HasColumnType("varchar(100)").HasMaxLength(100).IsRequired();
        entity.Property(x => x.AttendanceID).HasColumnName("attendance_id").HasColumnType("bigint").IsRequired(false);
        entity.Property(x => x.Operation).HasColumnName("operation").HasColumnType("varchar(20)").HasMaxLength(20).IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").HasColumnType("datetime(6)").IsRequired();
        entity.HasIndex(x => new { x.RequestKey }).HasDatabaseName("uq_attendance_requests_request_key").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_requests_employee_id");
        entity.HasOne<AttendanceEntity>().WithMany().HasForeignKey(x => x.AttendanceID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_requests_attendance_id");
    }
}
