// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Payroll.Entities;

public class TimesheetDetail
{
    public long ID { get; set; }
    public long PeriodID { get; set; }
    public int EmployeeID { get; set; }
    public decimal WorkedDays { get; set; }
    public decimal PaidLeaveDays { get; set; }
    public decimal OvertimeHours { get; set; }
    public int LateMinutes { get; set; }
    public DateTime CalculatedAt { get; set; }
}
