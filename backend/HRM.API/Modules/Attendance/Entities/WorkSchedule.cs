// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Attendance.Entities;

public class WorkSchedule
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public long ShiftID { get; set; }
    public DateOnly WorkDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string UniqueWorkKey { get; set; } = string.Empty;
}
