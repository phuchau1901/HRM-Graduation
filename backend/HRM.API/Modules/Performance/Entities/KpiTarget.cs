namespace HRM.API.Modules.Performance.Entities;

public class KpiTarget
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public long TemplateID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string AssignedByUserID { get; set; } = string.Empty;
 public long? PeriodId {get;set;}
 public int? ReviewerEmployeeId {get;set;}
 public string? SnapshotJson {get;set;}
 public long Version {get;set;} = 1;
 public decimal? FinalScore {get;set;}
 public string? ReviewerComment {get;set;}
 public DateTime? SubmittedAt {get;set;}
 public long? ApprovalId {get;set;}
}
