namespace HRM.API.Modules.Attendance.Entities;
// Raw server-clock evidence; deliberately has no WorkSchedule/Shift foreign key.
public sealed class UnscheduledAttendance {
 public long ID {get;set;} public int EmployeeID {get;set;} public int? OpenEmployeeKey {get;set;}
 public DateTime StartAtUtc {get;set;} public DateTime? EndAtUtc {get;set;}
 public string Status {get;set;}="OPEN"; public string SettingsSnapshotJson {get;set;}="";
 public long? CheckInQRId {get;set;} public long? CheckOutQRId {get;set;}
 public long? OvertimeRequestId {get;set;} public long? ApprovalId {get;set;}
 public string RecordedByUserId {get;set;}=""; public long Version {get;set;}=1;
}
