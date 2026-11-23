namespace HRM.API.Modules.Performance.Entities;
public class KpiMetric {
 public long ID {get;set;}
 public string Code {get;set;} = "";
 public string Name {get;set;} = "";
 public string Unit {get;set;} = "";
 public string Direction {get;set;} = "HIGHER";
 public string Method {get;set;} = "RATIO";
 public string Source {get;set;} = "MANUAL";
 public decimal MaxScore {get;set;} = 100;
 public string MilestonesJson {get;set;} = "[]";
 public bool IsActive {get;set;} = true;
 public long Version {get;set;} = 1;
}
