using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Performance.DTOs;
public static class KpiScreens { public const string Configuration="WEB_KPI_CONFIGURATION", Evaluation="WEB_KPI_EVALUATION"; }
public class KpiQuery : PageQuery {
 public long? PeriodId {get;set;} public int? DepartmentId {get;set;} public int? TeamId {get;set;}
 public int? EmployeeId {get;set;} [StringLength(20)] public string? Status {get;set;}
}
public class KpiVersion { [Range(typeof(long),"1","9223372036854775807")] public long Version {get;set;} }
public class PeriodRequest { [RegularExpression("^(MONTH|QUARTER|YEAR)$")] public string PeriodType {get;set;}="MONTH";
 [Range(2000,2100)] public int Year {get;set;} [Range(1,12)] public int Number {get;set;}=1; }
public record Milestone(decimal Threshold,decimal Score);
public class MetricRequest {
 [Required,StringLength(30),RegularExpression("^[A-Z0-9_]+$")] public string Code {get;set;}="";
 [Required,StringLength(200)] public string Name {get;set;}="";
 [Required,StringLength(30)] public string Unit {get;set;}="";
 [RegularExpression("^(HIGHER|LOWER|QUALITATIVE|MILESTONE)$")] public string Direction {get;set;}="HIGHER";
 [RegularExpression("^(RATIO|DIRECT|MILESTONE)$")] public string Method {get;set;}="RATIO";
 [RegularExpression("^MANUAL$")] public string Source {get;set;}="MANUAL";
 [Range(1,200)] public decimal MaxScore {get;set;}=100;
 [MaxLength(100)] public Milestone[] Milestones {get;set;}=[];
 public bool IsActive {get;set;}=true; public long Version {get;set;}
}
public record MetricSnapshot(string Code,string Name,string Unit,string Direction,string Method,string Source,decimal MaxScore,Milestone[] Milestones);
public record CriterionSnapshot(long CriterionId,MetricSnapshot Metric,decimal WeightPercent,decimal TargetValue);
public class CriterionRequest { [Range(typeof(long),"1","9223372036854775807")] public long MetricId {get;set;}
 [Range(typeof(decimal),"0.01","100",ParseLimitsInInvariantCulture=true,ConvertValueInInvariantCulture=true)] public decimal WeightPercent {get;set;}
 [Range(typeof(decimal),"0","999999999999")] public decimal TargetValue {get;set;} }
public class TemplateRequest {
 [Required,StringLength(30),RegularExpression("^[A-Z0-9_]+$")] public string Code {get;set;}="";
 [Required,StringLength(200)] public string Name {get;set;}="";
 [RegularExpression("^(MONTH|QUARTER|YEAR)$")] public string PeriodType {get;set;}="MONTH";
 public int? DepartmentId {get;set;} public int? TeamId {get;set;} public long? PositionId {get;set;}
 [MinLength(1),MaxLength(100)] public CriterionRequest[] Criteria {get;set;}=[];
 public long Version {get;set;}
}
public class AssignmentRequest {
 [Range(typeof(long),"1","9223372036854775807")] public long PeriodId {get;set;}
 [Range(typeof(long),"1","9223372036854775807")] public long TemplateId {get;set;}
 [Range(1,int.MaxValue)] public int ReviewerEmployeeId {get;set;}
 [Range(1,int.MaxValue)] public int? AlternateReviewerEmployeeId {get;set;}
 [RegularExpression("^(ALL|DEPARTMENT|TEAM|EMPLOYEE)$")] public string Target {get;set;}="EMPLOYEE";
 public int? DepartmentId {get;set;} public int? TeamId {get;set;}
 [MaxLength(1000)] public int[] EmployeeIds {get;set;}=[];
 public long? CopyFromPeriodId {get;set;}
}
public class ResultInput { public long CriterionId {get;set;}
 [Range(typeof(decimal),"0","999999999999")] public decimal ActualValue {get;set;}
 [StringLength(1000)] public string? Comment {get;set;}
 [StringLength(2000)] public string? EvidenceUrl {get;set;}
}
public class ResultsRequest : KpiVersion { [MinLength(1),MaxLength(100)] public ResultInput[] Results {get;set;}=[]; }
public class ReviewRequest : ResultsRequest { [Required,StringLength(1000)] public string Comment {get;set;}=""; }
public sealed class KpiRow {
 public long Id {get;init;} public int EmployeeId {get;init;} public string EmployeeCode {get;init;}=""; public string EmployeeName {get;init;}="";
 public int DepartmentId {get;init;} public string DepartmentName {get;init;}=""; public int? TeamId {get;init;} public string? TeamName {get;init;}
 public long? PositionId {get;init;} public long? PeriodId {get;init;} public string PeriodKey {get;init;}=""; public string Status {get;init;}="";
 public decimal? FinalScore {get;init;} public int? ReviewerEmployeeId {get;init;} public long Version {get;init;} public long? ApprovalId {get;init;}
}
public class KpiUnitQuery : PageQuery { public bool? IsActive {get;set;} }
public class KpiUnitRequest {
 [Required,StringLength(30)] public string Code {get;set;}="";
 [Required,StringLength(100)] public string Name {get;set;}="";
 public bool IsActive {get;set;}=true;
 [Range(0,100000)] public int SortOrder {get;set;}
 public long Version {get;set;}
}
public sealed record KpiTemplateView(long Id, string Code, string Name, string PeriodType, string Status,
 int? DepartmentId, string? DepartmentName, long? PositionId, string? PositionName,
 int? TeamId, string? TeamName, long Version);

// Service metadata stays out of the response body; the controller exposes safe diagnostic headers.
public sealed record KpiTemplateListing(PageResult<KpiTemplateView> Page, string EffectiveScope, bool SearchApplied);
