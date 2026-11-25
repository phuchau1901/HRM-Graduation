using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Services;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
namespace HRM.API.Tests;
public sealed class UnscheduledAttendanceTests {
 private static AttendanceTestClock Clock(LeaveWorkflowTests.Fixture f)=>(AttendanceTestClock)f.H.App.TestClock!;
 private static async Task<LeaveWorkflowTests.Fixture> Setup() {
  var f=await LeaveWorkflowTests.Fixture.Create();
  foreach(var code in new[]{AttendanceScreens.MyAttendance,AttendanceScreens.Attendance,PayrollScreens.Payroll})await OrganizationApiTests.Grant(f.H.App,code);
  using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var root=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");
  foreach(var code in new[]{AttendanceScreens.Attendance,PayrollScreens.Payroll}) {var screen=await db.Screens.SingleAsync(x=>x.Code==code);(await db.RoleDetails.SingleAsync(x=>x.RoleID==root.ID&&x.ScreenID==screen.ID)).CanApprove="Y";foreach(var action in new[]{"VIEW","NEW","UPDATE","APPROVE"})db.Add(new RoleScreenAction{RoleID=root.ID,ScreenID=screen.ID,ActionCode=action,DataScope="ALL"});}
  await db.SaveChangesAsync();await OrganizationApiTests.Login(f.H.Client,f.H.App);
  var config=(await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
  foreach(var route in config.Routes.Where(x=>x.RequestType=="OVERTIME"))route.Steps=[new(){ApproverType="TEAM_LEAD"},new(){ApproverType="DEPARTMENT_MANAGER"}];
  (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest{Version=config.Version,Routes=config.Routes.ToArray()})).EnsureSuccessStatusCode();return f;
 }
 private static async Task Approve(LeaveWorkflowTests.Fixture f,long id){(await f.Decide(id,"lead")).EnsureSuccessStatusCode();(await f.Decide(id,"manager")).EnsureSuccessStatusCode();}
 private static async Task<AttendanceView> Punch(LeaveWorkflowTests.Fixture f,bool checkIn,string key) {
  var r=await f.H.Client.PostAsJsonAsync("/api/attendances/"+(checkIn?"check-in":"check-out"),new{requestKey=key});Assert.True(r.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await r.Content.ReadAsStringAsync());return (await r.Content.ReadFromJsonAsync<AttendanceView>())!;
 }
 private static async Task<JsonElement> Source(LeaveWorkflowTests.Fixture f,string month) {
  var r=await f.H.Client.PostAsJsonAsync("/api/payroll/timesheets",new{periodKey=month});Assert.True(r.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await r.Content.ReadAsStringAsync());return (await r.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data");
 }
 private static async Task<PayrollReceipt> Calculate(LeaveWorkflowTests.Fixture f,long id,long version,string key) {
  var r=await f.H.Client.PostAsJsonAsync($"/api/payroll/timesheets/{id}/calculate",new{version,requestKey=key});Assert.True(r.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await r.Content.ReadAsStringAsync());return (await r.Content.ReadFromJsonAsync<PayrollReceipt>())!;
 }
 [Fact] public async Task CapturesActualTimeWithoutShiftAndOnlyPaysAfterFinalApproval() {
  await using var f=await Setup();var first=await Punch(f,true,"raw-checkin");Assert.Null(first.ScheduleId);Assert.Equal("UNSCHEDULED",first.RecordType);Assert.Equal("OPEN",first.Status);
  Assert.Equal(first.Id,(await Punch(f,true,"raw-checkin")).Id);Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync("/api/attendances/check-in",new{requestKey="duplicate-open"})).StatusCode);
  Clock(f).Now=Clock(f).Now.AddHours(2);var finished=await Punch(f,false,"raw-checkout");Assert.Equal("PENDING",finished.Status);Assert.NotNull(finished.ApprovalId);Assert.Equal(120,finished.WorkedMinutes);
  var source=await Source(f,"2026-11");var sourceId=source.GetProperty("id").GetInt64();var pending=await Calculate(f,sourceId,1,"raw-pending-source");Assert.False(pending.Success);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Null((await db.Set<OvertimeRequest>().SingleAsync()).ApprovedHours);Assert.Empty(await db.Set<WorkSchedule>().ToListAsync());Assert.Empty(await db.Set<HRM.API.Modules.Attendance.Entities.Attendance>().ToListAsync());
   Assert.Equal(0,(await db.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==sourceId&&x.EmployeeID==f.H.Self)).OvertimeHours);
  }
  Clock(f).Now=new(2026,12,1,3,0,0,TimeSpan.Zero);Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync($"/api/payroll/timesheets/{sourceId}/lock",new{version=2})).StatusCode);
  await Approve(f,finished.ApprovalId!.Value);var approved=await Calculate(f,sourceId,2,"raw-approved-source");Assert.True(approved.Success);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var detail=await db.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==sourceId&&x.EmployeeID==f.H.Self);Assert.Equal(2,detail.OvertimeHours);Assert.Equal(0,detail.WorkedDays);
   var snapshot=JsonSerializer.Deserialize<TimesheetSnapshot>(detail.SnapshotJson!,new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
   var rules=PayrollTests.Rules();var profile=PayrollTests.Profile();var calculated=PayrollEngine.Calculate(new("2026-11",snapshot,[profile],[],rules,null));Assert.Equal(375,calculated.OvertimePay);Assert.Equal(0,calculated.BaseSalary);
   Assert.Equal("APPROVED",(await db.Set<UnscheduledAttendance>().SingleAsync()).Status);
  }
  Assert.Equal(first.Id,(await Punch(f,false,"raw-checkout")).Id);
 }
 [Fact] public async Task MissingWorkflowNeverRollsBackClockEvidenceAndCanBeRetried() {
  await using var f=await Setup();using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<SystemSetting>().Where(x=>x.Key==ApprovalWorkflowService.SettingsKey).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.JsonValue,"[]"));}
  var first=await Punch(f,true,"no-route-in");Clock(f).Now=Clock(f).Now.AddHours(1);var end=await Punch(f,false,"no-route-out");Assert.Equal("RECORDED",end.Status);Assert.NotNull(end.ConfirmationMessage);
  using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Empty(await db.Set<OvertimeRequest>().ToListAsync());Assert.NotNull((await db.Set<UnscheduledAttendance>().SingleAsync()).EndAtUtc);}
  var config=(await f.H.Client.GetFromJsonAsync<WorkflowSettingsView>("/api/approval-workflow-settings"))!;
  (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new WorkflowSettingsRequest{Version=config.Version,Routes=[new(){RequestType="OVERTIME",Steps=[new(){ApproverType="TEAM_LEAD"}]}]})).EnsureSuccessStatusCode();
  var submit=await f.H.Client.PostAsJsonAsync($"/api/attendances/unscheduled/{first.Id}/submit",new{version=end.Version,reason="Confirm actual work"});Assert.True(submit.IsSuccessStatusCode,f.H.App.LastException?.ToString()??await submit.Content.ReadAsStringAsync());
  Assert.Equal("PENDING",(await submit.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("data").GetProperty("status").GetString());await Punch(f,false,"no-route-out");
  using var check=f.H.App.Services.CreateScope();Assert.Single(await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<OvertimeRequest>().ToListAsync());
 }
 [Fact] public async Task OwnPunchHasNoScopeOrOvertimeNewGrantButCannotActForAnotherEmployee() {
  await using var f=await Setup();long other;
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.RoleDetails.Where(x=>db.Screens.Any(s=>s.ID==x.ScreenID&&s.Code=="WEB_OVERTIME_REQUESTS")).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CanNew,"N"));
   var root=await db.Set<Role>().SingleAsync(x=>x.Code=="HR");await db.Set<RoleScreenAction>().Where(x=>x.RoleID==root.ID&&db.Screens.Any(s=>s.ID==x.ScreenID&&s.Code==AttendanceScreens.Attendance)).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"DEPARTMENT"));
   var record=new UnscheduledAttendance{EmployeeID=f.H.Other,StartAtUtc=Clock(f).Now.UtcDateTime.AddHours(-1),EndAtUtc=Clock(f).Now.UtcDateTime,Status="RECORDED",SettingsSnapshotJson="{}",RecordedByUserId="api-user",Version=2};db.Add(record);await db.SaveChangesAsync();other=record.ID;
  }
  var me=await Punch(f,true,"owned-no-scope-in");Clock(f).Now=Clock(f).Now.AddHours(1);Assert.Equal("PENDING",(await Punch(f,false,"owned-no-scope-out")).Status);
  Assert.Equal(HttpStatusCode.NotFound,(await f.H.Client.PostAsJsonAsync($"/api/attendances/unscheduled/{other}/submit",new{version=2,reason="Forgery"})).StatusCode);
  Assert.Equal(0,(await f.H.Client.GetFromJsonAsync<JsonElement>($"/api/attendances/unscheduled/me?employeeId={f.H.Other}")).GetProperty("total").GetInt32());
  Assert.Equal(1,(await f.H.Client.GetFromJsonAsync<JsonElement>("/api/attendances/unscheduled")).GetProperty("total").GetInt32());
 }
 [Fact] public async Task OvernightUnscheduledWorkIsSplitAcrossPayrollMonths() {
  await using var f=await Setup();Clock(f).Now=new(2026,11,30,16,30,0,TimeSpan.Zero);await Punch(f,true,"boundary-in");Clock(f).Now=Clock(f).Now.AddHours(1);var end=await Punch(f,false,"boundary-out");await Approve(f,end.ApprovalId!.Value);
  foreach(var month in new[]{"2026-11","2026-12"}) {var source=await Source(f,month);var id=source.GetProperty("id").GetInt64();await Calculate(f,id,1,"source-"+month);
   using var scope=f.H.App.Services.CreateScope();var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Equal(0.5m,(await db.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==id&&x.EmployeeID==f.H.Self)).OvertimeHours);
  }
 }
 [Theory] [InlineData(true)] [InlineData(false)] public async Task RejectionOrOwnerCancellationPreservesEvidenceWithoutPay(bool reject) {
  await using var f=await Setup();if(!reject)using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<SystemSetting>().Where(x=>x.Key==ApprovalWorkflowService.SettingsKey).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.JsonValue,"[]"));}
  var first=await Punch(f,true,"preserve-in");Clock(f).Now=Clock(f).Now.AddHours(1);var end=await Punch(f,false,"preserve-out");
  if(reject)(await f.Decide(end.ApprovalId!.Value,"lead",false)).EnsureSuccessStatusCode();else (await f.H.Client.PostAsJsonAsync($"/api/attendances/unscheduled/{first.Id}/cancel",new{version=end.Version,reason="Wrong session"})).EnsureSuccessStatusCode();
  var source=await Source(f,"2026-11");var id=source.GetProperty("id").GetInt64();Assert.True((await Calculate(f,id,1,"rejected-source")).Success);
  using var services=f.H.App.Services.CreateScope();var db2=services.ServiceProvider.GetRequiredService<AppDbContext>();var raw=await db2.Set<UnscheduledAttendance>().SingleAsync();Assert.NotNull(raw.EndAtUtc);Assert.Equal(reject?"REJECTED":"CANCELLED",raw.Status);Assert.Equal(0,(await db2.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==id&&x.EmployeeID==f.H.Self)).OvertimeHours);
 }
 [Fact] public async Task GpsPolicyIsValidatedAndFrozenForTheOpenRawSession() {
  await using var f=await Setup();var config=new HRM.API.Modules.System.DTOs.AttendanceSettingsRequest{RequireGps=true,Locations=[new(){Code="OFFICE",Name="Office",Latitude=10,Longitude=106,RadiusMeters=100}]};
  using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<SystemSetting>().Where(x=>x.Key=="ATTENDANCE").ExecuteUpdateAsync(s=>s.SetProperty(x=>x.JsonValue,JsonSerializer.Serialize(config,new JsonSerializerOptions(JsonSerializerDefaults.Web))));}
  Assert.Equal(HttpStatusCode.BadRequest,(await f.H.Client.PostAsJsonAsync("/api/attendances/check-in",new{requestKey="gps-required"})).StatusCode);
  var first=await f.H.Client.PostAsJsonAsync("/api/attendances/check-in",new{requestKey="gps-required",latitude=10,longitude=106});first.EnsureSuccessStatusCode();Clock(f).Now=Clock(f).Now.AddHours(1);
  using(var scope=f.H.App.Services.CreateScope()) {var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<SystemSetting>().Where(x=>x.Key=="ATTENDANCE").ExecuteUpdateAsync(s=>s.SetProperty(x=>x.JsonValue,"{}"));}
  var context=await f.H.Client.GetFromJsonAsync<JsonElement>("/api/attendances/punch-context?checkIn=false");Assert.True(context.GetProperty("requireGps").GetBoolean());
  Assert.Equal(HttpStatusCode.BadRequest,(await f.H.Client.PostAsJsonAsync("/api/attendances/check-out",new{requestKey="gps-out"})).StatusCode);
  (await f.H.Client.PostAsJsonAsync("/api/attendances/check-out",new{requestKey="gps-out",latitude=10,longitude=106})).EnsureSuccessStatusCode();
 }
 [Fact] public async Task ExistingOvertimeCanCoverMultipleRealSessionsWithoutDuplicatingRequests() {
  await using var f=await Setup();var start=Clock(f).Now;
  var request=await f.H.Client.PostAsJsonAsync("/api/overtime-requests",new{startAt=start.AddMinutes(-10),endAt=start.AddHours(3),reason="Planned overtime"});request.EnsureSuccessStatusCode();var approval=(await request.Content.ReadFromJsonAsync<HRM.API.Modules.Leave.DTOs.WorkflowReceipt>())!.ApprovalId;
  await Punch(f,true,"first-actual-in");Clock(f).Now=start.AddHours(1);var a=await Punch(f,false,"first-actual-out");Assert.Equal(approval,a.ApprovalId);
  Clock(f).Now=start.AddHours(1).AddMinutes(10);await Punch(f,true,"second-actual-in");Clock(f).Now=start.AddHours(2);var b=await Punch(f,false,"second-actual-out");Assert.Equal(approval,b.ApprovalId);
  using(var lead=await f.As("lead")) {var detail=await lead.GetFromJsonAsync<HRM.API.Modules.Approvals.DTOs.ApprovalDetail>($"/api/approvals/{approval}");var payload=(JsonElement)detail!.Details!;Assert.Equal(2,payload.GetProperty("actualEvidence").GetArrayLength());}
  await Approve(f,approval);var source=await Source(f,"2026-11");var id=source.GetProperty("id").GetInt64();await Calculate(f,id,1,"multiple-actual-source");
  using var services=f.H.App.Services.CreateScope();var db2=services.ServiceProvider.GetRequiredService<AppDbContext>();Assert.Single(await db2.Set<OvertimeRequest>().ToListAsync());Assert.Equal(2,await db2.Set<UnscheduledAttendance>().CountAsync());Assert.Equal(1.83m,decimal.Round((await db2.Set<TimesheetDetail>().SingleAsync(x=>x.PeriodID==id&&x.EmployeeID==f.H.Self)).OvertimeHours,2));
 }

 [Fact] public async Task BackfilledScheduleCannotTurnTheSameRawHoursIntoPaidOvertime() {
  await using var f=await Setup();await Punch(f,true,"backfill-in");Clock(f).Now=Clock(f).Now.AddHours(1);var end=await Punch(f,false,"backfill-out");await Approve(f,end.ApprovalId!.Value);
  using(var scope=f.H.App.Services.CreateScope()) {
   var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var raw=await db.Set<UnscheduledAttendance>().SingleAsync();var shift=new Shift{Code="BACKFILL",Name="Backfill",StartTime=new(8,0),EndTime=new(17,0),IsActive=true};db.Add(shift);await db.SaveChangesAsync();
   var date=PayrollEngine.LocalDay(raw.StartAtUtc);var settings=new HRM.API.Modules.System.DTOs.AttendanceSettingsRequest();var rules=HRM.API.Modules.Attendance.Services.AttendanceRules.Snapshot(shift,date,settings,1);
   db.Add(new WorkSchedule{EmployeeID=f.H.Self,ShiftID=shift.ID,WorkDate=date,Status="SCHEDULED",UniqueWorkKey="backfill-test",RulesSnapshotJson=JsonSerializer.Serialize(rules,new JsonSerializerOptions(JsonSerializerDefaults.Web))});await db.SaveChangesAsync();
  }
  var source=await Source(f,"2026-11");Assert.False((await Calculate(f,source.GetProperty("id").GetInt64(),1,"backfill-reconcile")).Success);
 }

}
