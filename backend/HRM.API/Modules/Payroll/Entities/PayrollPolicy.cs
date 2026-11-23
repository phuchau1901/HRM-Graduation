namespace HRM.API.Modules.Payroll.Entities;
public sealed class PayrollPolicy {
 public long ID {get;set;} public string Code {get;set;}=""; public string Name {get;set;}="";
 public DateOnly EffectiveFrom {get;set;} public DateOnly? EffectiveTo {get;set;} public string Status {get;set;}="DRAFT";
 public string RulesJson {get;set;}=""; public string LegalReference {get;set;}=""; public long Version {get;set;}=1;
}
