namespace HRM.API.Modules.Payroll.Entities;

public class PayrollDetail
{
    public long ID { get; set; }
    public long PayrollPeriodID { get; set; }
    public int EmployeeID { get; set; }
    public decimal BaseSalary { get; set; }
    public decimal Allowances { get; set; }
    public decimal OvertimePay { get; set; }
    public decimal KPIBonus { get; set; }
    public decimal Deductions { get; set; }
    public decimal NetSalary { get; set; }
    public string CalculationSnapshot { get; set; } = string.Empty;
 public decimal GrossSalary {get;set;}
 public decimal TaxAmount {get;set;}
 public decimal InsuranceAmount {get;set;}
 public decimal EmployerInsurance {get;set;}
 public string? UniqueKey {get;set;}
 public string? EmployeePeriodKey {get;set;}
}
