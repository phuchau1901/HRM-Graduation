using HRM.API.Common;
using HRM.API.Modules.Dashboard.DTOs;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.Performance.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Dashboard.Services;
public sealed partial class DashboardService {
 public async Task<PendingOverview> Pending(string actor,DashboardQuery q,CancellationToken ct) {
  var view=Required(await Access(actor,"WEB_APPROVALS",q,ct));
  if(!await Has(actor,"WEB_APPROVALS","APPROVE",ct))return new(0,[]);
  var decision=await scopes.GetAsync(actor,"WEB_APPROVALS","APPROVE",ct);
  var people=decision.Apply(People(view,q));
  var requests=db.Set<ApprovalRequest>().AsNoTracking().Where(a=>a.Status=="PENDING"&&(a.AllowSelfApproval||a.RequestedByUserID!=actor)&&people.Any(e=>e.Id==a.EmployeeId));
  var steps=db.Set<ApprovalStep>().AsNoTracking();
  requests=requests.Where(a=>steps.Any(s=>s.ApprovalRequestID==a.ID&&s.Decision=="PENDING"&&s.ApproverUserID==actor&&
   (s.ApproverEmployeeId==null||db.Set<User>().Any(u=>u.UserId==actor&&u.Status=="ACTIVE"&&u.EmployeeId==s.ApproverEmployeeId))&&
   !steps.Any(previous=>previous.ApprovalRequestID==a.ID&&previous.Decision=="PENDING"&&previous.StepNo<s.StepNo)));
  // Domain modules that enforce additional salary/KPI grants must also protect task metadata/counts.
  IQueryable<ApprovalRequest> payroll=requests.Where(a=>false),kpi=requests.Where(a=>false);
  if(await Has(actor,"WEB_PAYROLL","VIEW",ct)&&await Has(actor,"WEB_PAYROLL","APPROVE",ct)) {
   var pv=Required(await Access(actor,"WEB_PAYROLL",q,ct));var pa=await scopes.GetAsync(actor,"WEB_PAYROLL","APPROVE",ct);
   var salaryPeople=pa.Apply(People(pv,q));
   payroll=requests.Where(a=>a.RequestType=="PAYROLL_PERIOD"&&db.Set<PayrollPeriod>().Any(p=>p.ID==a.ReferenceID&&p.ApprovalId==a.ID&&p.Status=="REVIEW"&&p.InputHash!=null&&p.CalculatedBy!=actor&&
    (pv.Scope=="ALL"||pv.Scope=="DEPARTMENT"&&p.DepartmentId==pv.DepartmentId)&&(pa.Scope=="ALL"||pa.Scope=="DEPARTMENT"&&p.DepartmentId==pa.DepartmentId)&&
    !db.Set<PayrollDetail>().Any(d=>d.PayrollPeriodID==p.ID&&!salaryPeople.Any(e=>e.Id==d.EmployeeID))));
  }
  if(await Has(actor,"WEB_KPI_EVALUATION","VIEW",ct)&&await Has(actor,"WEB_KPI_EVALUATION","APPROVE",ct)) {
   var ka=await scopes.GetAsync(actor,"WEB_KPI_EVALUATION","APPROVE",ct);var kv=Required(await Access(actor,"WEB_KPI_EVALUATION",q,ct));var kpeople=ka.Apply(People(kv,q));
   kpi=requests.Where(a=>a.RequestType=="KPI_EVALUATION"&&db.Set<KpiTarget>().Any(t=>t.ID==a.ReferenceID&&t.EmployeeID==a.EmployeeId&&t.ApprovalId==a.ID&&t.Status=="REVIEWED"&&kpeople.Any(e=>e.Id==t.EmployeeID)&&
    !db.Set<User>().Any(u=>u.UserId==actor&&u.EmployeeId==t.EmployeeID)&&db.Set<KpiPeriod>().Any(p=>p.ID==t.PeriodId&&!p.IsClosed)));
  }
  var ordinary=new[]{"LEAVE","LEAVE_CANCELLATION","OVERTIME","ATTENDANCE_ADJUSTMENT"};
  var visible=requests.Where(a=>ordinary.Contains(a.RequestType)).Union(payroll).Union(kpi);
  var total=await visible.CountAsync(ct);
  var rows=await (from a in visible join e in db.Employees on a.EmployeeId equals (int?)e.Id orderby a.CreatedAt descending,a.ID descending
   select new {a.ID,a.RequestType,e.FullName,a.CreatedAt,Step=steps.Where(s=>s.ApprovalRequestID==a.ID&&s.Decision=="PENDING").Min(s=>s.StepNo)}).Take(20).ToListAsync(ct);
  return new(total,rows.Select(a=>new PendingTask(a.ID,a.RequestType,a.FullName,a.Step,DateTime.SpecifyKind(a.CreatedAt,DateTimeKind.Utc),$"#/approvals?approvalId={a.ID}")).ToArray());
 }
}
