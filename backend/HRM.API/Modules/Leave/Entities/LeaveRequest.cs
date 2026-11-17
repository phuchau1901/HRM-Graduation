// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Leave.Entities;

public class LeaveRequest
{
    public string? BalanceAllocationJson { get; set; }
    public long Version { get; set; } = 1;
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public long LeaveTypeID { get; set; }
    public DateOnly FromDate { get; set; }
    public DateOnly ToDate { get; set; }
    public decimal RequestedDays { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
