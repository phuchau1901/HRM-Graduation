using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Payroll.DTOs;
public static class PayrollScreens { public const string Salary="WEB_SALARY_CONFIGURATION", Payroll="WEB_PAYROLL", Mine="WEB_MY_PAYSLIPS"; }
public class PayrollQuery : PageQuery {
 public int? EmployeeId {get;set;} public int? DepartmentId {get;set;} public int? TeamId {get;set;}
 [StringLength(20)] public string? Status {get;set;}
 [RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$")] public string? PeriodKey {get;set;}
}
public class PayrollVersion { [Range(typeof(long),"1","9223372036854775807")] public long Version {get;set;} }
public class PayrollCalculationRequest : PayrollVersion {
 [Required,StringLength(100),RegularExpression("^[A-Za-z0-9_-]{8,100}$")] public string RequestKey {get;set;}="";
 public long? PolicyId {get;set;}
}
public class SalaryComponentRequest {
 [Required,StringLength(30),RegularExpression("^[A-Z0-9_]+$")] public string Code {get;set;}="";
 [Required,StringLength(150)] public string Name {get;set;}="";
 [Required,RegularExpression("^(EARNING|DEDUCTION)$")] public string Kind {get;set;}="EARNING";
 public bool Taxable {get;set;}=true; public bool TaxDeductible {get;set;} public bool OvertimeIncluded {get;set;}
 public bool IsActive {get;set;}=true; public long Version {get;set;}
}
public sealed record CompensationItem(long ComponentId,string Code,string Name,string Kind,decimal Amount,bool Prorate,bool Taxable,bool TaxDeductible,bool OvertimeIncluded);
public class SalaryItemRequest { public long ComponentId {get;set;} public decimal Amount {get;set;} public bool Prorate {get;set;}=true; }
public class SalaryProfileRequest {
 [Range(1,int.MaxValue)] public int EmployeeId {get;set;}
 public decimal BaseSalary {get;set;} public decimal AllowanceAmount {get;set;} public decimal InsuranceBase {get;set;}
 [Range(0,30)] public int Dependents {get;set;} public decimal KpiBonusAmount {get;set;}
 [Required,RegularExpression("^(MONTH|DAY|HOUR)$")] public string PayBasis {get;set;}="MONTH";
 [Required,RegularExpression("^[A-Z]{3}$")] public string CurrencyCode {get;set;}="VND";
 public DateOnly EffectiveFrom {get;set;} public DateOnly? EffectiveTo {get;set;}
 [Required,StringLength(1000)] public string Reason {get;set;}="";
 [Required,MaxLength(100)] public SalaryItemRequest[] Items {get;set;}=[];
 public long? SupersedeProfileId {get;set;} public long? SupersedeVersion {get;set;}
}
public sealed record TaxBracket(decimal? UpTo,decimal Rate);
public sealed record InsuranceRule(string Code,decimal EmployeeRate,decimal EmployerRate,decimal? BaseCap,decimal BaseFloor,bool TaxDeductible);
public class PayrollRules {
 public string CurrencyCode {get;set;}="VND";
 public decimal? StandardDays {get;set;} public decimal HoursPerDay {get;set;}=8;
 public decimal RoundingStep {get;set;}=1; public string RoundingMode {get;set;}="AWAY_FROM_ZERO";
 public bool PayPublicHolidays {get;set;}
 public TimeOnly NightStart {get;set;} public TimeOnly NightEnd {get;set;}
 public decimal NightWorkPremiumRate {get;set;}
 public Dictionary<string,decimal> OvertimeMultipliers {get;set;}=new();
 public string OvertimeTaxMode {get;set;}="BASE_ONLY";
 public bool IncludeLegacyAllowanceInOvertime {get;set;}
 public string TaxMode {get;set;}="NONE"; public decimal FlatTaxRate {get;set;}
 public decimal PersonalDeduction {get;set;} public decimal DependentDeduction {get;set;}
 public TaxBracket[] TaxBrackets {get;set;}=[];
 public InsuranceRule[] Insurance {get;set;}=[];
 public decimal MinimumPaidDaysForInsurance {get;set;}
 public string InsuranceBaseMode {get;set;}="WEIGHTED";
 public string KpiPeriodType {get;set;}="MONTH"; public decimal KpiScoreCap {get;set;}=100;
 public bool ProrateKpiBonus {get;set;}=true;
}
public class PayrollPolicyRequest {
 [Required,StringLength(40),RegularExpression("^[A-Z0-9_]+$")] public string Code {get;set;}="";
 [Required,StringLength(150)] public string Name {get;set;}="";
 public DateOnly EffectiveFrom {get;set;} public DateOnly? EffectiveTo {get;set;}
 [Required,StringLength(1000)] public string LegalReference {get;set;}="";
 [Required] public PayrollRules Rules {get;set;}=new(); public long Version {get;set;}
}
public class PolicyPublishRequest : PayrollVersion { public long? SupersedePolicyId {get;set;} public long? SupersedeVersion {get;set;} }
public class TimesheetCreateRequest { [Required,RegularExpression(@"^\d{4}-(0[1-9]|1[0-2])$")] public string PeriodKey {get;set;}=""; }
public class PayrollCreateRequest : TimesheetCreateRequest { public int? DepartmentId {get;set;} }
public class PayrollAdjustmentRequest {
 public int EmployeeId {get;set;} public long ComponentId {get;set;} public decimal Amount {get;set;}
 [Required,StringLength(1000)] public string Reason {get;set;}="";
 [Required,StringLength(100),RegularExpression("^[A-Za-z0-9_-]{8,100}$")] public string RequestKey {get;set;}="";
}
public class PayrollPaymentRequest : PayrollVersion {
 [Required,StringLength(150)] public string Reference {get;set;}="";
 public DateTimeOffset PaidAt {get;set;}
}
public sealed record OvertimeSpan(DateTime StartUtc,DateTime EndUtc,long RequestId);
public sealed record TimesheetDay(DateOnly Date,bool Eligible,bool IsWorkingDay,bool IsHoliday,int ScheduledMinutes,int WorkedMinutes,
 decimal PaidLeave,decimal UnpaidLeave,DateTime? RegularStartUtc,DateTime? RegularEndUtc,OvertimeSpan[] Overtime,long? ScheduleId,long? AttendanceId,int LateMinutes);
public sealed record TimesheetSnapshot(int EmployeeId,string PeriodKey,long AttendanceSettingsVersion,decimal StandardDays,
 TimesheetDay[] Days,string[] Errors,string[] Warnings) { public int[] WorkingDays {get;init;}=[1,2,3,4,5]; public DateOnly[] Holidays {get;init;}=[]; }
public sealed record PayrollIssue(int EmployeeId,string Code,string Message);
public sealed record PayrollReceipt(bool Success,long Id,string Status,long Version,int Employees,int Errors);
public sealed record PayslipLine(string Code,string Name,string Kind,decimal Amount,decimal TaxableAmount,bool TaxDeductible,string Formula);
public sealed record SalarySlice(long ProfileId,DateOnly EffectiveFrom,DateOnly? EffectiveTo,string PayBasis,decimal BaseSalary,decimal AllowanceAmount,
 decimal InsuranceBase,int Dependents,decimal KpiBonusAmount,string CurrencyCode,CompensationItem[] Items,long Version);
public sealed record KpiPayInput(long Id,string PeriodKey,string Status,decimal? Score,long Version);
public sealed record CalculationInput(string PeriodKey,TimesheetSnapshot Timesheet,SalarySlice[] Profiles,CompensationItem[] Adjustments,PayrollRules Rules,KpiPayInput? Kpi);
public sealed record PayrollCalculation(decimal BaseSalary,decimal Allowances,decimal OvertimePay,decimal KpiBonus,decimal Gross,
 decimal Tax,decimal Insurance,decimal EmployerInsurance,decimal Deductions,decimal Net,PayslipLine[] Lines);
public sealed class PayrollRow {
 [global::System.Text.Json.Serialization.JsonIgnore] public long? PolicyId {get;set;}
 public string CurrencyCode {get;set;}="";
 public long Id {get;set;} public long PayrollPeriodId {get;set;} public string PeriodKey {get;set;}="";
 public int EmployeeId {get;set;} public string EmployeeCode {get;set;}=""; public string EmployeeName {get;set;}="";
 public string DepartmentName {get;set;}=""; public string? TeamName {get;set;}
 public string Status {get;set;}="";public decimal Gross {get;set;}public decimal Deductions {get;set;}public decimal Net {get;set;}
}
