using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Dashboard.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Harness=HRM.API.Tests.EmployeeApiTests.Harness;
namespace HRM.API.Tests;
public sealed class DashboardTests {
 private static AttendanceTestClock Clock()=>new(){Now=new(2026,11,25,4,0,0,TimeSpan.Zero)};
 private static async Task Grant(Harness h,string code,string scope="ALL") {
  await OrganizationApiTests.Grant(h.App,code);
  using var services=h.App.Services.CreateScope();var db=services.ServiceProvider.GetRequiredService<AppDbContext>();
  var screen=await db.Screens.SingleAsync(s=>s.Code==code);var role=await db.Set<UserRole>().Where(x=>x.UserID=="api-user").Select(x=>x.RoleID).FirstAsync();
  db.Add(new RoleScreenAction{RoleID=role,ScreenID=screen.ID,ActionCode="VIEW",DataScope=scope});await db.SaveChangesAsync();
  await OrganizationApiTests.Login(h.Client,h.App);
 }
 private static async Task<T> Read<T>(Harness h,string path) {
  var response=await h.Client.GetAsync("/api/dashboard/"+path);Assert.True(response.IsSuccessStatusCode,h.App.LastException?.ToString()??await response.Content.ReadAsStringAsync());
  var body=await response.Content.ReadFromJsonAsync<JsonElement>();return body.GetProperty("data").Deserialize<T>(new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
 }
 [Fact] public async Task AttendanceIncludesNoRecordMissingCheckoutApprovedLeaveAndIndependentViolations() {
  await using var h=await Harness.Create("ALL",clock:Clock());await Grant(h,"WEB_ATTENDANCE");
  using(var services=h.App.Services.CreateScope()) {
   var db=services.ServiceProvider.GetRequiredService<AppDbContext>();var shift=new Shift{Code="DASH",Name="Dashboard day",StartTime=new(8,0),EndTime=new(17,0),BreakMinutes=60,IsActive=true};db.Add(shift);await db.SaveChangesAsync();
   foreach(var (employee,day) in new[]{(h.Self,8),(h.Peer,8),(h.Other,8),(h.Self,9)}) {
    var date=new DateOnly(2026,10,day);var schedule=new WorkSchedule{EmployeeID=employee,ShiftID=shift.ID,WorkDate=date,Status="ASSIGNED",UniqueWorkKey=$"dash:{employee}:{day}",RulesSnapshotJson=JsonSerializer.Serialize(AttendanceRules.Snapshot(shift,date,new AttendanceSettingsRequest(),1),SettingsDefaults.Json)};
    db.Add(schedule);await db.SaveChangesAsync();
    if(employee!=h.Self)db.Add(new HRM.API.Modules.Attendance.Entities.Attendance{ScheduleID=schedule.ID,CheckInAt=new(2026,10,day,1,10,0),CheckOutAt=employee==h.Other?new DateTime(2026,10,day,9,50,0):null,LateMinutes=10,EarlyMinutes=employee==h.Other?10:0,Status="INCOMPLETE"});
   }
   var type=new LeaveType{Code="DASH",Name="Leave",Paid=true};db.Add(type);await db.SaveChangesAsync();
   db.Add(new LeaveRequest{EmployeeID=h.Self,LeaveTypeID=type.ID,FromDate=new(2026,10,9),ToDate=new(2026,10,9),RequestedDays=1,Status="APPROVED"});await db.SaveChangesAsync();
  }
  var a=await Read<AttendanceOverview>(h,"attendance-trend?year=2026&month=10");
  Assert.Equal(4,a.Totals.Scheduled);Assert.Equal(3,a.Totals.Eligible);Assert.Equal(1,a.Totals.Absent);Assert.Equal(1,a.Totals.MissingCheckOut);
  Assert.Equal(2,a.Totals.Present);Assert.Equal(2,a.Totals.Late);Assert.Equal(1,a.Totals.Early);Assert.Equal(1,a.Totals.OnLeave);Assert.Equal(66.67m,a.Totals.PresenceRate);
  ((AttendanceTestClock)h.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,10,8,1,30,0,TimeSpan.Zero);
  var inProgress=await Read<AttendanceOverview>(h,"attendance-trend?year=2026&month=10");
  Assert.Equal(0,inProgress.Totals.Absent);Assert.Equal(0,inProgress.Totals.MissingCheckOut);
  Assert.DoesNotContain(inProgress.Days,d=>d.Date>new DateOnly(2026,10,8));
 }
 [Fact] public async Task ManagerCannotQueryOtherDepartmentAndEmployeeScopeControlsAllCounts() {
  await using var h=await Harness.Create("DEPARTMENT",clock:Clock());await Grant(h,"WEB_ATTENDANCE","DEPARTMENT");
  var summary=await Read<DashboardSummary>(h,"summary?year=2026&month=10");Assert.Equal(2,summary.Employees!.Active);Assert.Null(summary.Employees.Departures);
  var depts=await Read<DepartmentSlice[]>(h,"department-distribution?year=2026&month=10");Assert.Equal(h.Department,Assert.Single(depts).DepartmentId);
  Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync($"/api/dashboard/summary?departmentId={h.OtherDepartment}")).StatusCode);
  Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync($"/api/dashboard/attendance-trend?departmentId={h.OtherDepartment}")).StatusCode);
 }
 [Fact] public async Task EmployeeSeesOnlyOwnPublishedPayslipsAndPersonalScreensNeedNoScope() {
  await using var h=await Harness.Create("SELF",clock:Clock());await Grant(h,"WEB_MY_PAYSLIPS");
  using(var services=h.App.Services.CreateScope()) {
   var db=services.ServiceProvider.GetRequiredService<AppDbContext>();
   var source=new TimesheetPeriod{PeriodKey="2026-10",Status="LOCKED"};
   var policy=new PayrollPolicy{Code="DASH",Name="Dash",Status="PUBLISHED",EffectiveFrom=new(2020,1,1),RulesJson=JsonSerializer.Serialize(PayrollTests.Rules(),SettingsDefaults.Json)};
   db.AddRange(source,policy);await db.SaveChangesAsync();
   var p=new PayrollPeriod{PeriodKey="2026-10",ScopeKey="ALL",TimesheetPeriodID=source.ID,Status="LOCKED",InputHash="verified",PolicyId=policy.ID};db.Add(p);await db.SaveChangesAsync();
   db.AddRange(new PayrollDetail{PayrollPeriodID=p.ID,EmployeeID=h.Self,NetSalary=300,GrossSalary=400,Deductions=100,CalculationSnapshot="{\"real\":true}",UniqueKey="dash:self",EmployeePeriodKey="dash:self"},new PayrollDetail{PayrollPeriodID=p.ID,EmployeeID=h.Other,NetSalary=900,GrossSalary=1000,Deductions=100,CalculationSnapshot="{\"real\":true}",UniqueKey="dash:other",EmployeePeriodKey="dash:other"});
   // Personal endpoint ignores even an absent scope grant for its screen.
   await db.Set<RoleScreenAction>().Where(x=>db.Screens.Any(s=>s.ID==x.ScreenID&&s.Code=="WEB_MY_PAYSLIPS")).ExecuteDeleteAsync();await db.SaveChangesAsync();
  }
  var mine=await Read<MyOverview>(h,"my-overview?year=2026&month=10");Assert.Equal(300,mine.Payroll!.Net);Assert.Equal(1,mine.Payroll.Employees);
  Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync("/api/dashboard/payroll-overview?year=2026&month=10")).StatusCode);
  await Grant(h,"WEB_PAYROLL");var all=await Read<PayrollOverview>(h,"payroll-overview?year=2026&month=10");Assert.Equal(1200,all.Net);Assert.Equal(1400,all.Gross);Assert.Equal(200,all.Deductions);
  using(var services=h.App.Services.CreateScope()){var db=services.ServiceProvider.GetRequiredService<AppDbContext>();await db.Set<PayrollPeriod>().ExecuteUpdateAsync(s=>s.SetProperty(p=>p.Status,"REVIEW"));}
  Assert.Equal(0,(await Read<MyOverview>(h,"my-overview?year=2026&month=10")).Payroll!.Employees);
 }
 [Fact] public async Task KpiOverviewAveragesOnlyApprovedResultsInTheSelectedPeriodAndScope() {
  await using var h=await Harness.Create("SELF",clock:Clock());await Grant(h,"WEB_KPI_EVALUATION","SELF");
  using(var services=h.App.Services.CreateScope()) {
   var db=services.ServiceProvider.GetRequiredService<AppDbContext>();
   var template=new KpiTemplate{Code="DASH",Name="Dash",Status="PUBLISHED",PeriodType="MONTH"};
   var period=new KpiPeriod{Code="2026-10",StartDate=new(2026,10,1),EndDate=new(2026,10,31)};db.AddRange(template,period);await db.SaveChangesAsync();
   db.AddRange(new KpiTarget{EmployeeID=h.Self,TemplateID=template.ID,PeriodId=period.ID,PeriodKey="2026-10",Status="APPROVED",FinalScore=80,AssignedByUserID="api-user"},
    new KpiTarget{EmployeeID=h.Other,TemplateID=template.ID,PeriodId=period.ID,PeriodKey="2026-10",Status="APPROVED",FinalScore=10,AssignedByUserID="api-user"});await db.SaveChangesAsync();
  }
  var result=await Read<KpiOverview>(h,"kpi-overview?year=2026&month=10");Assert.Equal(1,result.Assigned);Assert.Equal(80,result.AverageApprovedScore);
  Assert.Equal(0,(await Read<KpiOverview>(h,"kpi-overview?year=2026&month=9")).Assigned);
 }
 [Fact] public async Task PendingCountsOnlyAssignedCurrentStepsWithinApprovalScope() {
  await using var f=await LeaveWorkflowTests.Fixture.Create();var h=f.H;
  using(var services=h.App.Services.CreateScope()) {
   var db=services.ServiceProvider.GetRequiredService<AppDbContext>();var screen=await db.Screens.SingleAsync(x=>x.Code=="WEB_APPROVALS");
   var role=await db.Set<UserRole>().Where(x=>x.UserID=="api-user").Select(x=>x.RoleID).FirstAsync();
   await db.RoleDetails.Where(x=>x.RoleID==role&&x.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CanApprove,"Y"));
   await db.Set<RoleScreenAction>().Where(x=>x.RoleID==role&&x.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.DataScope,"DEPARTMENT"));
   foreach(var (employee,future,own,kind) in new[]{(h.Peer,false,false,"LEAVE"),(h.Peer,true,false,"OVERTIME"),(h.Other,false,false,"LEAVE"),(h.Peer,false,true,"LEAVE"),(h.Peer,false,false,"PAYROLL_PERIOD")}) {
    var a=new HRM.API.Modules.Approvals.Entities.ApprovalRequest{EmployeeId=employee,RequestedByUserID=own?"api-user":"lead",RequestType=kind,ReferenceID=employee,Status="PENDING",CreatedAt=new(2026,10,1)};db.Add(a);await db.SaveChangesAsync();
    if(future)db.Add(new HRM.API.Modules.Approvals.Entities.ApprovalStep{ApprovalRequestID=a.ID,StepNo=1,ApproverUserID="lead",Decision="PENDING"});
    db.Add(new HRM.API.Modules.Approvals.Entities.ApprovalStep{ApprovalRequestID=a.ID,StepNo=future?2:1,ApproverUserID="api-user",ApproverEmployeeId=h.Self,Decision="PENDING"});await db.SaveChangesAsync();
   }
  }
  var pending=await Read<PendingOverview>(h,"pending-tasks?year=2026&month=10");Assert.Equal(1,pending.Total);Assert.Equal("LEAVE",Assert.Single(pending.Items).RequestType);
  // Ordinary workflows may explicitly permit self approval; Dashboard must honor that policy.
  using(var services=h.App.Services.CreateScope()) {
   var db=services.ServiceProvider.GetRequiredService<AppDbContext>();
   var a=new HRM.API.Modules.Approvals.Entities.ApprovalRequest{EmployeeId=h.Self,RequestedByUserID="api-user",RequestType="LEAVE",ReferenceID=999,Status="PENDING",AllowSelfApproval=true,CreatedAt=new(2026,10,1)};db.Add(a);await db.SaveChangesAsync();
   db.Add(new HRM.API.Modules.Approvals.Entities.ApprovalStep{ApprovalRequestID=a.ID,StepNo=1,ApproverUserID="api-user",ApproverEmployeeId=h.Self,Decision="PENDING"});await db.SaveChangesAsync();
  }
  Assert.Equal(2,(await Read<PendingOverview>(h,"pending-tasks?year=2026&month=10")).Total);
 }
 [Fact] public async Task EmptyPeriodAndRevokedPermissionDoNotBecomeFakeData() {
  await using var h=await Harness.Create("SELF",clock:Clock());await Grant(h,"WEB_ATTENDANCE","SELF");await Grant(h,"WEB_KPI_EVALUATION","SELF");await Grant(h,"WEB_PAYROLL","SELF");
  var attendance=await Read<AttendanceOverview>(h,"attendance-trend?year=2026&month=10");Assert.Equal(0,attendance.Totals.Scheduled);Assert.Null(attendance.Totals.PresenceRate);
  var kpi=await Read<KpiOverview>(h,"kpi-overview?year=2026&month=10");Assert.Equal(0,kpi.Assigned);Assert.Null(kpi.AverageApprovedScore);
  Assert.Equal(0,(await Read<PayrollOverview>(h,"payroll-overview?year=2026&month=10")).Net);
  Assert.Equal(HttpStatusCode.BadRequest,(await h.Client.GetAsync("/api/dashboard/summary?month=13")).StatusCode);
  using(var services=h.App.Services.CreateScope()){var db=services.ServiceProvider.GetRequiredService<AppDbContext>();await db.RoleDetails.Where(d=>db.Screens.Any(s=>s.ID==d.ScreenID&&s.Code=="WEB_ATTENDANCE")).ExecuteUpdateAsync(s=>s.SetProperty(d=>d.CanView,"N"));}
  Assert.Equal(HttpStatusCode.Forbidden,(await h.Client.GetAsync("/api/dashboard/attendance-trend")).StatusCode);
  Assert.Null((await Read<DashboardSummary>(h,"summary")).Attendance);
  h.Client.DefaultRequestHeaders.Authorization=null;Assert.Equal(HttpStatusCode.Unauthorized,(await h.Client.GetAsync("/api/dashboard/my-overview")).StatusCode);
 }
}
