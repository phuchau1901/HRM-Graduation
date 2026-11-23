using HRM.API.Common;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Performance.Services;
public sealed partial class KpiService {
 private IQueryable<KpiRow> Rows(IQueryable<Employee> employees,KpiQuery q) {
  var targets=db.Set<KpiTarget>().AsNoTracking().AsQueryable();
  if(q.PeriodId.HasValue)targets=targets.Where(x=>x.PeriodId==q.PeriodId);
  if(!string.IsNullOrWhiteSpace(q.Status))targets=targets.Where(x=>x.Status==q.Status);
  if(q.EmployeeId.HasValue)employees=employees.Where(x=>x.Id==q.EmployeeId);
  if(q.DepartmentId.HasValue)employees=employees.Where(x=>x.DepartmentId==q.DepartmentId);
  if(q.TeamId.HasValue)employees=employees.Where(x=>x.TeamId==q.TeamId);
  if(!string.IsNullOrWhiteSpace(q.Search))employees=employees.Where(x=>x.FullName.Contains(q.Search)||x.EmployeeCode.Contains(q.Search));
  return from t in targets join e in employees on t.EmployeeID equals e.Id
   select new KpiRow {Id=t.ID,EmployeeId=e.Id,EmployeeCode=e.EmployeeCode,EmployeeName=e.FullName,DepartmentId=e.DepartmentId,DepartmentName=e.Department.DepartmentName,TeamId=e.TeamId,TeamName=e.Team==null?null:e.Team.TeamName,PositionId=e.PositionId,PeriodId=t.PeriodId,PeriodKey=t.PeriodKey,Status=t.Status,FinalScore=t.FinalScore,ReviewerEmployeeId=t.ReviewerEmployeeId,Version=t.Version,ApprovalId=t.ApprovalId};
 }
 public async Task<PageResult<KpiRow>> Evaluations(string actor,KpiQuery q,CancellationToken ct,string action="VIEW") {
  var a=await Access(actor,KpiScreens.Evaluation,action,ct);var rows=Rows(a.Apply(db.Employees),q);
  return new(true,await rows.CountAsync(ct),q.Page,q.PageSize,await rows.OrderBy(x=>x.EmployeeCode).ThenByDescending(x=>x.Id).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct));
 }
 public async Task<IReadOnlyList<KpiRow>> Export(string actor,KpiQuery q,CancellationToken ct) {
  var a=await Access(actor,KpiScreens.Evaluation,"EXPORT",ct);var rows=Rows(a.Apply(db.Employees),q);
  if(await rows.CountAsync(ct)>10000)throw BusinessException.Invalid("Export limited to 10,000 rows; filter by period/department.");
  return await rows.OrderBy(x=>x.EmployeeCode).ThenBy(x=>x.Id).ToListAsync(ct);
 }
 public async Task<object> Statistics(string actor,KpiQuery q,CancellationToken ct) {
  var a=await Access(actor,KpiScreens.Evaluation,"VIEW",ct);var rows=Rows(a.Apply(db.Employees),q);
  var counts=await rows.GroupBy(x=>x.Status).Select(g=>new {status=g.Key,count=g.Count()}).ToListAsync(ct);
  // Cast for SQLite as well as MySQL; only approved scores contribute to the aggregate.
  var scores=rows.Where(x=>x.Status=="APPROVED" && x.FinalScore.HasValue);
  var average=await scores.Select(x=>(double?)x.FinalScore).AverageAsync(ct);
  return new {success=true,data=new {total=counts.Sum(x=>x.count),statuses=counts,averageScore=average}};
 }
 public async Task<object> Detail(string actor,long id,CancellationToken ct) {
  var a=await Access(actor,KpiScreens.Evaluation,"VIEW",ct);var row=await Rows(a.Apply(db.Employees),new()).SingleOrDefaultAsync(x=>x.Id==id,ct)??throw BusinessException.Missing();
  var target=await db.Set<KpiTarget>().AsNoTracking().SingleAsync(x=>x.ID==id,ct);
  var results=await db.Set<KpiResult>().AsNoTracking().Where(x=>x.TargetID==id).OrderBy(x=>x.ID).ToListAsync(ct);
  var period=target.PeriodId.HasValue?await db.Set<KpiPeriod>().AsNoTracking().SingleAsync(x=>x.ID==target.PeriodId,ct):null;
  var history=await db.Set<AuditLog>().AsNoTracking().Where(x=>x.EntityType=="KPI_TARGET" && x.EntityID==id.ToString()).OrderByDescending(x=>x.ID).Take(100).Select(x=>new{x.ID,x.Action,x.ActorUserID,x.CreatedAt,x.AfterJSON}).ToListAsync(ct);
  return new {success=true,data=new {target=row,criteria=Read<CriterionSnapshot[]>(target.SnapshotJson),results,reviewerComment=target.ReviewerComment,isClosed=period?.IsClosed??true,history}};
 }
 public async Task<object> Employees(string actor,PageQuery q,CancellationToken ct,bool config) {
  var a=await Access(actor,config?KpiScreens.Configuration:KpiScreens.Evaluation,"VIEW",ct);var rows=a.Apply(db.Employees).AsNoTracking().Where(x=>x.EmploymentStatus=="ACTIVE");
  if(!string.IsNullOrWhiteSpace(q.Search))rows=rows.Where(x=>x.FullName.Contains(q.Search)||x.EmployeeCode.Contains(q.Search));
  return new {success=true,total=await rows.CountAsync(ct),page=q.Page,pageSize=q.PageSize,data=await rows.OrderBy(x=>x.EmployeeCode).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x=>new{x.Id,x.EmployeeCode,x.FullName,x.DepartmentId,x.TeamId,x.PositionId,departmentName=x.Department.DepartmentName,teamName=x.Team==null?null:x.Team.TeamName}).ToListAsync(ct)};
 }
 public Task<object> Assign(string actor,AssignmentRequest r,CancellationToken ct)=>Transaction<object>(async()=> {
  var a=await Configuration(actor,"NEW",ct);var p=await OpenPeriod(r.PeriodId,ct);
  var template=await VisibleTemplates(a).SingleOrDefaultAsync(x=>x.ID==r.TemplateId && x.Status=="PUBLISHED",ct)??throw BusinessException.Invalid("Published template not found in your scope.");
  if(template.PeriodType!=p.PeriodType)throw BusinessException.Invalid("Template and period types differ.");
  var criteria=await Snapshot(template.ID,ct);KpiScoring.ValidateWeights(criteria);
  if(r.Target=="EMPLOYEE" && (r.EmployeeIds.Length==0 || r.EmployeeIds.Distinct().Count()!=r.EmployeeIds.Length))throw BusinessException.Invalid("Select distinct employees.");
  var employees=a.Apply(db.Employees).Where(x=>x.EmploymentStatus=="ACTIVE" && x.HireDate<=p.EndDate);
  employees=r.Target switch {
   "DEPARTMENT" when r.DepartmentId.HasValue=>employees.Where(x=>x.DepartmentId==r.DepartmentId),
   "TEAM" when r.TeamId.HasValue=>employees.Where(x=>x.TeamId==r.TeamId),
   "EMPLOYEE"=>employees.Where(x=>r.EmployeeIds.Contains(x.Id)),
   "ALL"=>employees,_=>throw BusinessException.Invalid("Invalid assignment target.")};
  var people=await employees.OrderBy(x=>x.Id).Take(1001).ToListAsync(ct);
  if(people.Count==0 || people.Count>1000 || r.Target=="EMPLOYEE" && people.Count!=r.EmployeeIds.Length)throw BusinessException.Invalid("No eligible employees, employees outside scope, or batch exceeds 1,000.");
  if(people.Any(e=>template.DepartmentId.HasValue && template.DepartmentId!=e.DepartmentId || template.TeamId.HasValue && template.TeamId!=e.TeamId || template.PositionId.HasValue && template.PositionId!=e.PositionId))throw BusinessException.Invalid("Template applicability does not match all selected employees.");
  var reviewer=await a.Apply(db.Employees).SingleOrDefaultAsync(e=>e.Id==r.ReviewerEmployeeId && e.EmploymentStatus=="ACTIVE",ct)??throw BusinessException.Scope();
  if(!await db.Set<User>().AnyAsync(x=>x.EmployeeId==reviewer.Id && x.Status=="ACTIVE",ct))throw BusinessException.Invalid("Reviewer needs an active linked user.");
  if(people.Any(e=>e.Id==reviewer.Id)) {
   if(!r.AlternateReviewerEmployeeId.HasValue || r.AlternateReviewerEmployeeId==reviewer.Id || !await a.Apply(db.Employees).AnyAsync(e=>e.Id==r.AlternateReviewerEmployeeId && e.EmploymentStatus=="ACTIVE",ct) || !await db.Set<User>().AnyAsync(u=>u.EmployeeId==r.AlternateReviewerEmployeeId && u.Status=="ACTIVE",ct))
    throw BusinessException.Invalid("The reviewer is included in this batch. Select a different alternate reviewer for their KPI.");
  }
  var ids=people.Select(x=>x.Id).ToArray();var existing=await db.Set<KpiTarget>().Where(x=>x.PeriodId==p.ID && ids.Contains(x.EmployeeID)).Select(x=>x.EmployeeID).ToListAsync(ct);
  var previous=new Dictionary<int,KpiTarget>();
  if(r.CopyFromPeriodId.HasValue) {
   var source=await db.Set<KpiPeriod>().AsNoTracking().SingleOrDefaultAsync(x=>x.ID==r.CopyFromPeriodId,ct)??throw BusinessException.Invalid("Source period not found.");
   if(source.EndDate>=p.StartDate || source.PeriodType!=p.PeriodType)throw BusinessException.Invalid("Copy requires an earlier period of the same type.");
   previous=await db.Set<KpiTarget>().AsNoTracking().Where(x=>x.PeriodId==source.ID && x.TemplateID==template.ID && ids.Contains(x.EmployeeID)).ToDictionaryAsync(x=>x.EmployeeID,ct);
   if(people.Any(e=>!existing.Contains(e.Id) && !previous.ContainsKey(e.Id)))throw BusinessException.Invalid("Some selected employees have no matching KPI in the source period.");
  }
  var created=new List<KpiTarget>();
  foreach(var e in people.Where(e=>!existing.Contains(e.Id))) {
   var frozen=r.CopyFromPeriodId.HasValue?Read<CriterionSnapshot[]>(previous[e.Id].SnapshotJson):criteria;KpiScoring.ValidateWeights(frozen);
   var row=new KpiTarget {EmployeeID=e.Id,TemplateID=template.ID,PeriodId=p.ID,PeriodKey=p.Code,Status="DRAFT",ReviewerEmployeeId=e.Id==reviewer.Id?r.AlternateReviewerEmployeeId:reviewer.Id,AssignedByUserID=actor,SnapshotJson=Json(frozen)};
   db.Add(row);created.Add(row);
  }
  await db.SaveChangesAsync(ct);foreach(var row in created)Audit(actor,"KPI_TARGET",row.ID,"KPI_ASSIGNED",null,new{row.EmployeeID,row.PeriodId,row.TemplateID,row.ReviewerEmployeeId,row.SnapshotJson});
  var createdIds=created.Select(x=>x.EmployeeID).ToArray();var users=await db.Set<User>().Where(x=>x.EmployeeId!=null && createdIds.Contains(x.EmployeeId.Value) && x.Status=="ACTIVE").Select(x=>x.UserId).ToArrayAsync(ct);
  if(users.Length>0)await notifications.CreateInternalAsync(new CreateNotificationRequest {Title="KPI assigned",Content=$"KPI for {p.Code} is ready.",ReferenceType="KPI_PERIOD",ReferenceId=p.ID.ToString(),Targets=[new NotificationTargetRequest {Type="USERS",UserIds=users}]},"SYSTEM",$"kpi-assign:{p.ID}:{created[0].ID}",$"kpi-{p.ID}",ct);
  return new{success=true,created=created.Count,alreadyAssigned=existing.Count,ids=created.Select(x=>x.ID).ToArray()};
 },ct);
 private async Task<KpiTarget> Writable(string actor,long id,KpiVersion r,string action,CancellationToken ct) {
  var a=await Access(actor,KpiScreens.Evaluation,action,ct);var employees=a.Apply(db.Employees);
  var period=await db.Set<KpiTarget>().AsNoTracking().Where(x=>x.ID==id && employees.Any(e=>e.Id==x.EmployeeID)).Select(x=>x.PeriodId).SingleOrDefaultAsync(ct)??throw BusinessException.Missing();
  await OpenPeriod(period,ct);
  await db.Set<KpiTarget>().Where(x=>x.ID==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
  var target=await db.Set<KpiTarget>().SingleAsync(x=>x.ID==id,ct);await db.Entry(target).ReloadAsync(ct);Version(target.Version,r.Version);Read<CriterionSnapshot[]>(target.SnapshotJson);return target;
 }
 private async Task Own(string actor,KpiTarget target,CancellationToken ct) {
  if(!await db.Set<User>().AnyAsync(x=>x.UserId==actor && x.Status=="ACTIVE" && x.EmployeeId==target.EmployeeID,ct))throw BusinessException.Scope();
 }
 public Task<object> Start(string actor,long id,KpiVersion r,CancellationToken ct)=>Transaction<object>(async()=> {
  var t=await Writable(actor,id,r,"UPDATE",ct);await Own(actor,t,ct);if(t.Status!="DRAFT")throw BusinessException.Conflict("Only DRAFT can start.");
  t.Status="IN_PROGRESS";t.Version++;Audit(actor,"KPI_TARGET",id,"KPI_STARTED",null,new{t.Status,t.Version});return new{success=true,t.ID,t.Status,t.Version};
 },ct);
 private async Task SaveInputs(KpiTarget t,ResultInput[] inputs,bool review,CancellationToken ct) {
  var criteria=Read<CriterionSnapshot[]>(t.SnapshotJson);if(inputs.Length==0 || inputs.Any(x=>x is null) || inputs.Select(x=>x.CriterionId).Distinct().Count()!=inputs.Length || inputs.Any(x=>criteria.All(c=>c.CriterionId!=x.CriterionId)))throw BusinessException.Invalid("Unknown or duplicate KPI criterion.");
  var rows=await db.Set<KpiResult>().Where(x=>x.TargetID==t.ID).ToListAsync(ct);
  if(rows.GroupBy(x=>x.CriterionID).Any(g=>g.Count()>1))throw BusinessException.Conflict("Legacy duplicate KPI results require reconciliation.");
  foreach(var input in inputs) {
   if(!string.IsNullOrWhiteSpace(input.EvidenceUrl) && (!Uri.TryCreate(input.EvidenceUrl,UriKind.Absolute,out var uri) || uri.Scheme is not ("https" or "http") || !string.IsNullOrEmpty(uri.UserInfo)))throw BusinessException.Invalid("Evidence must be an absolute HTTP(S) URL without credentials.");
   var criterion=criteria.Single(x=>x.CriterionId==input.CriterionId);var score=KpiScoring.Score(criterion,input.ActualValue);
   var row=rows.SingleOrDefault(x=>x.CriterionID==input.CriterionId);
   if(review) {if(row is null)throw BusinessException.Conflict("Employee has not completed all results.");row.ManagerScore=score;}
   else {if(row is null) {row=new(){TargetID=t.ID,CriterionID=input.CriterionId};db.Add(row);}row.ActualValue=input.ActualValue;row.SelfScore=score;row.Comment=input.Comment?.Trim();row.EvidenceUrl=input.EvidenceUrl?.Trim();}
  }
 }
 public Task<object> SaveResults(string actor,long id,ResultsRequest r,CancellationToken ct)=>Transaction<object>(async()=> {
  var t=await Writable(actor,id,r,"UPDATE",ct);await Own(actor,t,ct);if(t.Status!="IN_PROGRESS")throw BusinessException.Conflict("Only IN_PROGRESS results are editable.");
  var before=await db.Set<KpiResult>().AsNoTracking().Where(x=>x.TargetID==id).ToListAsync(ct);await SaveInputs(t,r.Results,false,ct);t.Version++;
  Audit(actor,"KPI_TARGET",id,"KPI_RESULTS_UPDATED",before,r.Results);return new{success=true,t.ID,t.Status,t.Version};
 },ct);
 public Task<object> Submit(string actor,long id,KpiVersion r,CancellationToken ct)=>Transaction<object>(async()=> {
  var t=await Writable(actor,id,r,"UPDATE",ct);await Own(actor,t,ct);if(t.Status!="IN_PROGRESS")throw BusinessException.Conflict("Only IN_PROGRESS KPI can be submitted.");
  var c=Read<CriterionSnapshot[]>(t.SnapshotJson);var results=await db.Set<KpiResult>().Where(x=>x.TargetID==id).ToListAsync(ct);
  if(c.Any(x=>results.Count(y=>y.CriterionID==x.CriterionId && y.ActualValue.HasValue)!=1))throw BusinessException.Invalid("Complete every KPI criterion before submitting.");
  t.Status="SUBMITTED";t.SubmittedAt=Now;t.Version++;Audit(actor,"KPI_TARGET",id,"KPI_SUBMITTED",null,new{t.Status,t.Version});
  var users=await db.Set<User>().Where(x=>x.EmployeeId==t.ReviewerEmployeeId && x.Status=="ACTIVE").Select(x=>x.UserId).ToArrayAsync(ct);
  if(users.Length>0)await notifications.CreateInternalAsync(new CreateNotificationRequest {Title="KPI review requested",Content=$"KPI for {t.PeriodKey} is awaiting your review.",ReferenceType="KPI_TARGET",ReferenceId=id.ToString(),Targets=[new NotificationTargetRequest{Type="USERS",UserIds=users}]},"WORKFLOW",$"kpi-review:{id}",$"kpi-{id}",ct);
  return new{success=true,t.ID,t.Status,t.Version};
 },ct);
 public Task<object> Review(string actor,long id,ReviewRequest r,CancellationToken ct)=>Transaction<object>(async()=> {
  var t=await Writable(actor,id,r,"APPROVE",ct);
  if(t.Status!="SUBMITTED")throw BusinessException.Conflict("Only SUBMITTED KPI can be reviewed.");
  if(!await db.Set<User>().AnyAsync(x=>x.UserId==actor && x.Status=="ACTIVE" && x.EmployeeId==t.ReviewerEmployeeId && x.EmployeeId!=t.EmployeeID,ct))throw BusinessException.Scope();
  var criteria=Read<CriterionSnapshot[]>(t.SnapshotJson);if(r.Results.Length!=criteria.Length || string.IsNullOrWhiteSpace(r.Comment))throw BusinessException.Invalid("Review every criterion and provide a comment.");
  await SaveInputs(t,r.Results,true,ct);t.FinalScore=KpiScoring.Total(r.Results.Select(x=>(criteria.Single(c=>c.CriterionId==x.CriterionId),x.ActualValue)));
  t.ReviewerComment=r.Comment.Trim();t.Status="REVIEWED";t.Version++;
  db.Add(new PerformanceReview{TargetID=id,FinalScore=t.FinalScore.Value,Rating=t.FinalScore>=100?"EXCEEDS":t.FinalScore>=80?"MEETS":"BELOW",ReviewedByUserID=actor,ReviewedAt=Now});
  // Requester is the evaluated employee, not the reviewing manager. This prevents self approval in the shared workflow.
  var owner=await db.Set<User>().Where(x=>x.EmployeeId==t.EmployeeID && x.Status=="ACTIVE").OrderBy(x=>x.UserId).Select(x=>x.UserId).FirstOrDefaultAsync(ct)??throw BusinessException.Invalid("Employee needs an active linked account for approval.");
  var employee=await db.Employees.SingleAsync(x=>x.Id==t.EmployeeID,ct);
  var approval=await workflows.StartAsync(owner,employee,"KPI_EVALUATION",id,ct);t.ApprovalId=approval.ID;
  Audit(actor,"KPI_TARGET",id,"KPI_REVIEWED",null,new{t.Status,t.Version,t.FinalScore,t.ReviewerComment,review=r.Results,t.ApprovalId});return new{success=true,t.ID,t.Status,t.Version,t.ApprovalId};
 },ct);
}
