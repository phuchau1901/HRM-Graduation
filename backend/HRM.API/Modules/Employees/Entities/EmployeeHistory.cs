// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Employees.Entities;

public class EmployeeHistory
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public int? OldDepartmentID { get; set; }
    public int? NewDepartmentID { get; set; }
    public long? OldPositionID { get; set; }
    public long? NewPositionID { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public string? Reason { get; set; }
    public string? ChangedByUserID { get; set; }
}
