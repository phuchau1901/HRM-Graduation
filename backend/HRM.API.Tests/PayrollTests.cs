using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.Payroll.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.Approvals.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class PayrollTests {
 internal static PayrollRules Rules()=>new(){StandardDays=20,HoursPerDay=8,NightStart=new(22,0),NightEnd=new(6,0),OvertimeMultipliers=PayrollEngine.OvertimeKinds.ToDictionary(x=>x,x=>x.StartsWith("HOLIDAY")?3m:x.StartsWith("REST")?2m:1.5m)};
 internal static TimesheetSnapshot Sheet(int employee=1) {
  var start=new DateOnly(2026,10,1);return new(employee,"2026-10",1,20,Enumerable.Range(0,31).Select(i=>new TimesheetDay(start.AddDays(i),true,true,false,480,i<20?480:0,0,0,null,null,[],null,null,0)).ToArray(),[],[]);
 }
 internal static SalarySlice Profile(decimal salary=20000,DateOnly? start=null,DateOnly? end=null,string basis="MONTH")=>new(1,start??new(2020,1,1),end,basis,salary,0,0,0,0,"VND",[],1);
 private static CalculationInput Input(TimesheetSnapshot? sheet=null,SalarySlice[]? profiles=null,PayrollRules? rules=null)=>new("2026-10",sheet??Sheet(),profiles??[Profile()],[],rules??Rules(),null);
 [Fact] public void StandardWorkPaidAndUnpaidLeave() {
  var sheet=Sheet();var days=sheet.Days.ToArray();days[0]=days[0] with{WorkedMinutes=0,PaidLeave=1};days[1]=days[1] with{WorkedMinutes=0,UnpaidLeave=1};
  var result=PayrollEngine.Calculate(Input(sheet with{Days=days}));Assert.Equal(19000,result.BaseSalary);Assert.Equal(result.Gross-result.Deductions,result.Net);
 }
 [Theory]
 [InlineData("MONTH",20000,20000)]
 [InlineData("DAY",100,2000)]
 [InlineData("HOUR",100,16000)]
 public void PayableSnapshotKeepsFullPayDespiteShortActualAttendance(string basis,decimal salary,decimal expected) {
  var sheet=Sheet();var days=sheet.Days.Select(d=>d with{WorkedMinutes=0,PayableWorkedMinutes=d.WorkedMinutes>0?480:0}).ToArray();
  Assert.Equal(expected,PayrollEngine.Calculate(Input(sheet with{Days=days},[Profile(salary,basis:basis)])).BaseSalary);
  days[0]=days[0] with{PayableWorkedMinutes=240,PaidLeave=0.5m};
  Assert.Equal(expected,PayrollEngine.Calculate(Input(sheet with{Days=days},[Profile(salary,basis:basis)])).BaseSalary);
 }
 [Fact] public void LegacyTimesheetJsonDoesNotGainNullPayableFields() {
  var json=JsonSerializer.Serialize(Sheet(),new JsonSerializerOptions(JsonSerializerDefaults.Web));
  Assert.DoesNotContain("payableWorkedMinutes",json);Assert.DoesNotContain("earlyMinutes",json);
 }
 [Fact] public void MidMonthSalaryAndHourlyPayUseEffectiveSnapshots() {
  var result=PayrollEngine.Calculate(Input(profiles:[Profile(20000,end:new(2026,10,10)),Profile(40000,start:new(2026,10,11))]));Assert.Equal(30000,result.BaseSalary);
  Assert.Equal(16000,PayrollEngine.Calculate(Input(profiles:[Profile(100,basis:"HOUR")])).BaseSalary);
 }
 [Fact] public void OvernightOvertimeSplitsAtActualLocalHoliday() {
  var sheet=Sheet();var days=sheet.Days.ToArray();days[0]=days[0] with{Overtime=[new(PayrollEngine.LocalUtc(new(2026,10,1),new(23,0)),PayrollEngine.LocalUtc(new(2026,10,2),new(1,0)),9)]};
  var rules=Rules();rules.OvertimeMultipliers["HOLIDAY_NIGHT"]=3;rules.OvertimeMultipliers["NORMAL_NIGHT"]=1.5m;
  Assert.Equal(563,PayrollEngine.Calculate(Input(sheet with{Days=days,Holidays=[new(2026,10,2)]},rules:rules)).OvertimePay);
 }
 [Fact] public void PolicyVersionsDriveTaxInsuranceAndRounding() {
  var rules=Rules();rules.TaxMode="PROGRESSIVE";rules.PersonalDeduction=1000;rules.TaxBrackets=[new(10000,0.1m),new(null,0.2m)];rules.Insurance=[new("TEST",0.1m,0.2m,10000,0,true)];
  var result=PayrollEngine.Calculate(Input(profiles:[Profile() with{InsuranceBase=20000}],rules:rules));Assert.Equal(1000,result.Insurance);Assert.Equal(2000,result.EmployerInsurance);Assert.Equal(2600,result.Tax);Assert.Equal(16400,result.Net);
  Assert.Equal(10,PayrollEngine.Round(12.5m,new(){RoundingStep=5,RoundingMode="TO_EVEN"}));Assert.Equal(15,PayrollEngine.Round(12.5m,new(){RoundingStep=5,RoundingMode="AWAY_FROM_ZERO"}));
  Assert.Equal(result,PayrollEngine.Calculate(Input(profiles:[Profile() with{InsuranceBase=20000}],rules:rules)) with{Lines=result.Lines});
 }
 [Fact] public void AdjustmentsAndApprovedKpiDetermineBonus() {
  var input=Input(profiles:[Profile() with{KpiBonusAmount=1000}]);Assert.Equal(0,PayrollEngine.Calculate(input).KpiBonus);
  var component=new CompensationItem(1,"BONUS","Bonus","EARNING",500,false,true,false,false);
  var result=PayrollEngine.Calculate(input with{Kpi=new(1,"2026-10","APPROVED",80,1),Adjustments=[component]});Assert.Equal(800,result.KpiBonus);Assert.Equal(21300,result.Gross);
 }
 [Theory]
 [InlineData(null,null,null)]
 [InlineData("DRAFT",100,"2026-10")]
 [InlineData("SUBMITTED",100,"2026-10")]
 [InlineData("REJECTED",100,"2026-10")]
 [InlineData("APPROVED",null,"2026-10")]
 [InlineData("APPROVED",100,"2026-09")]
 [InlineData("APPROVED",0,"2026-10")]
 public void MissingOrUnapprovedKpiDoesNotBlockSalary(string? status,int? score,string? period) {
  var input=Input(profiles:[Profile() with{KpiBonusAmount=1000}]) with{Kpi=status==null?null:new(1,period!,status,score,1)};
  var result=PayrollEngine.Calculate(input);
  Assert.Equal(20000,result.BaseSalary);Assert.Equal(0,result.KpiBonus);Assert.Equal(20000,result.Net);
  if(status!="APPROVED"||score==null||period!="2026-10")Assert.Contains("thưởng KPI bằng 0",Assert.Single(result.Lines,x=>x.Code=="KPI").Formula);
 }
 [Fact] public void InvalidSourcesAndPolicyGapsFailClosed() {
  Assert.Throws<BusinessException>(()=>PayrollEngine.Calculate(Input(Sheet() with{Errors=["missing checkout"]})));
  Assert.Throws<BusinessException>(()=>PayrollEngine.Calculate(Input(profiles:[])));
  var r=Rules();r.OvertimeMultipliers.Remove("REST");Assert.Throws<BusinessException>(()=>PayrollEngine.Validate(r));
  Assert.Throws<BusinessException>(()=>PayrollEngine.Calculate(Input(Sheet() with{Days=Sheet().Days.Skip(1).ToArray()})));
 }
 private static async Task<LeaveWorkflowTests.Fixture> Setup(string? path=null) {
  var f=await LeaveWorkflowTests.Fixture.Create(path);
  foreach(var code in new[]{PayrollScreens.Salary,PayrollScreens.Payroll,PayrollScreens.Mine})await OrganizationApiTests.Grant(f.H.App,code);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var root=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");var hr=await db.Set<Role>().SingleAsync(x=>x.Code=="HR_APPROVER");
   foreach(var code in new[]{PayrollScreens.Salary,PayrollScreens.Payroll,PayrollScreens.Mine}) {
    var screen=await db.Screens.SingleAsync(x=>x.Code==code);var detail=await db.Set<RoleDetail>().SingleAsync(x=>x.RoleID==root.ID&&x.ScreenID==screen.ID);detail.CanApprove="Y";detail.CanExport="Y";
    foreach(var action in new[]{"VIEW","NEW","UPDATE","APPROVE","EXPORT"})db.Add(new RoleScreenAction{RoleID=root.ID,ScreenID=screen.ID,ActionCode=action,DataScope="ALL"});
    if(code==PayrollScreens.Payroll) {db.Add(new RoleDetail{RoleID=hr.ID,ScreenID=screen.ID,CanView="Y",CanApprove="Y"});foreach(var action in new[]{"VIEW","APPROVE"})db.Add(new RoleScreenAction{RoleID=hr.ID,ScreenID=screen.ID,ActionCode=action,DataScope="ALL"});}
   }
   var policy=new PayrollPolicy {Code="SYNTHETIC",Name="Test only",EffectiveFrom=new(2020,1,1),Status="PUBLISHED",RulesJson=JsonSerializer.Serialize(Rules(),new JsonSerializerOptions(JsonSerializerDefaults.Web)),LegalReference="Synthetic test, not a legal policy"};
   var source=new TimesheetPeriod {PeriodKey="2026-10",Status="LOCKED",ClosedAt=new(2026,11,1),InputHash="test-source"};db.AddRange(policy,source);await db.SaveChangesAsync();
   foreach(var employee in new[]{f.H.Self,f.H.Other})db.AddRange(new TimesheetDetail {PeriodID=source.ID,EmployeeID=employee,SnapshotJson=JsonSerializer.Serialize(Sheet(employee),new JsonSerializerOptions(JsonSerializerDefaults.Web)),UniqueKey=$"{source.ID}:{employee}"},new SalaryProfile{EmployeeID=employee,BaseSalary=20000,EffectiveFrom=new(2020,1,1),PayBasis="MONTH",CurrencyCode="VND",IsVerified=true,ItemsJson="[]",Reason="Initial test salary"});await db.SaveChangesAsync();
  }
  await OrganizationApiTests.Login(f.H.Client,f.H.App);
  var settings=await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings");
  var response=await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest{Version=settings!.Version,Routes=[new(){RequestType="PAYROLL_PERIOD",Steps=[new(){ApproverType="HR",UserId="hr",RoleCode="HR_APPROVER"}]}]});Assert.True(response.IsSuccessStatusCode,await response.Content.ReadAsStringAsync());return f;
 }
 private static async Task<JsonElement> Post(LeaveWorkflowTests.Fixture f,string path,object body,bool wrapped=true) {
  var r=await f.H.Client.PostAsJsonAsync(path,body);Assert.True(r.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await r.Content.ReadAsStringAsync());var result=await r.Content.ReadFromJsonAsync<JsonElement>();return wrapped?result.GetProperty("data"):result;
 }
 [Theory]
 [InlineData("DEPARTMENT_MANAGER","manager")]
 [InlineData("TEAM_LEAD","lead")]
 public async Task GlobalPayrollResolvesOrganizationalApproverFromSubmitter(string approverType,string expectedUser) {
  await using var f=await Setup();
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
   var role=await db.Set<Role>().SingleAsync(x=>x.Code==(expectedUser=="manager"?"MANAGER":"LEAD"));
   var screen=await db.Screens.SingleAsync(x=>x.Code==PayrollScreens.Payroll);
   db.Add(new RoleDetail{RoleID=role.ID,ScreenID=screen.ID,CanView="Y",CanApprove="Y"});
   foreach(var action in new[]{"VIEW","APPROVE"})db.Add(new RoleScreenAction{RoleID=role.ID,ScreenID=screen.ID,ActionCode=action,DataScope="DEPARTMENT"});
   await db.SaveChangesAsync();
   // Only the other department is being paid. Approval must still follow the sender.
   await db.Set<TimesheetDetail>().Where(x=>x.EmployeeID==f.H.Self).ExecuteDeleteAsync();
  }
  var config=await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings");
  (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest{Version=config!.Version,Routes=[new(){RequestType="PAYROLL_PERIOD",AllowSelfApproval=false,Steps=[new(){ApproverType=approverType}]}]})).EnsureSuccessStatusCode();
  var p=await Post(f,"/api/payroll/periods",new{periodKey="2026-10"});var id=p.GetProperty("id").GetInt64();var url=$"/api/payroll/periods/{id}";
  await Post(f,url+"/calculate",new{version=1,requestKey="org-approver"},false);
  p=await Post(f,url+"/submit",new{version=2});var approvalId=p.GetProperty("approvalId").GetInt64();
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
   var request=await db.Set<HRM.API.Modules.Approvals.Entities.ApprovalRequest>().SingleAsync(x=>x.ID==approvalId);
   Assert.Equal(f.H.Self,request.EmployeeId);
   Assert.Equal(expectedUser,(await db.Set<HRM.API.Modules.Approvals.Entities.ApprovalStep>().SingleAsync(x=>x.ApprovalRequestID==approvalId)).ApproverUserID);
  }
  // Assignment does not bypass the manager's department data scope for a global batch.
  using var approver=await f.As(expectedUser);
  Assert.Equal(HttpStatusCode.NotFound,(await approver.PostAsJsonAsync($"/api/approvals/{approvalId}/approve",new{version=1,reason="Scope remains enforced"})).StatusCode);
 }
 [Fact] public async Task LifecycleIdempotencySnapshotsPdfAndPaymentConfirmation() {
  await using var f=await Setup();var c=f.H.Client;
  var p=await Post(f,"/api/payroll/periods",new{periodKey="2026-10"});var id=p.GetProperty("id").GetInt64();var root=$"/api/payroll/periods/{id}";
  var request=new{version=1,requestKey="payroll-test-first"};var calc=await Post(f,root+"/calculate",request,false);Assert.Equal("REVIEW",calc.GetProperty("status").GetString());
  var again=await Post(f,root+"/calculate",request,false);Assert.Equal(2,again.GetProperty("version").GetInt64());
  Assert.Equal(0,(await c.GetFromJsonAsync<JsonElement>("/api/payslips/me")).GetProperty("total").GetInt32());
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync(root+"/lock",new{version=2})).StatusCode);
  p=await Post(f,root+"/submit",new{version=2});var approval=p.GetProperty("approvalId").GetInt64();
  Assert.Equal(HttpStatusCode.Forbidden,(await f.Decide(approval,"api-user")).StatusCode);
  using(var restrictedScope=f.H.App.Services.CreateScope()) {
   var restrictedDb=restrictedScope.ServiceProvider.GetRequiredService<AppDbContext>();await restrictedDb.Set<RoleScreenAction>().Where(x=>restrictedDb.Set<Role>().Any(r=>r.ID==x.RoleID&&r.Code=="HR_APPROVER")&&restrictedDb.Screens.Any(s=>s.ID==x.ScreenID&&s.Code=="WEB_APPROVALS")&&x.ActionCode=="APPROVE").ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"DEPARTMENT"));
  }
  using(var hr=await f.As("hr"))Assert.Equal(HttpStatusCode.NotFound,(await hr.PostAsJsonAsync($"/api/approvals/{approval}/approve",new{version=1,reason="Cannot cross approval scope"})).StatusCode);
  using(var restoreScope=f.H.App.Services.CreateScope()) {
   var restoreDb=restoreScope.ServiceProvider.GetRequiredService<AppDbContext>();await restoreDb.Set<RoleScreenAction>().Where(x=>restoreDb.Set<Role>().Any(r=>r.ID==x.RoleID&&r.Code=="HR_APPROVER")&&restoreDb.Screens.Any(s=>s.ID==x.ScreenID&&s.Code=="WEB_APPROVALS")&&x.ActionCode=="APPROVE").ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"ALL"));
  }
  (await f.Decide(approval,"hr")).EnsureSuccessStatusCode();
  long profile,policy;using(var futureScope=f.H.App.Services.CreateScope()) {var futureDb=futureScope.ServiceProvider.GetRequiredService<AppDbContext>();profile=await futureDb.Set<SalaryProfile>().Where(x=>x.EmployeeID==f.H.Self).Select(x=>x.ID).SingleAsync();policy=await futureDb.Set<PayrollPolicy>().Select(x=>x.ID).SingleAsync();}
  await Post(f,"/api/salary-configuration/profiles",new{employeeId=f.H.Self,baseSalary=30000,effectiveFrom="2026-11-01",reason="Future month raise",supersedeProfileId=profile,supersedeVersion=1});
  var nextPolicy=await Post(f,"/api/salary-configuration/policies",new{code="NEXT_MONTH",name="Next month policy",effectiveFrom="2026-11-01",legalReference="Synthetic test only",rules=Rules()});
  await Post(f,$"/api/salary-configuration/policies/{nextPolicy.GetProperty("id").GetInt64()}/publish",new{version=1,supersedePolicyId=policy,supersedeVersion=1});
  await Post(f,root+"/lock",new{version=4});var mine=await c.GetFromJsonAsync<JsonElement>("/api/payslips/me?periodKey=2026-10");Assert.Equal(1,mine.GetProperty("total").GetInt32());var payslip=mine.GetProperty("data")[0].GetProperty("id").GetInt64();
  var pdf=await c.GetAsync($"/api/payslips/me/{payslip}/pdf");pdf.EnsureSuccessStatusCode();var bytes=await pdf.Content.ReadAsByteArrayAsync();Assert.StartsWith("%PDF-1.7",System.Text.Encoding.ASCII.GetString(bytes));Assert.Contains("/ToUnicode",System.Text.Encoding.ASCII.GetString(bytes));
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync(root+"/calculate",new{version=5,requestKey="cannot-recalculate-locked"})).StatusCode);
  Assert.Equal(HttpStatusCode.BadRequest,(await c.PostAsJsonAsync(root+"/paid",new{version=5,reference="",paidAt="2026-11-17T04:00:00Z"})).StatusCode);
  await Post(f,root+"/paid",new{version=5,reference="BANK-TEST-1",paidAt="2026-11-17T05:00:00Z"});
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(2,await db.Set<PayrollDetail>().CountAsync());Assert.All(await db.Set<AuditLog>().Where(x=>x.EntityType.StartsWith("Payroll")).ToListAsync(),x=>Assert.DoesNotContain("20000",x.AfterJSON??""));
 }
 [Fact] public async Task ScopeAndOwnPayslipNeverExposeOtherSalary() {
  await using var f=await Setup();var c=f.H.Client;var p=await Post(f,"/api/payroll/periods",new{periodKey="2026-10"});var id=p.GetProperty("id").GetInt64();await Post(f,$"/api/payroll/periods/{id}/calculate",new{version=1,requestKey="scope-calculation"},false);
  long other;using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();other=await db.Set<PayrollDetail>().Where(x=>x.EmployeeID==f.H.Other).Select(x=>x.ID).SingleAsync();var roles=await db.Set<Role>().Where(x=>x.Code=="HR").Select(x=>x.ID).ToListAsync();await db.Set<RoleScreenAction>().Where(x=>roles.Contains(x.RoleID)&&db.Screens.Any(s=>s.ID==x.ScreenID&&s.Code==PayrollScreens.Payroll)).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"SELF"));}
  Assert.Equal(1,(await c.GetFromJsonAsync<JsonElement>("/api/payroll/payslips")).GetProperty("total").GetInt32());
  var scopedStats=await c.GetAsync("/api/payroll/statistics");Assert.True(scopedStats.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await scopedStats.Content.ReadAsStringAsync());Assert.Equal(20000,(await scopedStats.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("gross").GetDecimal());Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync($"/api/payroll/payslips/{other}")).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await c.PostAsJsonAsync($"/api/payroll/periods/{id}/calculate",new{version=2,requestKey="self-recalculate"})).StatusCode);
  var excel=await c.GetAsync("/api/payroll/export");excel.EnsureSuccessStatusCode();using(var archive=new global::System.IO.Compression.ZipArchive(new MemoryStream(await excel.Content.ReadAsByteArrayAsync()))) {using var reader=new StreamReader(archive.GetEntry("xl/worksheets/sheet1.xml")!.Open());var sheet=global::System.Xml.Linq.XDocument.Parse(await reader.ReadToEndAsync());Assert.Equal(2,sheet.Descendants().Count(x=>x.Name.LocalName=="row"));}
  using(var services=f.H.App.Services.CreateScope()) {var db=services.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<RoleDetail>().Where(x=>db.Set<Role>().Any(r=>r.ID==x.RoleID&&r.Code=="HR")&&db.Screens.Any(s=>s.ID==x.ScreenID&&s.Code==PayrollScreens.Payroll)).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CanExport,"N"));}
  Assert.Equal(HttpStatusCode.Forbidden,(await c.GetAsync("/api/payroll/export")).StatusCode);
  Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync($"/api/payslips/me/{other}")).StatusCode);Assert.Equal(HttpStatusCode.NotFound,(await c.GetAsync($"/api/payslips/me/{other}/pdf")).StatusCode);
 }
 [Fact] public async Task DuplicatePeriodAndOverlappingSalaryAreRejected() {
  await using var f=await Setup();await Post(f,"/api/payroll/periods",new{periodKey="2026-10"});Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync("/api/payroll/periods",new{periodKey="2026-10"})).StatusCode);
  var r=await f.H.Client.PostAsJsonAsync("/api/salary-configuration/profiles",new{employeeId=f.H.Self,baseSalary=30000,effectiveFrom="2026-10-01",reason="Raise"});Assert.Equal(HttpStatusCode.Conflict,r.StatusCode);
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(2,await db.Set<SalaryProfile>().CountAsync());
 }
 [Fact] public async Task InvalidCalculationNeverLocksOrPublishesPartialPayroll() {
  await using var f=await Setup();using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<SalaryProfile>().Where(x=>x.EmployeeID==f.H.Other).ExecuteDeleteAsync();}
  var p=await Post(f,"/api/payroll/periods",new{periodKey="2026-10"});var id=p.GetProperty("id").GetInt64();var r=await Post(f,$"/api/payroll/periods/{id}/calculate",new{version=1,requestKey="invalid-calculation"},false);Assert.Equal("OPEN",r.GetProperty("status").GetString());Assert.False(r.GetProperty("success").GetBoolean());
  using var services=f.H.App.Services.CreateScope();Assert.Empty(await services.ServiceProvider.GetRequiredService<AppDbContext>().Set<PayrollDetail>().ToListAsync());
 }
 [Fact] public async Task ConcurrentCreationProducesOnePeriod() {
  var path=Path.Combine(Path.GetTempPath(),"payroll-"+Guid.NewGuid()+".db");
  try {await using var f=await Setup(path);
   var calls=await Task.WhenAll(Enumerable.Range(0,2).Select(_=>Task.Run(()=>f.H.Client.PostAsJsonAsync("/api/payroll/periods",new{periodKey="2026-10"}))));
   Assert.Single(calls,x=>x.IsSuccessStatusCode);Assert.Single(calls,x=>x.StatusCode==HttpStatusCode.Conflict);
   long id;using(var scope=f.H.App.Services.CreateScope())id=Assert.Single(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<PayrollPeriod>().ToListAsync()).ID;
   var calculated=await Task.WhenAll(Enumerable.Range(0,2).Select(_=>Task.Run(()=>f.H.Client.PostAsJsonAsync($"/api/payroll/periods/{id}/calculate",new{version=1,requestKey="same-concurrent-key"}))));
   Assert.All(calculated,x=>Assert.True(x.IsSuccessStatusCode));
   using var check=f.H.App.Services.CreateScope();var db=check.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(2,await db.Set<PayrollDetail>().CountAsync());Assert.Equal(2,(await db.Set<PayrollPeriod>().SingleAsync()).Version);
  } finally {Microsoft.Data.Sqlite.SqliteConnection.ClearAllPools();if(File.Exists(path))File.Delete(path);}
 }
 [Fact] public async Task AdjustmentIsIdempotentAndRecalculationUsesNewSnapshot() {
  await using var f=await Setup();var c=f.H.Client;
  var comp=await Post(f,"/api/salary-configuration/components",new{code="SPECIAL_BONUS",name="Bonus",kind="EARNING",taxable=true});
  var period=await Post(f,"/api/payroll/periods",new{periodKey="2026-10"});var id=period.GetProperty("id").GetInt64();var url=$"/api/payroll/periods/{id}";
  var body=new{employeeId=f.H.Self,componentId=comp.GetProperty("id").GetInt64(),amount=500,reason="Approved bonus",requestKey="bonus-idempotent"};
  var a=await Post(f,url+"/adjustments",body);var again=await Post(f,url+"/adjustments",body);Assert.Equal(a.GetProperty("id").GetInt64(),again.GetProperty("id").GetInt64());
  await Post(f,url+"/calculate",new{version=2,requestKey="with-adjustment"},false);
  var rows=await c.GetFromJsonAsync<JsonElement>($"/api/payroll/payslips?employeeId={f.H.Self}");Assert.Equal(20500,rows.GetProperty("data")[0].GetProperty("gross").GetDecimal());
  await Post(f,url+"/adjustments/"+a.GetProperty("id").GetInt64()+"/cancel",new{version=1});
  await Post(f,url+"/calculate",new{version=4,requestKey="without-adjustment"},false);
  rows=await c.GetFromJsonAsync<JsonElement>($"/api/payroll/payslips?employeeId={f.H.Self}");Assert.Equal(20000,rows.GetProperty("data")[0].GetProperty("gross").GetDecimal());
 }
 [Fact] public async Task SourcePreparationRequiresMonthEndAndRejectsStaleVersion() {
  await using var f=await Setup();var c=f.H.Client;
  var period=await Post(f,"/api/payroll/timesheets",new{periodKey="2026-11"});var id=period.GetProperty("id").GetInt64();var url=$"/api/payroll/timesheets/{id}";
  var calc=await Post(f,url+"/calculate",new{version=1,requestKey="source-first-pass"},false);Assert.Equal(2,calc.GetProperty("version").GetInt64());
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync(url+"/lock",new{version=2})).StatusCode);
  Assert.Equal(HttpStatusCode.Conflict,(await c.PostAsJsonAsync(url+"/calculate",new{version=1,requestKey="stale-source-version"})).StatusCode);
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal("OPEN",(await db.Set<TimesheetPeriod>().SingleAsync(x=>x.ID==id)).Status);
 }

 [Fact] public async Task DepartmentScopeCreatesOnlyOwnBatchAndLiveMultiRoleScopeWidensViews() {
  await using var f=await Setup();using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var role=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");var screen=await db.Screens.SingleAsync(x=>x.Code==PayrollScreens.Payroll);
   await db.Set<RoleScreenAction>().Where(x=>x.RoleID==role.ID&&x.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"DEPARTMENT"));
  }
  Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.PostAsJsonAsync("/api/payroll/periods",new{periodKey="2026-10"})).StatusCode);
  var p=await Post(f,"/api/payroll/periods",new{periodKey="2026-10",departmentId=f.H.Department});var id=p.GetProperty("id").GetInt64();
  var receipt=await Post(f,$"/api/payroll/periods/{id}/calculate",new{version=1,requestKey="department-calculate"},false);Assert.Equal(1,receipt.GetProperty("employees").GetInt32());
  Assert.Equal(1,(await f.H.Client.GetFromJsonAsync<JsonElement>("/api/payroll/payslips")).GetProperty("total").GetInt32());
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var screen=await db.Screens.SingleAsync(x=>x.Code==PayrollScreens.Payroll);var role=new Role{Code="EXTRA_PAYROLL",Name="Extra payroll view"};db.Add(role);await db.SaveChangesAsync();db.AddRange(new UserRole{UserID="api-user",RoleID=role.ID},new RoleDetail{RoleID=role.ID,ScreenID=screen.ID,CanView="Y"},new RoleScreenAction{RoleID=role.ID,ScreenID=screen.ID,ActionCode="VIEW",DataScope="ALL"});await db.SaveChangesAsync();
   var source=await db.Set<TimesheetPeriod>().SingleAsync();var other=new PayrollPeriod{PeriodKey="2026-10",ScopeKey="DEPARTMENT:OTHER",DepartmentId=(await db.Employees.SingleAsync(x=>x.Id==f.H.Other)).DepartmentId,TimesheetPeriodID=source.ID,Status="REVIEW",InputHash="verified-test",PolicyId=(await db.Set<PayrollPolicy>().SingleAsync()).ID};db.Add(other);await db.SaveChangesAsync();db.Add(new PayrollDetail{PayrollPeriodID=other.ID,EmployeeID=f.H.Other,CalculationSnapshot="{}",UniqueKey=$"{other.ID}:{f.H.Other}",EmployeePeriodKey=$"2026-10:{f.H.Other}",GrossSalary=123,NetSalary=123});await db.SaveChangesAsync();
  }
  Assert.Equal(2,(await f.H.Client.GetFromJsonAsync<JsonElement>("/api/payroll/payslips")).GetProperty("total").GetInt32());
 }

 [Fact] public async Task SalaryChangePreservesAmountsAndRequiresBothNewAndUpdateScopes() {
  await using var f=await Setup();long profile;using(var scope=f.H.App.Services.CreateScope())profile=await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<SalaryProfile>().Where(x=>x.EmployeeID==f.H.Self).Select(x=>x.ID).SingleAsync();
  await Post(f,"/api/salary-configuration/profiles",new{employeeId=f.H.Self,baseSalary=30000,effectiveFrom="2026-11-01",reason="Approved salary increase",supersedeProfileId=profile,supersedeVersion=1});
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var previous=await db.Set<SalaryProfile>().SingleAsync(x=>x.ID==profile);Assert.Equal(20000,previous.BaseSalary);Assert.Equal(new DateOnly(2026,10,31),previous.EffectiveTo);
   var role=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");var screen=await db.Screens.SingleAsync(x=>x.Code==PayrollScreens.Salary);await db.Set<RoleDetail>().Where(x=>x.RoleID==role.ID&&x.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CanUpdate,"N"));
   profile=await db.Set<SalaryProfile>().Where(x=>x.EmployeeID==f.H.Self&&x.EffectiveFrom==new DateOnly(2026,11,1)).Select(x=>x.ID).SingleAsync();
  }
  Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.PostAsJsonAsync("/api/salary-configuration/profiles",new{employeeId=f.H.Self,baseSalary=40000,effectiveFrom="2026-12-01",reason="Unauthorized close",supersedeProfileId=profile,supersedeVersion=1})).StatusCode);
  using var services=f.H.App.Services.CreateScope();Assert.Null((await services.ServiceProvider.GetRequiredService<AppDbContext>().Set<SalaryProfile>().SingleAsync(x=>x.ID==profile)).EffectiveTo);
 }

 [Theory]
 [InlineData(true,true,1)]
 [InlineData(true,false,1)]
 [InlineData(false,true,1)]
 [InlineData(false,false,0)]
 public async Task RegularPunchPresenceDeterminesPayableDayWithoutBlockingLock(bool hasIn,bool hasOut,int expectedDays) {
  await using var f=await Setup();
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();
   var shift=new HRM.API.Modules.Attendance.Entities.Shift{Code="PUNCH",Name="Day",StartTime=new(8,0),EndTime=new(17,0),BreakMinutes=60,IsActive=true};db.Add(shift);await db.SaveChangesAsync();
   var date=new DateOnly(2026,9,1);var start=PayrollEngine.LocalUtc(date,new(8,0));var end=PayrollEngine.LocalUtc(date,new(17,0));
   var snapshot=new HRM.API.Modules.Attendance.DTOs.AttendanceRuleSnapshot(date,"Asia/Ho_Chi_Minh",shift.ID,"PUNCH",start,end,start.AddHours(-1),start.AddHours(4),end.AddHours(-4),end.AddHours(3),60,5,5,false,false,"REJECT_CHECKOUT_WITHOUT_CHECKIN",[],1);
   var schedule=new HRM.API.Modules.Attendance.Entities.WorkSchedule{EmployeeID=f.H.Self,ShiftID=shift.ID,WorkDate=date,Status="ASSIGNED",UniqueWorkKey=$"{f.H.Self}:2026-09-01",RulesSnapshotJson=JsonSerializer.Serialize(snapshot,new JsonSerializerOptions(JsonSerializerDefaults.Web))};db.Add(schedule);await db.SaveChangesAsync();
   db.Add(new HRM.API.Modules.Attendance.Entities.Attendance{ScheduleID=schedule.ID,CheckInAt=hasIn?start.AddHours(1):null,CheckOutAt=hasOut?end.AddHours(-1):null,LateMinutes=hasIn?60:0,EarlyMinutes=hasOut?60:0,Status="COMPLETED"});await db.SaveChangesAsync();
  }
  var source=await Post(f,"/api/payroll/timesheets",new{periodKey="2026-09"});var id=source.GetProperty("id").GetInt64();var url=$"/api/payroll/timesheets/{id}";
  await Post(f,url+"/calculate",new{version=1,requestKey="punch-policy"},false);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var detail=await db.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==id&&x.EmployeeID==f.H.Self);
   Assert.Equal(expectedDays,detail.WorkedDays);
   var snapshot=JsonSerializer.Deserialize<TimesheetSnapshot>(detail.SnapshotJson!,new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
   Assert.Empty(snapshot.Errors);Assert.NotEmpty(snapshot.Warnings);
   var day=Assert.Single(snapshot.Days,x=>x.ScheduleId!=null);Assert.Equal(hasIn&&hasOut?360:0,day.WorkedMinutes);
   Assert.Equal(expectedDays*480,day.PayableWorkedMinutes??0);Assert.Empty(day.Overtime);
  }
  await Post(f,url+"/lock",new{version=2});
 }

 [Fact] public async Task TimesheetUsesShiftSnapshotAndActualApprovedOvertimeAndLocksSources() {
  await using var f=await Setup();long overtimeId;
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var shift=new HRM.API.Modules.Attendance.Entities.Shift{Code="DAY",Name="Day",StartTime=new(8,0),EndTime=new(17,0),BreakMinutes=60,IsActive=true};db.Add(shift);await db.SaveChangesAsync();
   var date=new DateOnly(2026,9,1);var start=PayrollEngine.LocalUtc(date,new(8,0));var end=PayrollEngine.LocalUtc(date,new(17,0));
   var snapshot=new HRM.API.Modules.Attendance.DTOs.AttendanceRuleSnapshot(date,"Asia/Ho_Chi_Minh",shift.ID,"DAY",start,end,start.AddHours(-1),start.AddHours(4),end.AddHours(-4),end.AddHours(3),60,5,5,false,false,"REJECT_CHECKOUT_WITHOUT_CHECKIN",[],1);
   var schedule=new HRM.API.Modules.Attendance.Entities.WorkSchedule{EmployeeID=f.H.Self,ShiftID=shift.ID,WorkDate=date,Status="ASSIGNED",UniqueWorkKey=$"{f.H.Self}:2026-09-01",RulesSnapshotJson=JsonSerializer.Serialize(snapshot,new JsonSerializerOptions(JsonSerializerDefaults.Web))};db.Add(schedule);await db.SaveChangesAsync();
   var overtime=new HRM.API.Modules.Leave.Entities.OvertimeRequest{EmployeeID=f.H.Self,StartAt=end,EndAt=end.AddHours(2),RequestedHours=2,Status="PENDING",Reason="Test"};
   db.AddRange(new HRM.API.Modules.Attendance.Entities.Attendance{ScheduleID=schedule.ID,CheckInAt=start,CheckOutAt=end.AddHours(2),Status="COMPLETED"},overtime);await db.SaveChangesAsync();overtimeId=overtime.ID;
   // Changing the live shift must not alter the already assigned work snapshot.
   shift.BreakMinutes=0;await db.SaveChangesAsync();
  }
  var source=await Post(f,"/api/payroll/timesheets",new{periodKey="2026-09"});var id=source.GetProperty("id").GetInt64();var url=$"/api/payroll/timesheets/{id}";
  await Post(f,url+"/calculate",new{version=1,requestKey="source-pending-ot"},false);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var d=await db.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==id&&x.EmployeeID==f.H.Self);Assert.Equal(1,d.WorkedDays);Assert.Equal(0,d.OvertimeHours);
   var overtime=await db.Set<HRM.API.Modules.Leave.Entities.OvertimeRequest>().SingleAsync(x=>x.ID==overtimeId);overtime.Status="APPROVED";overtime.ApprovedHours=2;await db.SaveChangesAsync();
  }
  Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync(url+"/lock",new{version=2})).StatusCode);
  await Post(f,url+"/calculate",new{version=2,requestKey="source-approved-ot"},false);await Post(f,url+"/lock",new{version=3});
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var d=await db.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==id&&x.EmployeeID==f.H.Self);Assert.Equal(2,d.OvertimeHours);
   await Assert.ThrowsAsync<BusinessException>(()=>TimesheetLocks.RequireOpen(db,new(2026,9,1),default));
  }
 }

 [Fact] public async Task LegacyUnverifiedPayslipsAreNotPresentedAsZeroGrossSalary() {
  await using var f=await Setup();using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var source=await db.Set<TimesheetPeriod>().SingleAsync();var p=new PayrollPeriod{PeriodKey="2026-09",TimesheetPeriodID=source.ID,Status="LOCKED"};db.Add(p);await db.SaveChangesAsync();db.Add(new PayrollDetail{EmployeeID=f.H.Self,PayrollPeriodID=p.ID,BaseSalary=20000,NetSalary=20000,CalculationSnapshot="{}"});await db.SaveChangesAsync();
  }
  Assert.Equal(0,(await f.H.Client.GetFromJsonAsync<JsonElement>("/api/payslips/me?periodKey=2026-09")).GetProperty("total").GetInt32());
  var stats=await f.H.Client.GetAsync("/api/payroll/statistics?periodKey=2026-09");Assert.True(stats.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await stats.Content.ReadAsStringAsync());Assert.Equal(0,(await stats.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("employees").GetInt32());
 }

}
