namespace HRM.API.Modules.Payroll.Entities;

public class PayrollPeriod
{
    public long ID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public long TimesheetPeriodID { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? ApprovedByUserID { get; set; }
    public DateTime? PublishedAt { get; set; }
 public int? DepartmentId {get;set;}
 public string ScopeKey {get;set;}="ALL";
 public long? PolicyId {get;set;}
 public string? CreatedBy {get;set;}
 public string? CalculatedBy {get;set;}
 public long? ApprovalId {get;set;}
 public long Version {get;set;}=1;
 public string? InputHash {get;set;}
 public string? LastCalculationKey {get;set;}
 public string? ErrorsJson {get;set;}
 public DateTime? LockedAt {get;set;}
 public DateTime? PaidAt {get;set;}
 public string? PaymentReference {get;set;}
 public string? PaidBy {get;set;}
}
