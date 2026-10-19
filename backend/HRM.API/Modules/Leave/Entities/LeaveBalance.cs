// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Leave.Entities;

public class LeaveBalance
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public long LeaveTypeID { get; set; }
    public short YearNo { get; set; }
    public decimal EntitledDays { get; set; }
    public decimal UsedDays { get; set; }
    public decimal ReservedDays { get; set; }
}
