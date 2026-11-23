using System.Data;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.Approvals.Services;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.Performance.Services;
public sealed partial class KpiService(AppDbContext db, EmployeeDataScope scopes, IPermissionService permissions, TimeProvider clock, NotificationService notifications, ApprovalWorkflowService workflows, ILogger<KpiService> logger) {
 internal static readonly JsonSerializerOptions JsonOptions=new(JsonSerializerDefaults.Web);
 internal static string Json(object value)=>JsonSerializer.Serialize(value,JsonOptions);
 internal static T Read<T>(string? value)=>value is null?throw BusinessException.Conflict("Legacy KPI has no verified snapshot; assign a new KPI."):JsonSerializer.Deserialize<T>(value,JsonOptions)??throw BusinessException.Conflict("Invalid KPI snapshot.");
 private DateTime Now=>clock.GetUtcNow().UtcDateTime;
 private async Task<EmployeeAccess> Access(string actor,string screen,string action,CancellationToken ct) {
  if(!await permissions.HasPermissionAsync(actor,screen,action,ct)) throw BusinessException.Scope();
  return await scopes.GetAsync(actor,screen,action,ct);
 }
 private async Task<EmployeeAccess> Configuration(string actor,string action,CancellationToken ct,bool global=false) {
  var a=await Access(actor,KpiScreens.Configuration,action,ct);
  if(action!="VIEW") { a.DemandWrite(); if(global && a.Scope!="ALL") throw BusinessException.Scope(); }
  return a;
 }
 private async Task<T> Transaction<T>(Func<Task<T>> action,CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
  try {var result=await action(); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return result;}
  catch(DbUpdateConcurrencyException) {throw BusinessException.Conflict("KPI changed; reload and retry.");}
  catch(Exception e) when(IsConcurrency(e)) {throw BusinessException.Conflict("Concurrent KPI operation; reload and retry.");}
 }
 private static bool IsConcurrency(Exception e)=>e is MySqlException { Number:1213 or 1205 or 1062 } || e.InnerException is not null && IsConcurrency(e.InnerException);
 private void Audit(string actor,string entity,long id,string action,object? before,object? after)=>db.Set<AuditLog>().Add(new() {
  ActorUserID=actor,EntityType=entity,EntityID=id.ToString(),Action=action,BeforeJSON=before is null?null:before is string snapshot?snapshot:Json(before),AfterJSON=after is null?null:Json(after),CreatedAt=Now });
 private static void Version(long actual,long expected) {if(actual!=expected) throw BusinessException.Conflict("KPI version changed; reload before saving.");}
 private async Task<KpiPeriod> OpenPeriod(long id,CancellationToken ct) {
  await db.Set<KpiPeriod>().Where(x=>x.ID==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
  var p=await db.Set<KpiPeriod>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();
  await db.Entry(p).ReloadAsync(ct); if(p.IsClosed) throw BusinessException.Conflict("KPI period is closed."); return p;
 }
 public async Task<object> Lookups(string actor,CancellationToken ct,bool config) {
  var a=await Access(actor,config?KpiScreens.Configuration:KpiScreens.Evaluation,"VIEW",ct);
  var employees=a.Apply(db.Employees);
  var departments=await db.Set<Department>().AsNoTracking().Where(d=>d.IsActive && (a.Scope=="ALL" || employees.Any(e=>e.DepartmentId==d.Id))).OrderBy(d=>d.DepartmentName).Select(d=>new {d.Id,d.DepartmentName}).ToListAsync(ct);
  var teams=await db.Set<Team>().AsNoTracking().Where(t=>t.IsActive && (a.Scope=="ALL" || a.Scope=="DEPARTMENT" && t.DepartmentId==a.DepartmentId || employees.Any(e=>e.TeamId==t.Id))).OrderBy(t=>t.TeamName).Select(t=>new{t.Id,t.TeamName,t.DepartmentId}).ToListAsync(ct);
  var positions=await db.Set<Position>().AsNoTracking().Where(x=>x.IsActive).OrderBy(x=>x.Name).Select(x=>new{id=x.ID,x.Name}).ToListAsync(ct);
  return new {departments,teams,positions};
 }
 public async Task<object> Periods(string actor,PageQuery q,CancellationToken ct,bool evaluation=false) {
  await Access(actor,evaluation?KpiScreens.Evaluation:KpiScreens.Configuration,"VIEW",ct);
  var query=db.Set<KpiPeriod>().AsNoTracking(); if(!string.IsNullOrWhiteSpace(q.Search)) query=query.Where(x=>x.Code.Contains(q.Search));
  return new PageResult<KpiPeriod>(true,await query.CountAsync(ct),q.Page,q.PageSize,await query.OrderByDescending(x=>x.StartDate).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct));
 }
 public Task<KpiPeriod> CreatePeriod(string actor,PeriodRequest r,CancellationToken ct)=>Transaction(async()=> {
  await Configuration(actor,"NEW",ct,true);
  if(r.PeriodType=="QUARTER" && r.Number>4 || r.PeriodType=="YEAR" && r.Number!=1) throw BusinessException.Invalid("Invalid period number.");
  var start=new DateOnly(r.Year,r.PeriodType=="MONTH"?r.Number:r.PeriodType=="QUARTER"?(r.Number-1)*3+1:1,1);
  var p=new KpiPeriod {Code=r.PeriodType=="MONTH"?$"{r.Year}-{r.Number:00}":r.PeriodType=="QUARTER"?$"{r.Year}-Q{r.Number}":r.Year.ToString(),PeriodType=r.PeriodType,StartDate=start,EndDate=start.AddMonths(r.PeriodType=="MONTH"?1:r.PeriodType=="QUARTER"?3:12).AddDays(-1)};
  db.Add(p); await db.SaveChangesAsync(ct); Audit(actor,"KPI_PERIOD",p.ID,"KPI_PERIOD_CREATED",null,p); return p;
 },ct);
 public Task<KpiPeriod> ClosePeriod(string actor,long id,KpiVersion r,CancellationToken ct)=>Transaction(async()=> {
  await Configuration(actor,"UPDATE",ct,true); var p=await OpenPeriod(id,ct); Version(p.Version,r.Version);
  if(await db.Set<KpiTarget>().AnyAsync(x=>x.PeriodId==id && x.Status!="APPROVED" && x.Status!="REJECTED",ct)) throw BusinessException.Conflict("Complete all KPI evaluations before closing the period.");
  p.IsClosed=true;p.Version++;p.ClosedAt=Now;p.ClosedBy=actor;Audit(actor,"KPI_PERIOD",id,"KPI_PERIOD_CLOSED",null,p);return p;
 },ct);
 public async Task<object> Metrics(string actor,PageQuery q,CancellationToken ct) {
  await Configuration(actor,"VIEW",ct);var rows=db.Set<KpiMetric>().AsNoTracking(); if(!string.IsNullOrWhiteSpace(q.Search))rows=rows.Where(x=>x.Code.Contains(q.Search)||x.Name.Contains(q.Search));
  return new PageResult<KpiMetric>(true,await rows.CountAsync(ct),q.Page,q.PageSize,await rows.OrderBy(x=>x.Code).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct));
 }
 public Task<KpiMetric> SaveMetric(string actor,long? id,MetricRequest r,CancellationToken ct)=>Transaction(async()=> {
  await Configuration(actor,id.HasValue?"UPDATE":"NEW",ct,true);
  var row=id.HasValue?await db.Set<KpiMetric>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing():new KpiMetric();
  var unitCode=r.Unit.Trim();
  var unit=await db.Set<KpiUnit>().SingleOrDefaultAsync(x=>x.Code==unitCode,ct);
  if((unit==null || !unit.IsActive) && (!id.HasValue || row.Unit!=unitCode)) throw BusinessException.Invalid("Select an active KPI unit from the catalog.");
  var frozenUnit=id.HasValue && row.Unit==unitCode?row.Unit:unit!.Code;
  var snapshot=new MetricSnapshot(r.Code.Trim(),r.Name.Trim(),frozenUnit,r.Direction,r.Method,r.Source,r.MaxScore,r.Milestones);KpiScoring.Validate(snapshot);
  var before=id.HasValue?Json(row):null;if(id.HasValue) {Version(row.Version,r.Version);row.Version++;}
  row.UnitId=unit?.ID;
  row.Code=snapshot.Code;row.Name=snapshot.Name;row.Unit=snapshot.Unit;row.Direction=r.Direction;row.Method=r.Method;row.Source=r.Source;row.MaxScore=r.MaxScore;row.MilestonesJson=Json(r.Milestones);row.IsActive=r.IsActive;
  if(!id.HasValue)db.Add(row);await db.SaveChangesAsync(ct);Audit(actor,"KPI_METRIC",row.ID,"KPI_METRIC_SAVED",before,row);return row;
 },ct);
 private IQueryable<KpiTemplate> VisibleTemplates(EmployeeAccess a,bool forWrite=false) {
  var rows=db.Set<KpiTemplate>().AsQueryable();
  if(a.Scope=="ALL")return rows;
  if(a.Scope=="DEPARTMENT" && a.DepartmentId.HasValue)return rows.Where(x=>(!forWrite && x.DepartmentId==null && x.TeamId==null) || x.DepartmentId==a.DepartmentId || x.TeamId!=null && db.Set<Team>().Any(t=>t.Id==x.TeamId && t.DepartmentId==a.DepartmentId));
  return rows.Where(x=>false);
 }
 private async Task TemplateScope(EmployeeAccess a,int? dept,int? team,long? position,CancellationToken ct) {
  if(new object?[]{dept,team,position}.Count(x=>x!=null)>1)throw BusinessException.Invalid("Select one template applicability: department, team or position.");
  if(dept.HasValue && !await db.Set<Department>().AnyAsync(x=>x.Id==dept && x.IsActive,ct) || position.HasValue && !await db.Set<Position>().AnyAsync(x=>x.ID==position && x.IsActive,ct))throw BusinessException.Invalid("Invalid template applicability.");
  int? actualDept=dept;
  if(team.HasValue)actualDept=await db.Set<Team>().Where(x=>x.Id==team && x.IsActive).Select(x=>(int?)x.DepartmentId).SingleOrDefaultAsync(ct)??throw BusinessException.Invalid("Invalid team.");
  if(a.Scope!="ALL" && (!actualDept.HasValue || actualDept!=a.DepartmentId))throw BusinessException.Scope();
 }
 private IQueryable<KpiTemplateView> TemplateViews(IQueryable<KpiTemplate> templates) =>
  from template in templates
  join department in db.Set<Department>().AsNoTracking() on template.DepartmentId equals (int?)department.Id into departments
  from department in departments.DefaultIfEmpty()
  join position in db.Set<Position>().AsNoTracking() on template.PositionId equals (long?)position.ID into positions
  from position in positions.DefaultIfEmpty()
  join team in db.Set<Team>().AsNoTracking() on template.TeamId equals (int?)team.Id into teams
  from team in teams.DefaultIfEmpty()
  select new KpiTemplateView(template.ID,template.Code,template.Name,template.PeriodType,template.Status,
   template.DepartmentId,department==null?null:department.DepartmentName,template.PositionId,position==null?null:position.Name,
   template.TeamId,team==null?null:team.TeamName,template.Version);
 public async Task<KpiTemplateListing> Templates(string actor,PageQuery q,CancellationToken ct) {
  var access=await Configuration(actor,"VIEW",ct);
  var rows=VisibleTemplates(access).AsNoTracking();
  var searchApplied=!string.IsNullOrWhiteSpace(q.Search);
  if(searchApplied) rows=rows.Where(x=>x.Code.Contains(q.Search!)||x.Name.Contains(q.Search!));
  var total=await rows.CountAsync(ct);
  var data=await TemplateViews(rows.OrderBy(x=>x.Code).Skip(Paging.Offset(q)).Take(q.PageSize)).ToListAsync(ct);
  var connection=db.Database.GetDbConnection();
  // Scope/counts are those already authorized for the caller. Never log unscoped counts,
  // search text, SQL parameters, or the connection string/credentials.
  logger.LogInformation(new EventId(1101,"KpiTemplateQuery"),
   "KPI template query {EffectiveScope} {SearchApplied} {Page} {PageSize} {Total} {ReturnedCount} {DatabaseServer} {DatabaseName}",
   access.Scope,searchApplied,q.Page,q.PageSize,total,data.Count,connection.DataSource,connection.Database);
  return new(new PageResult<KpiTemplateView>(true,total,q.Page,q.PageSize,data),access.Scope,searchApplied);
 }
 public async Task<object> Template(string actor,long id,CancellationToken ct) {
  var a=await Configuration(actor,"VIEW",ct);var row=await TemplateViews(VisibleTemplates(a).AsNoTracking().Where(x=>x.ID==id)).SingleOrDefaultAsync(ct)??throw BusinessException.Missing();
  return new {template=row,criteria=await db.Set<KpiCriterion>().AsNoTracking().Where(x=>x.TemplateID==id).OrderBy(x=>x.ID).ToListAsync(ct)};
 }
 public Task<KpiTemplate> SaveTemplate(string actor,long? id,TemplateRequest r,CancellationToken ct)=>Transaction(async()=> {
  var a=await Configuration(actor,id.HasValue?"UPDATE":"NEW",ct); await TemplateScope(a,r.DepartmentId,r.TeamId,r.PositionId,ct);
  var row=id.HasValue?await VisibleTemplates(a,true).SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing():new KpiTemplate();
  if(id.HasValue) {Version(row.Version,r.Version);if(row.Status!="DRAFT")throw BusinessException.Conflict("Published templates are immutable; create a new template version.");}
  if(r.Criteria.Any(x=>x is null))throw BusinessException.Invalid("Invalid KPI criteria.");
  if(r.Criteria.Select(x=>x.MetricId).Distinct().Count()!=r.Criteria.Length)throw BusinessException.Invalid("Duplicate KPI metric.");
  var ids=r.Criteria.Select(x=>x.MetricId).ToArray();var metrics=await db.Set<KpiMetric>().Where(x=>ids.Contains(x.ID)&&x.IsActive).ToDictionaryAsync(x=>x.ID,ct);
  if(metrics.Count!=ids.Length)throw BusinessException.Invalid("Inactive or unknown KPI metric.");
  MetricSnapshot Snapshot(KpiMetric m)=>new(m.Code,m.Name,m.Unit,m.Direction,m.Method,m.Source,m.MaxScore,Read<Milestone[]>(m.MilestonesJson));
  KpiScoring.ValidateWeights(r.Criteria.Select(c=>new CriterionSnapshot(0,Snapshot(metrics[c.MetricId]),c.WeightPercent,c.TargetValue)));
  var before=id.HasValue?Json(row):null;row.Code=r.Code.Trim();row.Name=r.Name.Trim();row.PeriodType=r.PeriodType;row.DepartmentId=r.DepartmentId;row.TeamId=r.TeamId;row.PositionId=r.PositionId;row.Status="DRAFT";
  if(id.HasValue) {row.Version++;db.RemoveRange(await db.Set<KpiCriterion>().Where(x=>x.TemplateID==id).ToListAsync(ct));}else db.Add(row);
  await db.SaveChangesAsync(ct);
  foreach(var c in r.Criteria) {var m=metrics[c.MetricId]; db.Add(new KpiCriterion{TemplateID=row.ID,MetricId=m.ID,Code=m.Code,Name=m.Name,WeightPercent=c.WeightPercent,TargetValue=c.TargetValue,MaxScore=m.MaxScore,MetricSnapshotJson=Json(Snapshot(m))});}
  Audit(actor,"KPI_TEMPLATE",row.ID,"KPI_TEMPLATE_SAVED",before,row);return row;
 },ct);
 public Task<KpiTemplate> Publish(string actor,long id,KpiVersion r,CancellationToken ct)=>Transaction(async()=> {
  var a=await Configuration(actor,"UPDATE",ct);var row=await VisibleTemplates(a,true).SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();
  Version(row.Version,r.Version);if(row.Status!="DRAFT")throw BusinessException.Conflict("Template already published.");
  var criteria=await Snapshot(id,ct);KpiScoring.ValidateWeights(criteria);row.Status="PUBLISHED";row.Version++;Audit(actor,"KPI_TEMPLATE",id,"KPI_TEMPLATE_PUBLISHED",null,row);return row;
 },ct);
 private async Task<CriterionSnapshot[]> Snapshot(long templateId,CancellationToken ct) => (await db.Set<KpiCriterion>().AsNoTracking().Where(x=>x.TemplateID==templateId).OrderBy(x=>x.ID).ToListAsync(ct))
  .Select(x=>new CriterionSnapshot(x.ID,Read<MetricSnapshot>(x.MetricSnapshotJson),x.WeightPercent,x.TargetValue)).ToArray();
}
