using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Performance.Services;
public sealed class KpiApprovalModule(AppDbContext db, EmployeeDataScope scopes,IPermissionService permissions,TimeProvider clock):IApprovalModule {
 public string Code=>"PERFORMANCE";
 public IReadOnlyCollection<string> RequestTypes=>["KPI_EVALUATION"];
 public async Task AuthorizeReadAsync(ApprovalRequest a,string actor,CancellationToken ct) {
  if(!await permissions.HasPermissionAsync(actor,KpiScreens.Evaluation,"VIEW",ct))throw BusinessException.Scope();
  var access=await scopes.GetAsync(actor,KpiScreens.Evaluation,"VIEW",ct);var people=access.Apply(db.Employees);
  if(!await db.Set<KpiTarget>().AnyAsync(x=>x.ID==a.ReferenceID && x.EmployeeID==a.EmployeeId && people.Any(e=>e.Id==x.EmployeeID),ct))throw BusinessException.Missing();
 }
 public async Task<object?> GetDetailsAsync(ApprovalRequest a,CancellationToken ct) {
  var target=await db.Set<KpiTarget>().AsNoTracking().SingleOrDefaultAsync(x=>x.ID==a.ReferenceID && x.EmployeeID==a.EmployeeId,ct);
  if(target is null)return null;
  return new {target.ID,target.PeriodKey,target.Status,target.FinalScore,target.ReviewerComment,criteria=KpiService.Read<CriterionSnapshot[]>(target.SnapshotJson),results=await db.Set<KpiResult>().AsNoTracking().Where(x=>x.TargetID==target.ID).OrderBy(x=>x.ID).ToListAsync(ct)};
 }
 public async Task AuthorizeDecisionAsync(ApprovalRequest a,string actor,CancellationToken ct) {
  if(!await permissions.HasPermissionAsync(actor,KpiScreens.Evaluation,"APPROVE",ct))throw BusinessException.Scope();
  var access=await scopes.GetAsync(actor,KpiScreens.Evaluation,"APPROVE",ct);var people=access.Apply(db.Employees);
  var target=await db.Set<KpiTarget>().SingleOrDefaultAsync(x=>x.ID==a.ReferenceID && x.EmployeeID==a.EmployeeId && x.ApprovalId==a.ID && people.Any(e=>e.Id==x.EmployeeID),ct)??throw BusinessException.Missing();
  if(target.Status!="REVIEWED" || !target.PeriodId.HasValue)throw BusinessException.Conflict("KPI is no longer awaiting approval.");
  if(await db.Set<User>().AnyAsync(x=>x.UserId==actor && x.EmployeeId==target.EmployeeID,ct))throw BusinessException.Scope();
  await db.Set<KpiPeriod>().Where(x=>x.ID==target.PeriodId).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
  if(!await db.Set<KpiPeriod>().AnyAsync(x=>x.ID==target.PeriodId && !x.IsClosed,ct))throw BusinessException.Conflict("KPI period is closed.");
 }
 public async Task CompleteAsync(ApprovalRequest a,bool approved,string actor,CancellationToken ct) {
  var t=await db.Set<KpiTarget>().SingleAsync(x=>x.ID==a.ReferenceID,ct);var before=new{t.Status,t.Version};t.Status=approved?"APPROVED":"REJECTED";t.Version++;
  db.Add(new AuditLog {ActorUserID=actor,EntityType="KPI_TARGET",EntityID=t.ID.ToString(),Action=approved?"KPI_APPROVED":"KPI_REJECTED",BeforeJSON=KpiService.Json(before),AfterJSON=KpiService.Json(new{t.Status,t.Version,t.FinalScore}),CreatedAt=clock.GetUtcNow().UtcDateTime});
 }
}
