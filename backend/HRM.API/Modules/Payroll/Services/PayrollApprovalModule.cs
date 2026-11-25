using HRM.API.Common;
using HRM.API.Modules.System.Entities;
using HRM.API.Data;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Payroll.Services;
public sealed class PayrollApprovalModule(AppDbContext db,EmployeeDataScope scopes,IPermissionService permissions,TimeProvider clock):IApprovalModule {
 public string Code=>"PAYROLL";public IReadOnlyCollection<string> RequestTypes=>["PAYROLL_PERIOD"];
 private async Task<PayrollPeriod> Demand(ApprovalRequest a,string actor,string action,CancellationToken ct) {
  if(!await permissions.HasPermissionAsync(actor,PayrollScreens.Payroll,action,ct))throw BusinessException.Scope();
  var access=await scopes.GetAsync(actor,PayrollScreens.Payroll,action,ct);
  var approvalAccess=await scopes.GetAsync(actor,ApprovalWorkflowService.Approvals,action,ct);
  // Approval scope applies to the request's submitter; payroll scope applies to salary data.
  if(!await approvalAccess.Apply(db.Employees).AnyAsync(e=>e.Id==a.EmployeeId,ct))throw BusinessException.Missing();
  var people=access.Apply(db.Employees);
  var p=await PayrollService.VisiblePeriods(db.Set<PayrollPeriod>(),access).SingleOrDefaultAsync(x=>x.ID==a.ReferenceID&&(action=="VIEW"||x.ApprovalId==a.ID),ct)??throw BusinessException.Missing();
  if(await db.Set<PayrollDetail>().AnyAsync(d=>d.PayrollPeriodID==p.ID&&!people.Any(e=>e.Id==d.EmployeeID),ct))throw BusinessException.Scope();return p;
 }
 public async Task AuthorizeReadAsync(ApprovalRequest a,string actor,CancellationToken ct)=>_ =await Demand(a,actor,"VIEW",ct);
 public async Task<object?> GetDetailsAsync(ApprovalRequest a,CancellationToken ct)=>await db.Set<PayrollPeriod>().Where(x=>x.ID==a.ReferenceID).Select(x=>new{x.ID,x.PeriodKey,x.Status,x.Version}).SingleAsync(ct);
 public async Task AuthorizeDecisionAsync(ApprovalRequest a,string actor,CancellationToken ct) {
  var p=await Demand(a,actor,"APPROVE",ct);if(p.Status!="REVIEW"||p.InputHash==null)throw BusinessException.Conflict("Payroll is not awaiting approval.");
  if(actor==a.RequestedByUserID||actor==p.CalculatedBy)throw BusinessException.Scope();
 }
 public async Task CompleteAsync(ApprovalRequest a,bool approved,string actor,CancellationToken ct) {
  var p=await db.Set<PayrollPeriod>().SingleAsync(x=>x.ID==a.ReferenceID&&x.ApprovalId==a.ID,ct);p.Status=approved?"APPROVED":"REVIEW";p.ApprovedByUserID=approved?actor:null;if(!approved)p.ApprovalId=null;p.Version++;
  db.Add(new AuditLog {ActorUserID=actor,EntityType="PayrollPeriod",EntityID=p.ID.ToString(),Action=approved?"PAYROLL_APPROVED":"PAYROLL_REJECTED",AfterJSON=PayrollService.Json(new{p.Status,p.Version}),CreatedAt=clock.GetUtcNow().UtcDateTime});
 }
}
