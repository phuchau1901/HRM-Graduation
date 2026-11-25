using System.Data;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Payroll.Services;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Attendance.Services;
public sealed class UnscheduledAttendanceService(AppDbContext db,SystemSettingsService settings,EmployeeDataScope scopes,ApprovalWorkflowService approvals,TimeProvider clock) {
 private DateTime Now=>clock.GetUtcNow().UtcDateTime;
 internal static AttendanceView View(UnscheduledAttendance r)=>new(r.ID,null,r.EmployeeID,PayrollEngine.LocalDay(r.StartAtUtc),AttendanceRules.Utc(r.StartAtUtc),r.EndAtUtc.HasValue?AttendanceRules.Utc(r.EndAtUtc.Value):null,0,0,r.Status,r.EndAtUtc.HasValue?(int)(r.EndAtUtc.Value-r.StartAtUtc).TotalMinutes:null) {Version=r.Version,RecordType="UNSCHEDULED",UnscheduledAttendanceId=r.ID,OvertimeRequestId=r.OvertimeRequestId,ApprovalId=r.ApprovalId};
 private async Task<int> Own(string actor,string action,CancellationToken ct) {
  await settings.Demand(actor,AttendanceScreens.MyAttendance,action,ct);
  return await db.Set<User>().Where(x=>x.UserId==actor&&x.Status=="ACTIVE"&&x.EmployeeId!=null).Select(x=>x.EmployeeId).SingleOrDefaultAsync(ct)??throw new BusinessException(403,"HRM_AUTH_006","An employee link is required.","EMPLOYEE_LINK_REQUIRED");
 }
 private static async Task Guard(AppDbContext db,DateTime start,DateTime end,CancellationToken ct) {
  var day=PayrollEngine.LocalDay(start);var last=PayrollEngine.LocalDay(end);var month=new DateOnly(day.Year,day.Month,1);
  while(month<=last){await TimesheetLocks.RequireOpen(db,month,ct);month=month.AddMonths(1);}
 }
 private static AttendanceRuleSnapshot EvidenceRules(AttendanceSettingsRequest config,DateTime now)=>new(PayrollEngine.LocalDay(now),config.Timezone,0,"UNSCHEDULED",now,now,now,now,now,now,0,0,0,config.RequireQr,config.RequireGps,config.MissingPunchRule,config.Locations,0);
 // Called by Punch while its transaction and employee mutex are held. Clock evidence is committed before workflow submission.
 internal async Task<UnscheduledAttendance> Record(string actor,int employee,PunchRequest request,bool checkIn,CancellationToken ct) {
  var now=Now;var row=await db.Set<UnscheduledAttendance>().SingleOrDefaultAsync(x=>x.EmployeeID==employee&&x.OpenEmployeeKey!=null,ct);
  if(checkIn) {
   if(row!=null)throw BusinessException.Conflict("An unscheduled attendance is already open.");
   if(!await db.Employees.AnyAsync(x=>x.Id==employee&&x.EmploymentStatus=="ACTIVE"&&x.HireDate<=PayrollEngine.LocalDay(now),ct))throw BusinessException.Conflict("Employee is not active or has not started work.");
   var opened=await (from a in db.Set<HRM.API.Modules.Attendance.Entities.Attendance>() join s in db.Set<WorkSchedule>() on a.ScheduleID equals s.ID where s.EmployeeID==employee&&a.CheckInAt!=null&&a.CheckOutAt==null select s).ToListAsync(ct);
   if(opened.Any(s=>s.RulesSnapshotJson==null||SettingsDefaults.Read<AttendanceRuleSnapshot>(s.RulesSnapshotJson).CheckOutCloseUtc>=now))throw BusinessException.Conflict("Check out the open scheduled attendance first.");
   var config=await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey,ct);await Guard(db,now,now,ct);
   var qr=await AttendanceOperationsService.Evidence(db,EvidenceRules(config.Settings,now),request,now,ct);
   row=new(){EmployeeID=employee,OpenEmployeeKey=employee,StartAtUtc=now,Status="OPEN",SettingsSnapshotJson=global::System.Text.Json.JsonSerializer.Serialize(config.Settings,SettingsDefaults.Json),CheckInQRId=qr,RecordedByUserId=actor};db.Add(row);
  } else {
   if(row==null)throw BusinessException.Conflict("No open unscheduled attendance to check out.");if(now<row.StartAtUtc)throw BusinessException.Conflict("Check-out cannot precede check-in.");
   await Guard(db,row.StartAtUtc,now,ct);var config=SettingsDefaults.Read<AttendanceSettingsRequest>(row.SettingsSnapshotJson);
   row.CheckOutQRId=await AttendanceOperationsService.Evidence(db,EvidenceRules(config,now),request,now,ct);row.EndAtUtc=now;row.Status="RECORDED";row.OpenEmployeeKey=null;row.Version++;
  }
  await db.SaveChangesAsync(ct);db.Add(new AttendanceRequest{EmployeeID=employee,UnscheduledAttendanceId=row.ID,Operation=checkIn?"CHECK_IN":"CHECK_OUT",RequestKey=request.RequestKey,CreatedAt=now});
  settings.Audit(actor,checkIn?"UNSCHEDULED_CHECK_IN":"UNSCHEDULED_CHECK_OUT","unscheduled:"+row.ID,null,new{row.Status,row.StartAtUtc,row.EndAtUtc});await db.SaveChangesAsync(ct);return row;
 }
 public async Task<AttendanceView> TrySubmit(string actor,long id,CancellationToken ct) {
  try{return View(await Submit(actor,id,null,null,ct));}
  catch(Exception e) when(e is BusinessException or DbUpdateException or MySqlConnector.MySqlException or HRM.API.Modules.Notifications.DTOs.NotificationException) {
   db.ChangeTracker.Clear();var row=await db.Set<UnscheduledAttendance>().AsNoTracking().SingleOrDefaultAsync(x=>x.ID==id&&db.Set<User>().Any(u=>u.UserId==actor&&u.Status=="ACTIVE"&&u.EmployeeId==x.EmployeeID),ct)??throw BusinessException.Missing();
   return View(row) with{ConfirmationMessage="Giờ chấm công đã lưu. Chưa gửi xác nhận tăng ca: "+(e is BusinessException?e.Message:"Hệ thống chưa gửi được, hãy gửi lại yêu cầu xác nhận.")};
  }
 }
 public async Task<UnscheduledAttendance> Submit(string actor,long id,long? version,string? reason,CancellationToken ct) {
  try{return await SubmitCore(actor,id,version,reason,ct);}
  catch(Exception e) when(e is DbUpdateConcurrencyException||e.GetBaseException() is MySqlConnector.MySqlException {Number:1062 or 1205 or 1213}) {throw BusinessException.Conflict("Concurrent overtime confirmation; reload and retry.");}
 }
 private async Task<UnscheduledAttendance> SubmitCore(string actor,long id,long? version,string? reason,CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);var employee=await Own(actor,"UPDATE",ct);
  await db.Employees.Where(x=>x.Id==employee).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CreatedAt,x=>x.CreatedAt),ct);
  var row=await db.Set<UnscheduledAttendance>().SingleOrDefaultAsync(x=>x.ID==id&&x.EmployeeID==employee,ct)??throw BusinessException.Missing();
  if(row.OvertimeRequestId.HasValue){await tx.CommitAsync(ct);return row;}
  if(version.HasValue&&row.Version!=version)throw BusinessException.Conflict("Record changed; reload.");
  if(row.Status!="RECORDED"||!row.EndAtUtc.HasValue)throw BusinessException.Conflict("Check out before submitting overtime confirmation.");
  var end=row.EndAtUtc.Value;var minutes=(end-row.StartAtUtc).TotalMinutes;
  if(minutes<1||minutes>1440)throw BusinessException.Invalid("Overtime confirmation requires between one minute and 24 hours; retain the evidence and contact HR to reconcile longer sessions.");
  await Guard(db,row.StartAtUtc,end,ct);
  var from=PayrollEngine.LocalDay(row.StartAtUtc).AddDays(-2);var to=PayrollEngine.LocalDay(end).AddDays(2);
  var schedules=await db.Set<WorkSchedule>().Where(x=>x.EmployeeID==employee&&x.Status!="CANCELLED"&&x.WorkDate>=from&&x.WorkDate<=to).ToListAsync(ct);
  if(schedules.Any(x=>x.RulesSnapshotJson==null||Overlaps(SettingsDefaults.Read<AttendanceRuleSnapshot>(x.RulesSnapshotJson),row.StartAtUtc,end)))throw BusinessException.Conflict("Recorded work overlaps a scheduled shift; reconcile through attendance adjustments before confirming overtime.");
  var overlaps=await db.Set<OvertimeRequest>().Where(x=>x.EmployeeID==employee&&(x.Status=="PENDING"||x.Status=="APPROVED")&&x.StartAt<end&&x.EndAt>row.StartAtUtc).ToListAsync(ct);
  OvertimeRequest overtime;
  if(overlaps.Count>0) {
   if(overlaps.Count!=1||overlaps[0].StartAt>row.StartAtUtc||overlaps[0].EndAt<end)throw BusinessException.Conflict("Existing overtime only partly overlaps this evidence; HR must reconcile before submission.");
   overtime=overlaps[0];row.ApprovalId=await db.Set<ApprovalRequest>().Where(x=>x.RequestType=="OVERTIME"&&x.ReferenceID==overtime.ID).OrderByDescending(x=>x.ID).Select(x=>(long?)x.ID).FirstOrDefaultAsync(ct);
   if(row.ApprovalId==null)throw BusinessException.Conflict("Existing overtime has no approval workflow.");
  } else {
   overtime=new(){EmployeeID=employee,StartAt=row.StartAtUtc,EndAt=end,RequestedHours=decimal.Round((decimal)(end-row.StartAtUtc).TotalHours,2),Status="PENDING",Reason=string.IsNullOrWhiteSpace(reason)?"Giờ làm thực tế ngoài lịch từ chấm công; chờ quản lý xác nhận.":reason.Trim(),CreatedAt=Now};db.Add(overtime);await db.SaveChangesAsync(ct);
   row.ApprovalId=(await approvals.StartAsync(actor,await db.Employees.SingleAsync(x=>x.Id==employee,ct),"OVERTIME",overtime.ID,ct)).ID;
  }
  row.OvertimeRequestId=overtime.ID;row.Status=overtime.Status;row.Version++;
  settings.Audit(actor,"UNSCHEDULED_SUBMITTED","unscheduled:"+row.ID,null,new{row.OvertimeRequestId,row.ApprovalId,row.Status});await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return row;
 }
 private static bool Overlaps(AttendanceRuleSnapshot rules,DateTime start,DateTime end)=>rules.StartAtUtc<end&&rules.EndAtUtc>start;
 public async Task<object> List(string actor,UnscheduledQuery q,bool mine,CancellationToken ct) {
  var people=db.Employees.AsNoTracking();if(mine){var id=await Own(actor,"VIEW",ct);people=people.Where(x=>x.Id==id);}else {await settings.Demand(actor,AttendanceScreens.Attendance,"VIEW",ct);people=(await scopes.GetAsync(actor,AttendanceScreens.Attendance,"VIEW",ct)).Apply(people);}
  if(q.From.HasValue&&q.From.Value.Year is <2000 or >2100||q.To.HasValue&&q.To.Value.Year is <2000 or >2100||q.From>q.To)throw BusinessException.Invalid("Invalid date range.");
  if(q.DepartmentId.HasValue)people=people.Where(x=>x.DepartmentId==q.DepartmentId);if(q.TeamId.HasValue)people=people.Where(x=>x.TeamId==q.TeamId);if(!string.IsNullOrWhiteSpace(q.Search))people=people.Where(x=>x.EmployeeCode.Contains(q.Search)||x.FullName.Contains(q.Search));
  if(q.EmployeeId.HasValue)people=people.Where(x=>x.Id==q.EmployeeId);var rows=from r in db.Set<UnscheduledAttendance>().AsNoTracking() join e in people on r.EmployeeID equals e.Id select new{record=r,e.EmployeeCode,e.FullName};
  if(q.Status!=null)rows=rows.Where(x=>x.record.Status==q.Status);
  if(q.From.HasValue){var begin=PayrollEngine.LocalUtc(q.From.Value,TimeOnly.MinValue);rows=rows.Where(x=>x.record.StartAtUtc>=begin);}if(q.To.HasValue){var finish=PayrollEngine.LocalUtc(q.To.Value.AddDays(1),TimeOnly.MinValue);rows=rows.Where(x=>x.record.StartAtUtc<finish);}
  return new{success=true,total=await rows.CountAsync(ct),page=q.Page,pageSize=q.PageSize,data=await rows.OrderByDescending(x=>x.record.StartAtUtc).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x=>new{x.record.ID,x.record.EmployeeID,x.EmployeeCode,x.FullName,x.record.StartAtUtc,x.record.EndAtUtc,x.record.Status,x.record.Version,x.record.OvertimeRequestId,x.record.ApprovalId}).ToListAsync(ct)};
 }
 public async Task<UnscheduledAttendance> Cancel(string actor,long id,UnscheduledActionRequest request,CancellationToken ct) {
  try{return await CancelCore(actor,id,request,ct);}
  catch(DbUpdateConcurrencyException){throw BusinessException.Conflict("Record changed; reload before cancellation.");}
 }
 private async Task<UnscheduledAttendance> CancelCore(string actor,long id,UnscheduledActionRequest request,CancellationToken ct) {
  await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);var employee=await Own(actor,"UPDATE",ct);
  var row=await db.Set<UnscheduledAttendance>().SingleOrDefaultAsync(x=>x.ID==id&&x.EmployeeID==employee,ct)??throw BusinessException.Missing();
  if(row.Version!=request.Version||row.Status!="RECORDED"||row.OvertimeRequestId.HasValue)throw BusinessException.Conflict("Only recorded, unsubmitted evidence can be cancelled here.");
  row.Status="CANCELLED";row.Version++;settings.Audit(actor,"UNSCHEDULED_CANCELLED","unscheduled:"+id,null,new{row.Version,reason=request.Reason});await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return row;
 }
}
