using System.Net;
using System.Net.Http.Json;
using System.IO.Compression;
using System.Text.Json;
using HRM.API.Data;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.Services;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Fixture=HRM.API.Tests.LeaveWorkflowTests.Fixture;
namespace HRM.API.Tests;
public sealed class AttendanceManagementTests
{
    private static readonly DateOnly Day=new(2026,11,23);
    private static async Task<(long Self,long Peer,long Other)> Setup(Fixture f)
    {
        await OrganizationApiTests.Grant(f.H.App,AttendanceScreens.Attendance);
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,11,23,1,30,0,TimeSpan.Zero);
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var role=await db.Set<Role>().SingleAsync(r=>r.Code=="HR");var screen=await db.Screens.SingleAsync(s=>s.Code==AttendanceScreens.Attendance);
            foreach(var action in new[]{"VIEW","EXPORT","NEW","UPDATE"})db.Add(new RoleScreenAction{RoleID=role.ID,ScreenID=screen.ID,ActionCode=action,DataScope="ALL"});
            await db.RoleDetails.Where(d=>d.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(d=>d.CanExport,"Y"));await db.SaveChangesAsync();
        }
        await OrganizationApiTests.Login(f.H.Client,f.H.App);
        using var setup=f.H.App.Services.CreateScope();var context=setup.ServiceProvider.GetRequiredService<AppDbContext>();
        var shift=new Shift{Code="DAY",Name="Day",StartTime=new(8,0),EndTime=new(17,0),BreakMinutes=60,LateGraceMinutes=5,IsActive=true};context.Add(shift);await context.SaveChangesAsync();
        var rows=new List<WorkSchedule>();foreach(var employee in new[]{f.H.Self,f.H.Peer,f.H.Other})
        {
            var snapshot=AttendanceRules.Snapshot(shift,Day,new AttendanceSettingsRequest(),1);
            var row=new WorkSchedule{EmployeeID=employee,ShiftID=shift.ID,WorkDate=Day,Status="SCHEDULED",UniqueWorkKey=$"daily:{employee}",Version=1,RulesSnapshotJson=JsonSerializer.Serialize(snapshot,SettingsDefaults.Json)};context.Add(row);rows.Add(row);
        }
        await context.SaveChangesAsync();
        context.AddRange(new HRM.API.Modules.Attendance.Entities.Attendance{ScheduleID=rows[1].ID,CheckInAt=new(2026,11,23,1,10,0,DateTimeKind.Utc),LateMinutes=5,Status="INCOMPLETE"},
            new HRM.API.Modules.Attendance.Entities.Attendance{ScheduleID=rows[2].ID,CheckInAt=new(2026,11,23,1,15,0,DateTimeKind.Utc),CheckOutAt=new(2026,11,23,8,50,0,DateTimeKind.Utc),LateMinutes=10,EarlyMinutes=10,Status="COMPLETE"});await context.SaveChangesAsync();
        return(rows[0].ID,rows[1].ID,rows[2].ID);
    }
    private static async Task<DailyAttendancePage> List(Fixture f,string extra="")=>(await f.H.Client.GetFromJsonAsync<DailyAttendancePage>("/api/attendances/daily?date=2026-11-23"+extra))!;
    [Fact]
    public async Task EmployeeScheduleLeftJoinIncludesUnpunchedAndStatisticsKeepIndependentViolations()
    {
        await using var f=await Fixture.Create();await Setup(f);var page=await List(f);
        var self=Assert.Single(page.Data,r=>r.EmployeeId==f.H.Self);Assert.Null(self.AttendanceId);Assert.Equal("NOT_CHECKED_IN",self.Status);Assert.False(self.SnapshotMissing);Assert.NotEmpty(self.EmployeeCode);Assert.NotEmpty(self.DepartmentName);Assert.Equal("DAY",self.ShiftCode);Assert.Equal(new DateTime(2026,11,23,1,0,0,DateTimeKind.Utc),self.ShiftStartAtUtc);
        var other=Assert.Single(page.Data,r=>r.EmployeeId==f.H.Other);Assert.True(other.IsLate);Assert.True(other.IsEarly);Assert.Equal(395,other.WorkedMinutes);Assert.Equal("COMPLETE",other.Status);
        var stats=(await f.H.Client.GetFromJsonAsync<DailyAttendanceStatistics>("/api/attendances/statistics?date=2026-11-23"))!;
        Assert.Equal(3,stats.Scheduled);Assert.Equal(2,stats.CheckedIn);Assert.Equal(1,stats.Working);Assert.Equal(2,stats.Late);Assert.Equal(1,stats.Early);Assert.Equal(1,stats.NotPunched);Assert.Equal(0,stats.Absent);
    }
    [Fact]
    public async Task StatusChangesOnlyAfterCheckoutWindowClosesAndSnapshotsSurviveConfigChanges()
    {
        await using var f=await Fixture.Create();await Setup(f);
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,11,23,12,0,0,TimeSpan.Zero); //19:00, exactly window end
        var page=await List(f);Assert.Equal("NOT_CHECKED_IN",page.Data.Single(r=>r.EmployeeId==f.H.Self).Status);Assert.Equal("WORKING",page.Data.Single(r=>r.EmployeeId==f.H.Peer).Status);
        using(var scope=f.H.App.Services.CreateScope())await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<Shift>().ExecuteUpdateAsync(s=>s.SetProperty(s=>s.EndTime,new TimeOnly(20,0)));
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,11,23,12,0,1,TimeSpan.Zero);
        page=await List(f);Assert.Equal("ABSENT",page.Data.Single(r=>r.EmployeeId==f.H.Self).Status);Assert.Equal("MISSING_CHECK_OUT",page.Data.Single(r=>r.EmployeeId==f.H.Peer).Status);Assert.Equal(10,page.Data.Single(r=>r.EmployeeId==f.H.Other).EarlyMinutes);
    }
    [Theory]
    [InlineData("SELF",1)]
    [InlineData("DEPARTMENT",2)]
    [InlineData("ALL",3)]
    public async Task ListStatisticsDetailsAndExportUseActionScopes(string scopeName,int scheduled)
    {
        await using var f=await Fixture.Create();var ids=await Setup(f);
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var screen=await db.Screens.SingleAsync(s=>s.Code==AttendanceScreens.Attendance);
            await db.Set<RoleScreenAction>().Where(g=>g.ScreenID==screen.ID&&g.ActionCode=="VIEW").ExecuteUpdateAsync(s=>s.SetProperty(g=>g.DataScope,scopeName));
            await db.Set<RoleScreenAction>().Where(g=>g.ScreenID==screen.ID&&g.ActionCode=="EXPORT").ExecuteUpdateAsync(s=>s.SetProperty(g=>g.DataScope,"SELF"));
        }
        var stats=(await f.H.Client.GetFromJsonAsync<DailyAttendanceStatistics>("/api/attendances/statistics?date=2026-11-23"))!;Assert.Equal(scheduled,stats.Scheduled);
        var page=await List(f);Assert.Equal(scheduled,page.Data.Count(r=>r.ScheduleId.HasValue));
        if(scopeName!="ALL")Assert.Equal(HttpStatusCode.NotFound,(await f.H.Client.GetAsync($"/api/attendances/daily/detail?employeeId={f.H.Other}&date=2026-11-23&scheduleId={ids.Other}")).StatusCode);
        var export=await f.H.Client.GetAsync("/api/attendances/export?date=2026-11-23");export.EnsureSuccessStatusCode();Assert.Contains("spreadsheetml",export.Content.Headers.ContentType!.MediaType);
        using var archive=new ZipArchive(new MemoryStream(await export.Content.ReadAsByteArrayAsync()));using var reader=new StreamReader(archive.GetEntry("xl/worksheets/sheet1.xml")!.Open());var sheet=await reader.ReadToEndAsync();Assert.Contains("DAY",sheet);Assert.Contains(">E1<",sheet);Assert.DoesNotContain(">E3<",sheet);
    }
    [Fact]
    public async Task MyAttendanceCannotBeChangedToAnotherEmployeeAndFiltersAreServerSide()
    {
        await using var f=await Fixture.Create();await Setup(f);
        var page=(await f.H.Client.GetFromJsonAsync<DailyAttendancePage>($"/api/attendances/me?date=2026-11-23&employeeId={f.H.Other}"))!;Assert.All(page.Data,r=>Assert.Equal(f.H.Self,r.EmployeeId));
        var late=await List(f,"&status=LATE&pageSize=1");Assert.Equal(2,late.Total);Assert.Single(late.Data);Assert.True(late.Data[0].IsLate);
        var stats=(await f.H.Client.GetFromJsonAsync<DailyAttendanceStatistics>("/api/attendances/statistics?date=2026-11-23&status=EARLY"))!;Assert.Equal(1,stats.Employees);Assert.Equal(1,stats.Late);Assert.Equal(1,stats.Early);
    }
    [Fact]
    public async Task ApprovedLeaveOffDaysHolidaysAndLegacyRowsHaveDistinctStates()
    {
        await using var f=await Fixture.Create();var ids=await Setup(f);
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();db.Add(new LeaveRequest{EmployeeID=f.H.Self,LeaveTypeID=f.TypeId,FromDate=Day,ToDate=Day,RequestedDays=1,Status="APPROVED"});
            var setting=await db.Set<SystemSetting>().SingleAsync(s=>s.Key==SettingsDefaults.AttendanceKey);var config=SettingsDefaults.Read<AttendanceSettingsRequest>(setting.JsonValue);config.HolidayDates=[new(2026,11,24)];setting.JsonValue=JsonSerializer.Serialize(config,SettingsDefaults.Json);await db.SaveChangesAsync();
            await db.Set<WorkSchedule>().Where(s=>s.ID==ids.Peer).ExecuteUpdateAsync(s=>s.SetProperty(s=>s.RulesSnapshotJson,(string?)null));
        }
        var page=await List(f);Assert.Equal("ON_LEAVE",page.Data.Single(r=>r.EmployeeId==f.H.Self).Status);Assert.Equal("LEGACY_UNVERIFIED",page.Data.Single(r=>r.EmployeeId==f.H.Peer).Status);
        var holiday=(await f.H.Client.GetFromJsonAsync<DailyAttendancePage>("/api/attendances/daily?date=2026-11-24"))!;Assert.All(holiday.Data,r=>Assert.Equal("HOLIDAY",r.Status));
        var rest=(await f.H.Client.GetFromJsonAsync<DailyAttendancePage>("/api/attendances/daily?date=2026-11-29"))!;Assert.All(rest.Data,r=>Assert.Equal("DAY_OFF",r.Status));
    }
    [Fact]
    public async Task OvernightUsesScheduleWorkDateAndDetailShowsAdjustmentsAndLock()
    {
        await using var f=await Fixture.Create();var ids=await Setup(f);
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var row=await db.Set<WorkSchedule>().SingleAsync(s=>s.ID==ids.Self);var shift=await db.Set<Shift>().SingleAsync();shift.StartTime=new(22,0);shift.EndTime=new(6,0);row.RulesSnapshotJson=JsonSerializer.Serialize(AttendanceRules.Snapshot(shift,Day,new AttendanceSettingsRequest(),1),SettingsDefaults.Json);db.Add(new TimesheetPeriod{PeriodKey="2026-11",Status="LOCKED"});await db.SaveChangesAsync();
        }
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,11,24,0,0,0,TimeSpan.Zero); //07:00 next day, checkout close08:00
        var detail=(await f.H.Client.GetFromJsonAsync<DailyAttendanceDetail>($"/api/attendances/daily/detail?employeeId={f.H.Self}&date=2026-11-23&scheduleId={ids.Self}"))!;Assert.Equal("NOT_CHECKED_IN",detail.Attendance.Status);Assert.True(detail.Attendance.IsPeriodLocked);Assert.Equal(Day,detail.Attendance.WorkDate);Assert.NotNull(detail.Rules);
        var mine=(await f.H.Client.GetFromJsonAsync<DailyAttendancePage>("/api/attendances/me"))!;Assert.Contains(mine.Data,r=>r.ScheduleId==ids.Self && r.WorkDate==Day);
    }
    [Fact]
    public async Task LockedTimesheetRejectsNewPunchAndFinalCorrectionButPreservesOriginalHours()
    {
        await using var f=await Fixture.Create();var ids=await Setup(f);long attendanceId;
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,11,23,12,0,0,TimeSpan.Zero);
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var attendance=new HRM.API.Modules.Attendance.Entities.Attendance{ScheduleID=ids.Self,CheckInAt=new(2026,11,23,1,0,0),CheckOutAt=new(2026,11,23,10,0,0),Status="COMPLETE"};db.Add(attendance);await db.SaveChangesAsync();attendanceId=attendance.ID;
        }
        (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new{version=1,routes=new[]{new{requestType="ATTENDANCE_ADJUSTMENT",allowSelfApproval=false,steps=new[]{new{approverType="TEAM_LEAD"}}}}})).EnsureSuccessStatusCode();
        var response=await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments",new{attendanceId,proposedCheckIn="2026-11-23T08:05:00+07:00",proposedCheckOut="2026-11-23T17:00:00+07:00",reason="Device correction"});response.EnsureSuccessStatusCode();var request=(await response.Content.ReadFromJsonAsync<HRM.API.Modules.Leave.DTOs.WorkflowReceipt>())!;
        using(var scope=f.H.App.Services.CreateScope()){var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();db.Add(new TimesheetPeriod{PeriodKey="2026-11",Status="LOCKED"});await db.SaveChangesAsync();}
        Assert.Equal(HttpStatusCode.Conflict,(await f.Decide(request.ApprovalId,"lead")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments",new{attendanceId,proposedCheckIn="2026-11-23T08:05:00+07:00",reason="Locked"})).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync("/api/attendances/check-in",new{scheduleId=ids.Self,requestKey="locked-period"})).StatusCode);
        using var check=f.H.App.Services.CreateScope();Assert.Equal(new DateTime(2026,11,23,1,0,0),(await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<HRM.API.Modules.Attendance.Entities.Attendance>().SingleAsync(a=>a.ID==attendanceId)).CheckInAt);
    }
    [Fact]
    public async Task MissingScopeAndRevokedViewAreDeniedAndInvalidRangeIsRejected()
    {
        await using var f=await Fixture.Create();await Setup(f);
        Assert.Equal(HttpStatusCode.BadRequest,(await f.H.Client.GetAsync("/api/attendances/daily?from=2026-01-01&to=2026-12-31")).StatusCode);
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var screen=await db.Screens.SingleAsync(s=>s.Code==AttendanceScreens.Attendance);await db.Set<RoleScreenAction>().Where(g=>g.ScreenID==screen.ID&&g.ActionCode=="VIEW").ExecuteDeleteAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.GetAsync("/api/attendances/daily?date=2026-11-23")).StatusCode);Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.GetAsync("/api/attendances/statistics?date=2026-11-23")).StatusCode);
    }

    [Fact]
    public async Task ExcelNamesRemainStringsAndExportRequiresItsOwnLivePermission()
    {
        await using var f=await Fixture.Create();await Setup(f);
        using(var scope=f.H.App.Services.CreateScope())await scope.ServiceProvider.GetRequiredService<AppDbContext>().Employees.Where(e=>e.Id==f.H.Self).ExecuteUpdateAsync(s=>s.SetProperty(e=>e.FullName,"=SUM(1,1)"));
        var export=await f.H.Client.GetAsync("/api/attendances/export?date=2026-11-23");export.EnsureSuccessStatusCode();
        using(var zip=new ZipArchive(new MemoryStream(await export.Content.ReadAsByteArrayAsync())))
        using(var input=zip.GetEntry("xl/worksheets/sheet1.xml")!.Open())
        {
            var sheet=global::System.Xml.Linq.XDocument.Load(input);global::System.Xml.Linq.XNamespace ns="http://schemas.openxmlformats.org/spreadsheetml/2006/main";
            Assert.Empty(sheet.Descendants(ns+"f"));Assert.Contains(sheet.Descendants(ns+"t"),t=>t.Value=="=SUM(1,1)");Assert.NotEmpty(sheet.Descendants(ns+"v"));
        }
        using(var scope=f.H.App.Services.CreateScope())
        {
            var db=scope.ServiceProvider.GetRequiredService<AppDbContext>();var screen=await db.Screens.SingleAsync(s=>s.Code==AttendanceScreens.Attendance);await db.RoleDetails.Where(d=>d.ScreenID==screen.ID).ExecuteUpdateAsync(s=>s.SetProperty(d=>d.CanExport,"N"));
        }
        Assert.Equal(HttpStatusCode.Forbidden,(await f.H.Client.GetAsync("/api/attendances/export?date=2026-11-23")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,(await f.H.Client.GetAsync("/api/attendances/daily?date=2026-11-23")).StatusCode);
    }

    [Fact]
    public async Task UnpunchedScheduleCanRequestCorrectionWithoutWritingActualHoursBeforeApproval()
    {
        await using var f=await Fixture.Create();var ids=await Setup(f);
        ((AttendanceTestClock)f.H.App.Services.GetRequiredService<TimeProvider>()).Now=new(2026,11,23,12,0,0,TimeSpan.Zero);
        (await f.H.Client.PutAsJsonAsync("/api/approval-workflow-settings",new{version=1,routes=new[]{new{requestType="ATTENDANCE_ADJUSTMENT",allowSelfApproval=false,steps=new[]{new{approverType="TEAM_LEAD"}}}}})).EnsureSuccessStatusCode();
        var response=await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments",new{scheduleId=ids.Self,proposedCheckIn="2026-11-23T08:00:00+07:00",proposedCheckOut="2026-11-23T17:00:00+07:00",reason="Missing device punches"});response.EnsureSuccessStatusCode();
        var receipt=(await response.Content.ReadFromJsonAsync<HRM.API.Modules.Leave.DTOs.WorkflowReceipt>())!;
        using(var scope=f.H.App.Services.CreateScope())
        {
            var row=await scope.ServiceProvider.GetRequiredService<AppDbContext>().Set<HRM.API.Modules.Attendance.Entities.Attendance>().SingleAsync(a=>a.ScheduleID==ids.Self);Assert.Null(row.CheckInAt);Assert.Null(row.CheckOutAt);
        }
        Assert.Equal(HttpStatusCode.Conflict,(await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments",new{scheduleId=ids.Self,proposedCheckIn="2026-11-23T08:00:00+07:00",reason="Duplicate pending"})).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,(await f.H.Client.PostAsJsonAsync("/api/attendance-adjustments",new{scheduleId=ids.Other,proposedCheckIn="2026-11-23T08:00:00+07:00",reason="Not mine"})).StatusCode);
        (await f.Decide(receipt.ApprovalId,"lead")).EnsureSuccessStatusCode();
        using var check=f.H.App.Services.CreateScope();var actual=await check.ServiceProvider.GetRequiredService<AppDbContext>().Set<HRM.API.Modules.Attendance.Entities.Attendance>().SingleAsync(a=>a.ScheduleID==ids.Self);Assert.Equal(new DateTime(2026,11,23,1,0,0),actual.CheckInAt);Assert.Equal(new DateTime(2026,11,23,10,0,0),actual.CheckOutAt);
    }

}
