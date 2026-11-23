namespace HRM.API.Modules.Performance.Entities;

public class KpiTemplate
{
    public long ID { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PeriodType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
 public int? DepartmentId {get;set;}
 public int? TeamId {get;set;}
 public long? PositionId {get;set;}
 public long Version {get;set;} = 1;
}
