namespace HRM.API.Modules.Payroll.Entities;
public sealed class PayrollAdjustment {
 public long ID {get;set;} public long PayrollPeriodId {get;set;} public int EmployeeId {get;set;}
 public long ComponentId {get;set;} public decimal Amount {get;set;} public string Reason {get;set;}="";
 public string ComponentSnapshotJson {get;set;}=""; public string RequestKey {get;set;}="";
 public bool IsCancelled {get;set;} public long Version {get;set;}=1; public string CreatedBy {get;set;}=""; public DateTime CreatedAt {get;set;}
}
