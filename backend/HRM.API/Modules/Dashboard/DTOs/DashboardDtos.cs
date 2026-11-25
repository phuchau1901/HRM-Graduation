using System.ComponentModel.DataAnnotations;
using HRM.API.Modules.Notifications.DTOs;
namespace HRM.API.Modules.Dashboard.DTOs;
public sealed class DashboardQuery {
 [Range(2000,2100)] public int? Year {get;set;}
 [Range(1,12)] public int? Month {get;set;}
 [Range(1,int.MaxValue)] public int? DepartmentId {get;set;}
}
public sealed record DashboardPeriod(string PeriodKey,DateOnly From,DateOnly To,DateOnly AsOfDate);
public sealed record EmployeeMetrics(int Active,int NewHires,int? Departures,string DeparturesNote);
public sealed record DepartmentSlice(int DepartmentId,string DepartmentName,int Employees);
public sealed class AttendanceMetrics {
 public int Scheduled {get;set;} public int Eligible {get;set;} public int Present {get;set;}
 public int Late {get;set;} public int Early {get;set;} public int Absent {get;set;}
 public int MissingCheckIn {get;set;} public int MissingCheckOut {get;set;} public int OnLeave {get;set;}
 public int Unverified {get;set;}
 public decimal? PresenceRate=>Rate(Present); public decimal? LateRate=>Rate(Late); public decimal? EarlyRate=>Rate(Early);
 public decimal? MissingRate=>Rate(MissingCheckIn+MissingCheckOut+Absent);
 private decimal? Rate(int count)=>Eligible==0?null:Math.Round(count*100m/Eligible,2);
}
public sealed record AttendancePoint(DateOnly Date,AttendanceMetrics Metrics);
public sealed record AttendanceOverview(DashboardPeriod Period,string Scope,AttendanceMetrics Totals,IReadOnlyList<AttendancePoint> Days);
public sealed record DashboardSummary(DashboardPeriod Period,EmployeeMetrics? Employees,AttendanceOverview? Attendance,int? ApprovedLeaveRequests,int? ExpiringContracts);
public sealed record KpiStatusSlice(string Status,int Count);
public sealed record KpiOverview(DashboardPeriod Period,int Assigned,int Approved,decimal? AverageApprovedScore,IReadOnlyList<KpiStatusSlice> Statuses);
public sealed record PayrollStatusSlice(string Status,int Employees,decimal Gross,decimal Deductions,decimal Net);
public sealed record PayrollOverview(DashboardPeriod Period,string Scope,string Currency,int Employees,decimal Gross,decimal Deductions,decimal Net,IReadOnlyList<PayrollStatusSlice> Statuses);
public sealed record PendingTask(long Id,string RequestType,string EmployeeName,int StepNo,DateTime CreatedAt,string Href);
public sealed record PendingOverview(int Total,IReadOnlyList<PendingTask> Items);
public sealed record BalanceOverview(decimal Entitled,decimal Used,decimal Reserved,decimal Remaining,decimal Available);
public sealed record MyOverview(DashboardPeriod Period,bool EmployeeLinked,int? EmployeeId,string? EmployeeName,
 AttendanceOverview? Attendance,BalanceOverview? Leave,KpiOverview? Kpi,PayrollOverview? Payroll,int UnreadNotifications,IReadOnlyList<NotificationItem> Notifications);
