// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class PayrollPeriod
{
    public long ID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public long TimesheetPeriodID { get; set; }
    public string Status { get; set; } = string.Empty;
    public long? ApprovedByUserID { get; set; }
    public DateTime? PublishedAt { get; set; }
}
