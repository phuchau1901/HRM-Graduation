// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Performance.Entities;

public class KpiTarget
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public long TemplateID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string AssignedByUserID { get; set; } = string.Empty;
}
