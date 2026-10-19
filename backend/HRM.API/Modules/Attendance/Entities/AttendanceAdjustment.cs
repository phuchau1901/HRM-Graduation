// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Attendance.Entities;

public class AttendanceAdjustment
{
    public long ID { get; set; }
    public long AttendanceID { get; set; }
    public int EmployeeID { get; set; }
    public DateTime? ProposedCheckIn { get; set; }
    public DateTime? ProposedCheckOut { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
}
