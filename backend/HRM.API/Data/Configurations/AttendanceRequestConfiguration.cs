using HRM.API.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HRM.API.Data.Configurations;

public class AttendanceRequestConfiguration : IEntityTypeConfiguration<AttendanceRequest>
{
    public void Configure(EntityTypeBuilder<AttendanceRequest> entity)
    {
        entity.ToTable("attendance_requests");
        entity.HasKey(x => x.ID);
        entity.Property(x => x.ID).HasColumnName("id").IsRequired().ValueGeneratedOnAdd();
        entity.Property(x => x.EmployeeID).HasColumnName("employee_id").IsRequired();
        entity.Property(x => x.RequestKey).HasColumnName("request_key").IsRequired();
        entity.Property(x => x.AttendanceID).HasColumnName("attendance_id");
        entity.Property(x => x.Operation).HasColumnName("operation").IsRequired();
        entity.Property(x => x.CreatedAt).HasColumnName("created_at").IsRequired();
        entity.HasIndex(x => new { x.RequestKey }).HasDatabaseName("uq_attendance_requests_request_key").IsUnique();
        entity.HasOne<Employee>().WithMany().HasForeignKey(x => x.EmployeeID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_requests_employee_id");
        entity.HasOne<Attendance>().WithMany().HasForeignKey(x => x.AttendanceID).OnDelete(DeleteBehavior.Restrict).HasConstraintName("fk_attendance_requests_attendance_id");
    }
}
