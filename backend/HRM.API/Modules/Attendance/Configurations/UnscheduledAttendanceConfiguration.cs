using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Approvals.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
namespace HRM.API.Modules.Attendance.Configurations;
public sealed class UnscheduledAttendanceConfiguration:IEntityTypeConfiguration<UnscheduledAttendance> {
 public void Configure(EntityTypeBuilder<UnscheduledAttendance> e) {
  e.ToTable("unscheduled_attendances");e.HasKey(x=>x.ID);e.Property(x=>x.ID).HasColumnName("id").ValueGeneratedOnAdd();
  e.Property(x=>x.EmployeeID).HasColumnName("employee_id");e.Property(x=>x.OpenEmployeeKey).HasColumnName("open_employee_key");
  e.Property(x=>x.StartAtUtc).HasColumnName("start_at_utc");e.Property(x=>x.EndAtUtc).HasColumnName("end_at_utc");e.Property(x=>x.Status).HasColumnName("status").HasMaxLength(20);
  e.Property(x=>x.SettingsSnapshotJson).HasColumnName("settings_snapshot_json").HasColumnType("json");
  e.Property(x=>x.CheckInQRId).HasColumnName("check_in_qr_id");e.Property(x=>x.CheckOutQRId).HasColumnName("check_out_qr_id");
  e.Property(x=>x.OvertimeRequestId).HasColumnName("overtime_request_id");e.Property(x=>x.ApprovalId).HasColumnName("approval_id");
  e.Property(x=>x.RecordedByUserId).HasColumnName("recorded_by_user_id").HasMaxLength(100);e.Property(x=>x.Version).HasColumnName("version").IsConcurrencyToken();
  e.HasIndex(x=>x.OpenEmployeeKey).IsUnique();e.HasIndex(x=>new{x.EmployeeID,x.StartAtUtc});e.HasIndex(x=>x.OvertimeRequestId);
  e.HasOne<Employee>().WithMany().HasForeignKey(x=>x.EmployeeID).OnDelete(DeleteBehavior.Restrict);
  e.HasOne<User>().WithMany().HasForeignKey(x=>x.RecordedByUserId).OnDelete(DeleteBehavior.Restrict);
  e.HasOne<OvertimeRequest>().WithMany().HasForeignKey(x=>x.OvertimeRequestId).OnDelete(DeleteBehavior.Restrict);
  e.HasOne<ApprovalRequest>().WithMany().HasForeignKey(x=>x.ApprovalId).OnDelete(DeleteBehavior.Restrict);
  e.HasOne<QRSession>().WithMany().HasForeignKey(x=>x.CheckInQRId).OnDelete(DeleteBehavior.Restrict);e.HasOne<QRSession>().WithMany().HasForeignKey(x=>x.CheckOutQRId).OnDelete(DeleteBehavior.Restrict);
 }
}
