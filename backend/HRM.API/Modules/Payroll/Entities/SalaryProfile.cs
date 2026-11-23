namespace HRM.API.Modules.Payroll.Entities;

public class SalaryProfile
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal AllowanceAmount { get; set; }
    public DateOnly EffectiveFrom { get; set; }
    public DateOnly? EffectiveTo { get; set; }
    public string CurrencyCode { get; set; } = string.Empty;
 public string? PayBasis {get;set;}
 public string? ItemsJson {get;set;}
 public decimal InsuranceBase {get;set;}
 public int Dependents {get;set;}
 public decimal KpiBonusAmount {get;set;}
 public string? Reason {get;set;}
 public bool IsVerified {get;set;}
 public long Version {get;set;}=1;
}
