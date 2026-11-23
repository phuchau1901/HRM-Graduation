namespace HRM.API.Modules.Performance.Entities;

public class KpiResult
{
    public long ID { get; set; }
    public long TargetID { get; set; }
    public long CriterionID { get; set; }
    public decimal? SelfScore { get; set; }
    public decimal? ManagerScore { get; set; }
    public string? Comment { get; set; }
 public decimal? ActualValue {get;set;}
 public string? EvidenceUrl {get;set;}
}
