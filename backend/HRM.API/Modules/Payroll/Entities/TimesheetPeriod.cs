// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Payroll.Entities;

public class TimesheetPeriod
{
    public long ID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? ClosedAt { get; set; }
    public string? ClosedByUserID { get; set; }
}
