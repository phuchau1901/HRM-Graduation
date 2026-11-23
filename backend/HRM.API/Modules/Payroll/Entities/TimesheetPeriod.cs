namespace HRM.API.Modules.Payroll.Entities;

public class TimesheetPeriod
{
    public long ID { get; set; }
    public string PeriodKey { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime? ClosedAt { get; set; }
    public string? ClosedByUserID { get; set; }
 public long Version {get;set;}=1;
 public string? InputHash {get;set;}
 public string? LastCalculationKey {get;set;}
 public string? ErrorsJson {get;set;}
}
