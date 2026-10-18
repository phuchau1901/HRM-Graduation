// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class SalaryProfile
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal AllowanceAmount { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string CurrencyCode { get; set; } = string.Empty;
}
