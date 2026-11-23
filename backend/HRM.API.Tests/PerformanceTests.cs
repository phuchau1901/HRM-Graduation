using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Performance.DTOs;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.Performance.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class PerformanceTests {
 private static CriterionSnapshot C(string direction="HIGHER",decimal target=100,decimal weight=100)=>new(1,new("TEST","Test","unit",direction,direction=="QUALITATIVE"?"DIRECT":direction=="MILESTONE"?"MILESTONE":"RATIO","MANUAL",100,[new(10,40),new(20,100)]),weight,target);
 [Theory]
 [InlineData("HIGHER",100,80,80)] [InlineData("HIGHER",100,200,100)] [InlineData("LOWER",10,20,50)] [InlineData("LOWER",10,0,100)]
 [InlineData("QUALITATIVE",100,75,75)] [InlineData("MILESTONE",100,9,0)] [InlineData("MILESTONE",100,15,40)] [InlineData("MILESTONE",100,20,100)]
 public void Formulas(string direction,int target,int actual,int expected)=>Assert.Equal(expected,KpiScoring.Score(C(direction,target),actual));
 [Fact] public void WeightsAndInvalidTargetsAreRejected() {
  Assert.Throws<BusinessException>(()=>KpiScoring.ValidateWeights([C(weight:99)]));
  Assert.Throws<BusinessException>(()=>KpiScoring.ValidateWeights([C(target:0)]));
  Assert.Throws<BusinessException>(()=>KpiScoring.Score(C("QUALITATIVE"),101));
  Assert.Equal(85,KpiScoring.Total([(C(weight:50),90m),(C(weight:50),80m)]));
 }
 internal static async Task<LeaveWorkflowTests.Fixture> Setup(string? path=null) {
  var f=await LeaveWorkflowTests.Fixture.Create(path);
  foreach(var code in new[]{KpiScreens.Configuration,KpiScreens.Evaluation})await OrganizationApiTests.Grant(f.H.App,code);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var root=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");var lead=await db.Set<Role>().SingleAsync(x=>x.Code=="LEAD");
   foreach(var code in new[]{KpiScreens.Configuration,KpiScreens.Evaluation}) {
    var screen=await db.Screens.SingleAsync(x=>x.Code==code);var detail=await db.Set<RoleDetail>().SingleAsync(x=>x.RoleID==root.ID && x.ScreenID==screen.ID);detail.CanApprove="Y";detail.CanExport="Y";
    foreach(var action in new[]{"VIEW","NEW","UPDATE","APPROVE","EXPORT"})db.Add(new RoleScreenAction{RoleID=root.ID,ScreenID=screen.ID,ActionCode=action,DataScope="ALL"});
    if(code==KpiScreens.Evaluation) {db.Add(new RoleDetail{RoleID=lead.ID,ScreenID=screen.ID,CanView="Y",CanApprove="Y"});foreach(var action in new[]{"VIEW","APPROVE"})db.Add(new RoleScreenAction{RoleID=lead.ID,ScreenID=screen.ID,ActionCode=action,DataScope="DEPARTMENT"});}
   }
   await db.SaveChangesAsync();
  }
  await OrganizationApiTests.Login(f.H.Client,f.H.App);
  var settings=await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings");
  (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest {Version=settings!.Version,Routes=[new WorkflowRoute{RequestType="KPI_EVALUATION",Steps=[new WorkflowStepRule{ApproverType="TEAM_LEAD"}]}]})).EnsureSuccessStatusCode();
  return f;
 }
 private static async Task<JsonElement> Send(HttpClient c,string route,object body,string method="POST") {
  var response=await c.SendAsync(new HttpRequestMessage(new HttpMethod(method),route){Content=JsonContent.Create(body)});
  Assert.True(response.IsSuccessStatusCode,await response.Content.ReadAsStringAsync());return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
 }
 private static async Task<(long Period,long Template,long Criterion,long Target)> Assign(LeaveWorkflowTests.Fixture f,int month=11) {
  var c=f.H.Client;
  var p=await Send(c,"/api/kpi/configuration/periods",new{periodType="MONTH",year=2026,number=month});
  var m=await Send(c,"/api/kpi/configuration/metrics",new{code="SALES",name="Sales",unit="VND",direction="HIGHER",method="RATIO",maxScore=100});
  var tr=await c.PostAsJsonAsync("/api/kpi/configuration/templates",new{code="MONTHLY",name="Monthly",periodType="MONTH",criteria=new[]{new{metricId=m.GetProperty("id").GetInt64(),weightPercent=100,targetValue=100}}});Assert.True(tr.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await tr.Content.ReadAsStringAsync());var t=(await tr.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
  var template=t.GetProperty("id").GetInt64();await Send(c,$"/api/kpi/configuration/templates/{template}/publish",new{version=1});
  var r=await c.PostAsJsonAsync("/api/kpi/configuration/assignments",new{periodId=p.GetProperty("id").GetInt64(),templateId=template,reviewerEmployeeId=f.H.Peer,target="EMPLOYEE",employeeIds=new[]{f.H.Self}});r.EnsureSuccessStatusCode();
  var target=(await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ids")[0].GetInt64();var d=(await c.GetFromJsonAsync<JsonElement>($"/api/kpi/evaluations/{target}")).GetProperty("data");
  return(p.GetProperty("id").GetInt64(),template,d.GetProperty("criteria")[0].GetProperty("criterionId").GetInt64(),target);
 }
 [Fact] public async Task FullLifecycleSnapshotsApprovalAndPeriodLock() {
  await using var f=await Setup();var ids=await Assign(f);var c=f.H.Client;var url=$"/api/kpi/evaluations/{ids.Target}";
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync($"/api/kpi/configuration/periods/{ids.Period}/close",new{version=1})).StatusCode);
  (await c.PostAsJsonAsync(url+"/start",new{version=1})).EnsureSuccessStatusCode();
  Assert.Equal(HttpStatusCode.Conflict,(await c.PutAsJsonAsync(url+"/results",new{version=1,results=new[]{new{criterionId=ids.Criterion,actualValue=80}}})).StatusCode);
  (await c.PutAsJsonAsync(url+"/results",new{version=2,results=new[]{new{criterionId=ids.Criterion,actualValue=80,evidenceUrl="https://example.com/proof"}}})).EnsureSuccessStatusCode();
  (await c.PostAsJsonAsync(url+"/submit",new{version=3})).EnsureSuccessStatusCode();
  Assert.Equal(HttpStatusCode.Forbidden,(await c.PostAsJsonAsync(url+"/review",new{version=4,comment="Self",results=new[]{new{criterionId=ids.Criterion,actualValue=80}}})).StatusCode);
  using var lead=await f.As("lead");var review=await lead.PostAsJsonAsync(url+"/review",new{version=4,comment="Reviewed",results=new[]{new{criterionId=ids.Criterion,actualValue=90}}});Assert.True(review.IsSuccessStatusCode,await review.Content.ReadAsStringAsync());
  var approval=(await review.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("approvalId").GetInt64();
  Assert.Equal(HttpStatusCode.Forbidden,(await f.Decide(approval,"api-user")).StatusCode);(await f.Decide(approval,"lead")).EnsureSuccessStatusCode();
  var d=(await c.GetFromJsonAsync<JsonElement>(url)).GetProperty("data");Assert.Equal("APPROVED",d.GetProperty("target").GetProperty("status").GetString());Assert.Equal(90,d.GetProperty("target").GetProperty("finalScore").GetDecimal());
  await Send(c,$"/api/kpi/configuration/periods/{ids.Period}/close",new{version=1});
  Assert.Equal(HttpStatusCode.Conflict,(await c.PutAsJsonAsync(url+"/results",new{version=6,results=new[]{new{criterionId=ids.Criterion,actualValue=100}}})).StatusCode);
  var excel=await c.GetAsync("/api/kpi/evaluations/export");excel.EnsureSuccessStatusCode();Assert.Equal("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",excel.Content.Headers.ContentType!.MediaType);
 }
 [Fact] public async Task AssignmentIsIdempotentAndPublishedTemplateIsImmutable() {
  await using var f=await Setup();var ids=await Assign(f);var c=f.H.Client;
  var again=await c.PostAsJsonAsync("/api/kpi/configuration/assignments",new{periodId=ids.Period,templateId=ids.Template,reviewerEmployeeId=f.H.Peer,target="EMPLOYEE",employeeIds=new[]{f.H.Self}});again.EnsureSuccessStatusCode();Assert.Equal(0,(await again.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("created").GetInt32());
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var metric=await db.Set<KpiMetric>().SingleAsync();
  await Send(c,$"/api/kpi/configuration/metrics/{metric.ID}",new{code="SALES",name="Changed",unit="VND",direction="LOWER",method="RATIO",maxScore=100,version=1},"PUT");
  var d=(await c.GetFromJsonAsync<JsonElement>($"/api/kpi/evaluations/{ids.Target}")).GetProperty("data");Assert.Equal("HIGHER",d.GetProperty("criteria")[0].GetProperty("metric").GetProperty("direction").GetString());
  Assert.Equal(HttpStatusCode.Conflict,(await c.PutAsJsonAsync($"/api/kpi/configuration/templates/{ids.Template}",new{code="MONTHLY",name="Change",version=2,criteria=new[]{new{metricId=metric.ID,weightPercent=100,targetValue=999}}})).StatusCode);
  Assert.Single(await db.Set<KpiTarget>().ToListAsync());Assert.True(await db.Set<AuditLog>().AnyAsync(x=>x.Action=="KPI_ASSIGNED"));
 }
 [Fact] public async Task SelfScopeCannotReadOtherEmployeeCountsOrAssign() {
  await using var f=await Setup();var assigned=await Assign(f);
  var otherResponse=await f.H.Client.PostAsJsonAsync("/api/kpi/configuration/assignments",new{periodId=assigned.Period,templateId=assigned.Template,reviewerEmployeeId=f.H.Peer,target="EMPLOYEE",employeeIds=new[]{f.H.Other}});otherResponse.EnsureSuccessStatusCode();var otherId=(await otherResponse.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("ids")[0].GetInt64();
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var roles=await db.Set<Role>().Where(x=>x.Code=="HR").Select(x=>x.ID).ToListAsync();
   await db.Set<RoleScreenAction>().Where(x=>roles.Contains(x.RoleID) && db.Screens.Any(s=>s.ID==x.ScreenID && (s.Code==KpiScreens.Configuration||s.Code==KpiScreens.Evaluation))).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"SELF"));
  }
  Assert.Equal(HttpStatusCode.NotFound,(await f.H.Client.GetAsync($"/api/kpi/evaluations/{otherId}")).StatusCode);
  var list=await f.H.Client.GetFromJsonAsync<JsonElement>($"/api/kpi/evaluations?employeeId={f.H.Other}");Assert.Equal(0,list.GetProperty("total").GetInt32());
  var stats=await f.H.Client.GetFromJsonAsync<JsonElement>($"/api/kpi/evaluations/statistics?employeeId={f.H.Other}");Assert.Equal(0,stats.GetProperty("data").GetProperty("total").GetInt32());
  Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.PostAsJsonAsync("/api/kpi/configuration/periods",new{year=2027,number=1})).StatusCode);
 }

 [Fact] public async Task CopyPreviousPeriodAndDepartmentScopePreserveSnapshots() {
  await using var f=await Setup();var ids=await Assign(f);var c=f.H.Client;
  var p=await Send(c,"/api/kpi/configuration/periods",new{periodType="MONTH",year=2026,number=12});var next=p.GetProperty("id").GetInt64();
  var response=await c.PostAsJsonAsync("/api/kpi/configuration/assignments",new{periodId=next,templateId=ids.Template,reviewerEmployeeId=f.H.Peer,target="EMPLOYEE",employeeIds=new[]{f.H.Self},copyFromPeriodId=ids.Period});response.EnsureSuccessStatusCode();
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var targets=await db.Set<KpiTarget>().OrderBy(x=>x.ID).ToListAsync();Assert.Equal(2,targets.Count);Assert.Equal(targets[0].SnapshotJson,targets[1].SnapshotJson);Assert.NotEqual(targets[0].PeriodId,targets[1].PeriodId);
  var role=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");await db.Set<RoleScreenAction>().Where(x=>x.RoleID==role.ID && db.Screens.Any(s=>s.ID==x.ScreenID&&s.Code==KpiScreens.Configuration)).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"DEPARTMENT"));
  Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync("/api/kpi/configuration/assignments",new{periodId=next,templateId=ids.Template,reviewerEmployeeId=f.H.Peer,target="EMPLOYEE",employeeIds=new[]{f.H.Other}})).StatusCode);
 }
 [Fact] public async Task MissingWorkflowRollsBackReviewAndResults() {
  await using var f=await Setup();var ids=await Assign(f);var c=f.H.Client;var url=$"/api/kpi/evaluations/{ids.Target}";
  (await c.PostAsJsonAsync(url+"/start",new{version=1})).EnsureSuccessStatusCode();(await c.PutAsJsonAsync(url+"/results",new{version=2,results=new[]{new{criterionId=ids.Criterion,actualValue=80}}})).EnsureSuccessStatusCode();(await c.PostAsJsonAsync(url+"/submit",new{version=3})).EnsureSuccessStatusCode();
  var settings=await c.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings");(await c.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest{Version=settings!.Version,Routes=[new(){RequestType="LEAVE",Steps=[new(){ApproverType="TEAM_LEAD"}]}]})).EnsureSuccessStatusCode();
  using var lead=await f.As("lead");var response=await lead.PostAsJsonAsync(url+"/review",new{version=4,comment="Review",results=new[]{new{criterionId=ids.Criterion,actualValue=90}}});Assert.Equal(HttpStatusCode.Conflict,response.StatusCode);
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var t=await db.Set<KpiTarget>().SingleAsync();Assert.Equal("SUBMITTED",t.Status);Assert.Equal(4,t.Version);Assert.Null(t.ApprovalId);Assert.Empty(await db.Set<PerformanceReview>().ToListAsync());Assert.Null((await db.Set<KpiResult>().SingleAsync()).ManagerScore);
 }
 [Fact] public async Task RejectionIsTerminalAndSelfApprovalNeverAllowed() {
  await using var f=await Setup();var ids=await Assign(f);var c=f.H.Client;var url=$"/api/kpi/evaluations/{ids.Target}";
  (await c.PostAsJsonAsync(url+"/start",new{version=1})).EnsureSuccessStatusCode();(await c.PutAsJsonAsync(url+"/results",new{version=2,results=new[]{new{criterionId=ids.Criterion,actualValue=80}}})).EnsureSuccessStatusCode();(await c.PostAsJsonAsync(url+"/submit",new{version=3})).EnsureSuccessStatusCode();
  using var lead=await f.As("lead");var review=await lead.PostAsJsonAsync(url+"/review",new{version=4,comment="Review",results=new[]{new{criterionId=ids.Criterion,actualValue=80}}});review.EnsureSuccessStatusCode();var approval=(await review.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("approvalId").GetInt64();
  (await f.Decide(approval,"lead",false)).EnsureSuccessStatusCode();var d=(await c.GetFromJsonAsync<JsonElement>(url)).GetProperty("data");Assert.Equal("REJECTED",d.GetProperty("target").GetProperty("status").GetString());Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync(url+"/start",new{version=6})).StatusCode);await Send(c,$"/api/kpi/configuration/periods/{ids.Period}/close",new{version=1});
 }
 [Fact] public async Task ConcurrentStartConsumesOneVersion() {
  var path=Path.Combine(Path.GetTempPath(),$"kpi-{Guid.NewGuid():N}.db");
  try {
   await using var f=await Setup(path);var ids=await Assign(f);using var second=await f.As("api-user");
   var responses=await Task.WhenAll(f.H.Client.PostAsJsonAsync($"/api/kpi/evaluations/{ids.Target}/start",new{version=1}),second.PostAsJsonAsync($"/api/kpi/evaluations/{ids.Target}/start",new{version=1}));
   Assert.Single(responses,x=>x.StatusCode==HttpStatusCode.OK);Assert.Single(responses,x=>x.StatusCode==HttpStatusCode.Conflict);
  } finally {File.Delete(path);}
 }

 [Fact] public async Task BulkAllAssignsAlternateReviewerWithoutSelfReview() {
  await using var f=await Setup();var ids=await Assign(f);var p=await Send(f.H.Client,"/api/kpi/configuration/periods",new{year=2026,number=12});var period=p.GetProperty("id").GetInt64();
  var response=await f.H.Client.PostAsJsonAsync("/api/kpi/configuration/assignments",new{periodId=period,templateId=ids.Template,target="ALL",reviewerEmployeeId=f.H.Peer,alternateReviewerEmployeeId=f.H.Self});Assert.True(response.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await response.Content.ReadAsStringAsync());
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var targets=await db.Set<KpiTarget>().Where(x=>x.PeriodId==period).ToListAsync();Assert.True(targets.Count>=3);Assert.All(targets,t=>Assert.NotEqual(t.EmployeeID,t.ReviewerEmployeeId));Assert.Equal(f.H.Self,targets.Single(t=>t.EmployeeID==f.H.Peer).ReviewerEmployeeId);
 }
 [Fact] public async Task GlobalWorkflowSelfApprovalSettingCannotOverrideKpiPolicy() {
  await using var f=await Setup();var ids=await Assign(f);var c=f.H.Client;var url=$"/api/kpi/evaluations/{ids.Target}";
  var setting=await c.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings");(await c.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest{Version=setting!.Version,Routes=[new(){RequestType="KPI_EVALUATION",AllowSelfApproval=true,Steps=[new(){ApproverType="USER",EmployeeId=f.H.Self}]}]})).EnsureSuccessStatusCode();
  (await c.PostAsJsonAsync(url+"/start",new{version=1})).EnsureSuccessStatusCode();(await c.PutAsJsonAsync(url+"/results",new{version=2,results=new[]{new{criterionId=ids.Criterion,actualValue=80}}})).EnsureSuccessStatusCode();(await c.PostAsJsonAsync(url+"/submit",new{version=3})).EnsureSuccessStatusCode();
  using var lead=await f.As("lead");var review=await lead.PostAsJsonAsync(url+"/review",new{version=4,comment="Review",results=new[]{new{criterionId=ids.Criterion,actualValue=80}}});review.EnsureSuccessStatusCode();var id=(await review.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("approvalId").GetInt64();
  Assert.Equal(HttpStatusCode.Forbidden,(await f.Decide(id,"api-user")).StatusCode);
 }
 [Fact] public async Task EffectiveScopeCombinesRolesAndCannotReplacePermission() {
  await using var f=await Setup();await Assign(f);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var screen=await db.Screens.SingleAsync(x=>x.Code==KpiScreens.Evaluation);var hr=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");var other=await db.Set<Role>().SingleAsync(x=>x.Code=="EMPLOYEE");
   await db.Set<RoleScreenAction>().Where(x=>x.RoleID==hr.ID && x.ScreenID==screen.ID && x.ActionCode=="VIEW").ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"SELF"));
   db.Add(new RoleDetail{RoleID=other.ID,ScreenID=screen.ID,CanView="Y"});db.Add(new RoleScreenAction{RoleID=other.ID,ScreenID=screen.ID,ActionCode="VIEW",DataScope="ALL"});await db.SaveChangesAsync();
   Assert.Equal("ALL",await scope.ServiceProvider.GetRequiredService<HRM.API.Modules.Authorization.Services.IPermissionService>().GetDataScopeAsync("api-user",KpiScreens.Evaluation,"VIEW"));
   await db.Set<RoleDetail>().Where(x=>x.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CanView,"N"));
  }
  Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.GetAsync("/api/kpi/evaluations")).StatusCode);
 }
 [Fact] public void MigrationCreatesOnlyMissingTablesAndPreservesEmployeeFkIndex() {
  using var db=new AppDbContext(new DbContextOptionsBuilder<AppDbContext>().UseMySql("Server=localhost;Database=design;User=design",new MySqlServerVersion(new Version(8,0,36))).Options);
  var migration=new HRM.API.Migrations.CompletePerformanceManagement();
  Assert.Equal(new[]{"kpi_metrics","kpi_periods"},migration.UpOperations.OfType<Microsoft.EntityFrameworkCore.Migrations.Operations.CreateTableOperation>().Select(x=>x.Name).OrderBy(x=>x).ToArray());
  var operations=migration.UpOperations.ToList();var create=operations.FindIndex(x=>x is Microsoft.EntityFrameworkCore.Migrations.Operations.CreateIndexOperation {Name:"IX_kpi_targets_employee_id_period_id"});var drop=operations.FindIndex(x=>x is Microsoft.EntityFrameworkCore.Migrations.Operations.DropIndexOperation {Name:"IX_kpi_targets_employee_id"});Assert.True(create>=0 && drop>create);
  Assert.False(db.Database.HasPendingModelChanges());
 }
}
