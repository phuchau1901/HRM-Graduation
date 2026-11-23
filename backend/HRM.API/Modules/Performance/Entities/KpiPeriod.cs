namespace HRM.API.Modules.Performance.Entities;
public class KpiPeriod {
 public long ID {get;set;}
 public string Code {get;set;} = "";
 public string PeriodType {get;set;} = "MONTH";
 public DateOnly StartDate {get;set;}
 public DateOnly EndDate {get;set;}
 public bool IsClosed {get;set;}
 public DateTime? ClosedAt {get;set;}
 public string? ClosedBy {get;set;}
 public long Version {get;set;} = 1;
}
