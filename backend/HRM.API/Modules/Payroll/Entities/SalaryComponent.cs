namespace HRM.API.Modules.Payroll.Entities;
public sealed class SalaryComponent {
 public long ID {get;set;} public string Code {get;set;}=""; public string Name {get;set;}="";
 public string Kind {get;set;}="EARNING"; public bool Taxable {get;set;}=true; public bool TaxDeductible {get;set;}
 public bool OvertimeIncluded {get;set;} public bool IsActive {get;set;}=true; public long Version {get;set;}=1;
}
