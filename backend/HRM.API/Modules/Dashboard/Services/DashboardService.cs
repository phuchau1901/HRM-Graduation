using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Dashboard.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Notifications.Services;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Dashboard.Services;
public sealed partial class DashboardService(AppDbContext db,EmployeeDataScope scopes,IPermissionService permissions,
 SystemSettingsService settings,NotificationService notifications,TimeProvider clock) {
 private Task<bool> Has(string actor,string screen,string action,CancellationToken ct)=>permissions.HasPermissionAsync(actor,screen,action,ct);
 private DashboardPeriod Period(DashboardQuery q) {
  var today=VietnamBusinessDate.Today(clock);var from=new DateOnly(q.Year??today.Year,q.Month??today.Month,1);
  return new(from.ToString("yyyy-MM"),from,from.AddMonths(1).AddDays(-1),today);
 }
 private async Task<EmployeeAccess?> Access(string actor,string screen,DashboardQuery q,CancellationToken ct,bool own=false,bool personalScreen=false) {
  if(!await Has(actor,screen,"VIEW",ct))return null;
  EmployeeAccess access;
  if(personalScreen) {
   var person=await (from u in db.Set<User>() join e in db.Employees on u.EmployeeId equals (int?)e.Id where u.UserId==actor&&u.Status=="ACTIVE" select new{e.Id,e.DepartmentId}).SingleOrDefaultAsync(ct);
   if(person==null)return new("SELF",null,null);
   access=new("SELF",person.Id,person.DepartmentId);
  } else access=await scopes.GetAsync(actor,screen,"VIEW",ct);
  if(q.DepartmentId.HasValue&&access.Scope!="ALL"&&q.DepartmentId!=access.DepartmentId)throw BusinessException.Scope();
  return own?new("SELF",access.EmployeeId,access.DepartmentId):access;
 }
 private IQueryable<Employee> People(EmployeeAccess access,DashboardQuery q) {
  var rows=access.Apply(db.Employees.AsNoTracking());return q.DepartmentId.HasValue?rows.Where(e=>e.DepartmentId==q.DepartmentId):rows;
 }
 private static EmployeeAccess Required(EmployeeAccess? access)=>access??throw BusinessException.Scope();
 public async Task<DashboardSummary> Summary(string actor,DashboardQuery q,CancellationToken ct) {
  var p=Period(q);EmployeeMetrics? employees=null;int? leave=null,contracts=null;
  var access=await Access(actor,"WEB_EMPLOYEES",q,ct);
  if(access!=null) {
   var people=People(access,q);
   employees=new(await people.CountAsync(e=>e.EmploymentStatus=="ACTIVE"&&e.HireDate<=p.AsOfDate,ct),await people.CountAsync(e=>e.HireDate>=p.From&&e.HireDate<=p.To&&e.HireDate<=p.AsOfDate,ct),null,"Chưa có ngày nghỉ việc hoặc lịch sử trạng thái để thống kê chính xác theo kỳ.");
  }
  var leaveAccess=await Access(actor,"WEB_LEAVE_REQUESTS",q,ct);
  if(leaveAccess!=null) {var people=People(leaveAccess,q);leave=await db.Set<LeaveRequest>().CountAsync(l=>people.Any(e=>e.Id==l.EmployeeID)&&(l.Status=="APPROVED"||l.Status=="CANCELLATION_PENDING")&&l.FromDate<=p.To&&l.ToDate>=p.From,ct);}
  var contractAccess=await Access(actor,"WEB_CONTRACTS",q,ct);
  if(contractAccess!=null) {var people=People(contractAccess,q);var through=p.AsOfDate.AddDays(30);contracts=await db.Set<Contract>().CountAsync(c=>people.Any(e=>e.Id==c.EmployeeID)&&c.Status=="ACTIVE"&&c.StartDate<=p.AsOfDate&&c.EndDate>=p.AsOfDate&&c.EndDate<=through,ct);}
  AttendanceOverview? attendance=null;
  var attendanceAccess=await Access(actor,"WEB_ATTENDANCE",q,ct);
  if(attendanceAccess!=null)attendance=await Attendance(q,attendanceAccess,ct);
  return new(p,employees,attendance,leave,contracts);
 }
 public async Task<IReadOnlyList<DepartmentSlice>> Departments(string actor,DashboardQuery q,CancellationToken ct) {
  var access=Required(await Access(actor,"WEB_EMPLOYEES",q,ct));var people=People(access,q);var today=Period(q).AsOfDate;
  return await (from e in people join d in db.Departments on e.DepartmentId equals d.Id where e.EmploymentStatus=="ACTIVE"&&e.HireDate<=today group e by new{d.Id,d.DepartmentName} into g orderby g.Count() descending select new DepartmentSlice(g.Key.Id,g.Key.DepartmentName,g.Count())).ToListAsync(ct);
 }
 public async Task<AttendanceOverview> AttendanceTrend(string actor,DashboardQuery q,CancellationToken ct)=>await Attendance(q,Required(await Access(actor,"WEB_ATTENDANCE",q,ct)),ct);
 private async Task<AttendanceOverview> Attendance(DashboardQuery q,EmployeeAccess access,CancellationToken ct) {
  var p=Period(q);var now=clock.GetUtcNow().UtcDateTime;
  var config=await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey,ct);
  var (sql,args)=AttendanceManagementService.BuildReadSql(p.From,p.To,now,access,config.Settings,new DailyAttendanceQuery{DepartmentId=q.DepartmentId},false,db.Database.ProviderName=="Microsoft.EntityFrameworkCore.Sqlite");
  var rows=db.Database.SqlQueryRaw<DailyAttendanceRow>(sql,args).Where(r=>r.WorkDate<=p.AsOfDate);
  // At most 31 grouped rows are materialized. No employee/punch enumeration or per-day queries.
  var daily=await rows.GroupBy(r=>r.WorkDate).Select(g=>new {Date=g.Key,
   Scheduled=g.Count(r=>r.ScheduleId!=null),
   Eligible=g.Count(r=>r.ScheduleId!=null&&!r.IsOnLeave&&!r.IsHoliday&&!r.SnapshotMissing&&r.CheckInCloseUtc<=now),
   Present=g.Count(r=>r.ScheduleId!=null&&!r.IsOnLeave&&!r.IsHoliday&&!r.SnapshotMissing&&r.CheckInCloseUtc<=now&&(r.CheckInAtUtc!=null||r.CheckOutAtUtc!=null)),
   Late=g.Count(r=>r.ScheduleId!=null&&!r.IsOnLeave&&!r.IsHoliday&&!r.SnapshotMissing&&r.CheckInCloseUtc<=now&&r.IsLate),
   Early=g.Count(r=>r.ScheduleId!=null&&!r.IsOnLeave&&!r.IsHoliday&&!r.SnapshotMissing&&r.CheckInCloseUtc<=now&&r.IsEarly),
   Absent=g.Count(r=>r.Status=="ABSENT"&&!r.IsHoliday),
   MissingIn=g.Count(r=>r.Status=="MISSING_CHECK_IN"&&!r.IsOnLeave&&!r.IsHoliday&&!r.SnapshotMissing&&r.CheckInCloseUtc<=now),
   MissingOut=g.Count(r=>r.Status=="MISSING_CHECK_OUT"&&!r.IsOnLeave&&!r.IsHoliday),
   OnLeave=g.Count(r=>r.IsOnLeave),Unverified=g.Count(r=>r.ScheduleId!=null&&r.SnapshotMissing)
  }).OrderBy(r=>r.Date).ToListAsync(ct);
  var points=daily.Select(r=>new AttendancePoint(r.Date,new(){Scheduled=r.Scheduled,Eligible=r.Eligible,Present=r.Present,Late=r.Late,Early=r.Early,Absent=r.Absent,MissingCheckIn=r.MissingIn,MissingCheckOut=r.MissingOut,OnLeave=r.OnLeave,Unverified=r.Unverified})).ToArray();
  return new(p,access.Scope,new(){Scheduled=points.Sum(x=>x.Metrics.Scheduled),Eligible=points.Sum(x=>x.Metrics.Eligible),Present=points.Sum(x=>x.Metrics.Present),Late=points.Sum(x=>x.Metrics.Late),Early=points.Sum(x=>x.Metrics.Early),Absent=points.Sum(x=>x.Metrics.Absent),MissingCheckIn=points.Sum(x=>x.Metrics.MissingCheckIn),MissingCheckOut=points.Sum(x=>x.Metrics.MissingCheckOut),OnLeave=points.Sum(x=>x.Metrics.OnLeave),Unverified=points.Sum(x=>x.Metrics.Unverified)},points);
 }
 public async Task<KpiOverview> Kpi(string actor,DashboardQuery q,CancellationToken ct)=>await Kpi(q,Required(await Access(actor,"WEB_KPI_EVALUATION",q,ct)),ct);
 private async Task<KpiOverview> Kpi(DashboardQuery q,EmployeeAccess access,CancellationToken ct) {
  var p=Period(q);var people=People(access,q);
  var rows=db.Set<KpiTarget>().AsNoTracking().Where(t=>people.Any(e=>e.Id==t.EmployeeID)&&
   (t.PeriodId!=null?db.Set<KpiPeriod>().Any(k=>k.ID==t.PeriodId&&k.StartDate<=p.To&&k.EndDate>=p.From):t.PeriodKey==p.PeriodKey));
  var statuses=await rows.GroupBy(t=>t.Status).Select(g=>new KpiStatusSlice(g.Key,g.Count())).ToListAsync(ct);
  var score=await rows.Where(t=>t.Status=="APPROVED"&&t.FinalScore!=null).AverageAsync(t=>(double?)t.FinalScore,ct);
  return new(p,statuses.Sum(s=>s.Count),statuses.Where(s=>s.Status=="APPROVED").Sum(s=>s.Count),score.HasValue?Math.Round((decimal)score,2):null,statuses);
 }
 public async Task<PayrollOverview> Payroll(string actor,DashboardQuery q,CancellationToken ct)=>await Payroll(q,Required(await Access(actor,"WEB_PAYROLL",q,ct)),false,ct);
 private async Task<PayrollOverview> Payroll(DashboardQuery q,EmployeeAccess access,bool own,CancellationToken ct) {
  var p=Period(q);var people=People(access,q);
  var rows=from d in db.Set<PayrollDetail>().AsNoTracking() join period in db.Set<PayrollPeriod>() on d.PayrollPeriodID equals period.ID
   where people.Any(e=>e.Id==d.EmployeeID)&&period.PeriodKey==p.PeriodKey&&period.InputHash!=null&&d.CalculationSnapshot!=""&&d.CalculationSnapshot!="{}"&&
    (own?(period.Status=="LOCKED"||period.Status=="PAID"):(period.Status=="REVIEW"||period.Status=="APPROVED"||period.Status=="LOCKED"||period.Status=="PAID"))
   select new{Detail=d,period.Status,period.PolicyId};
  PayrollStatusSlice[] statuses;
  if(db.Database.ProviderName=="Microsoft.EntityFrameworkCore.Sqlite") {
   var sums=await rows.GroupBy(x=>x.Status).Select(g=>new{Status=g.Key,Employees=g.Count(),Gross=g.Sum(x=>(double)x.Detail.GrossSalary),Deductions=g.Sum(x=>(double)x.Detail.Deductions),Net=g.Sum(x=>(double)x.Detail.NetSalary)}).ToListAsync(ct);
   statuses=sums.Select(s=>new PayrollStatusSlice(s.Status,s.Employees,Math.Round((decimal)s.Gross,2),Math.Round((decimal)s.Deductions,2),Math.Round((decimal)s.Net,2))).ToArray();
  } else statuses=await rows.GroupBy(x=>x.Status).Select(g=>new PayrollStatusSlice(g.Key,g.Count(),g.Sum(x=>x.Detail.GrossSalary),g.Sum(x=>x.Detail.Deductions),g.Sum(x=>x.Detail.NetSalary))).ToArrayAsync(ct);
  // Policy currency is configurable; never silently label a non-VND payroll VND.
  var policyIds=rows.Select(row=>row.PolicyId);
  var currencies=await db.Set<PayrollPolicy>().Where(policy=>policyIds.Contains((long?)policy.ID)).Select(policy=>policy.RulesJson).ToListAsync(ct);
  var currency=currencies.Select(x=>SettingsDefaults.Read<HRM.API.Modules.Payroll.DTOs.PayrollRules>(x).CurrencyCode).Distinct().ToArray();
  if(currency.Length>1)throw BusinessException.Conflict("Dashboard cannot combine payroll currencies; filter one department/currency.");
  return new(p,access.Scope,currency.FirstOrDefault()??"VND",statuses.Sum(x=>x.Employees),statuses.Sum(x=>x.Gross),statuses.Sum(x=>x.Deductions),statuses.Sum(x=>x.Net),statuses);
 }
 public async Task<MyOverview> Mine(string actor,DashboardQuery q,CancellationToken ct) {
  var p=Period(q);var person=await (from u in db.Set<User>() join e in db.Employees on u.EmployeeId equals (int?)e.Id where u.UserId==actor&&u.Status=="ACTIVE" select new{e.Id,e.FullName}).SingleOrDefaultAsync(ct);
  var inbox=await notifications.ListAsync(actor,null,5,ct);var unread=await notifications.UnreadCountAsync(actor,ct);
  AttendanceOverview? attendance=null;BalanceOverview? balance=null;KpiOverview? kpi=null;PayrollOverview? payroll=null;
  if(person!=null) {
   var a=await Access(actor,"WEB_MY_ATTENDANCE",q,ct,true,true);if(a!=null)attendance=await Attendance(q,a,ct);
   a=await Access(actor,"WEB_LEAVE_BALANCES",q,ct,true,true);
   if(a!=null) {var people=People(a,q);var b=await db.Set<LeaveBalance>().Where(x=>x.YearNo==p.From.Year&&people.Any(e=>e.Id==x.EmployeeID)).GroupBy(x=>1).Select(g=>new{Entitled=g.Sum(x=>(double)(x.EntitledDays+x.CarriedOverDays+x.AdjustmentDays)),Used=g.Sum(x=>(double)x.UsedDays),Reserved=g.Sum(x=>(double)x.ReservedDays)}).SingleOrDefaultAsync(ct);var total=(decimal)(b?.Entitled??0);var used=(decimal)(b?.Used??0);var reserved=(decimal)(b?.Reserved??0);balance=new(total,used,reserved,total-used,total-used-reserved);}
   a=await Access(actor,"WEB_KPI_EVALUATION",q,ct,true);if(a!=null)kpi=await Kpi(q,a,ct);
   a=await Access(actor,"WEB_MY_PAYSLIPS",q,ct,true,true);if(a!=null)payroll=await Payroll(q,a,true,ct);
  }
  return new(p,person!=null,person?.Id,person?.FullName,attendance,balance,kpi,payroll,unread,inbox.Items);
 }
}
