// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class OvertimeRequest
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public DateTime StartAt { get; set; }
    public DateTime EndAt { get; set; }
    public decimal RequestedHours { get; set; }
    public decimal? ApprovedHours { get; set; }
    public string Status { get; set; } = string.Empty;
}
