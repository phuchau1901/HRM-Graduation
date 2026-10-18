// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class Attendance
{
    public long ID { get; set; }
    public long ScheduleID { get; set; }
    public DateTime? CheckInAt { get; set; }
    public DateTime? CheckOutAt { get; set; }
    public long? CheckInQRID { get; set; }
    public long? CheckOutQRID { get; set; }
    public int LateMinutes { get; set; }
    public int EarlyMinutes { get; set; }
    public string Status { get; set; } = string.Empty;
}
