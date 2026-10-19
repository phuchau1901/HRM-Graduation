// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Payroll.Entities;

public class PayrollPeriod
{
    public long ID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public long TimesheetPeriodID { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ApprovedByUserID { get; set; }
    public DateTime? PublishedAt { get; set; }
}
