// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Attendance.Entities;

public class AttendanceRequest
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public string RequestKey { get; set; } = string.Empty;
    public long? AttendanceID { get; set; }
    public string Operation { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
