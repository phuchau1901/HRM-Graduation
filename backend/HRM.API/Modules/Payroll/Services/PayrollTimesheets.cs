using HRM.API.Common;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Payroll.Services;
public sealed partial class PayrollService
{
    private async Task Global(string actor,string action,CancellationToken ct) {if((await PayrollAccess(actor,action,ct)).Scope!="ALL")throw BusinessException.Scope();}
    public async Task<object> Timesheets(string actor,PageQuery q,CancellationToken ct) {
        var access=await PayrollAccess(actor,"VIEW",ct);var rows=db.Set<TimesheetPeriod>().AsNoTracking();
        return new {success=true,total=await rows.CountAsync(ct),page=q.Page,pageSize=q.PageSize,data=await rows.OrderByDescending(x=>x.PeriodKey).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x=>new{x.ID,x.PeriodKey,x.Status,x.Version,errorsJson=access.Scope=="ALL"?x.ErrorsJson:null}).ToListAsync(ct)};
    }
    public Task<TimesheetPeriod> CreateTimesheet(string actor,TimesheetCreateRequest r,CancellationToken ct)=>Transaction(async()=> {
        await Global(actor,"NEW",ct);Month(r.PeriodKey);await CatalogLock(ct);
        var existing=await db.Set<TimesheetPeriod>().SingleOrDefaultAsync(x=>x.PeriodKey==r.PeriodKey,ct);if(existing!=null)return existing;
        var row=new TimesheetPeriod {PeriodKey=r.PeriodKey,Status="OPEN"};db.Add(row);await db.SaveChangesAsync(ct);Audit(actor,"TimesheetPeriod",row.ID,"TIMESHEET_CREATED",new{row.PeriodKey});return row;
    },ct);
    private async Task<TimesheetSnapshot[]> BuildTimesheets(string key,CancellationToken ct) {
        var (start,end)=Month(key);var config=await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey,ct);
        var schedules=await db.Set<WorkSchedule>().AsNoTracking().Where(x=>x.WorkDate>=start&&x.WorkDate<=end&&x.Status!="CANCELLED").OrderBy(x=>x.ID).ToListAsync(ct);
        var scheduleIds=schedules.Select(x=>x.ID).ToArray();
        var punches=await db.Set<Attendance.Entities.Attendance>().AsNoTracking().Where(x=>scheduleIds.Contains(x.ScheduleID)).ToListAsync(ct);
        var leaves=await (from l in db.Set<LeaveRequest>().AsNoTracking() join t in db.Set<LeaveType>() on l.LeaveTypeID equals t.ID
            where (l.Status=="APPROVED"||l.Status=="CANCELLATION_PENDING")&&l.FromDate<=end&&l.ToDate>=start select new{Leave=l,t.Paid}).ToListAsync(ct);
        var begin=PayrollEngine.LocalUtc(start,TimeOnly.MinValue);var finish=PayrollEngine.LocalUtc(end.AddDays(2),TimeOnly.MinValue);
        var ot=await db.Set<OvertimeRequest>().AsNoTracking().Where(x=>x.Status=="APPROVED"&&x.StartAt<finish&&x.EndAt>begin).OrderBy(x=>x.ID).ToListAsync(ct);
        var active=await db.Employees.AsNoTracking().Where(x=>x.EmploymentStatus=="ACTIVE"&&x.HireDate<=end).Select(x=>x.Id).ToListAsync(ct);
        var ids=active.Concat(schedules.Select(x=>x.EmployeeID)).Concat(leaves.Select(x=>x.Leave.EmployeeID)).Distinct().Order().ToArray();
        if(ids.Length>2000)throw BusinessException.Invalid("Timesheet exceeds 2000 employees; partition source preparation before payroll.");
        var people=await db.Employees.AsNoTracking().Where(x=>ids.Contains(x.Id)).ToDictionaryAsync(x=>x.Id,ct);
        var schedulesByEmployee=schedules.ToLookup(x=>x.EmployeeID);var leavesByEmployee=leaves.ToLookup(x=>x.Leave.EmployeeID);var overtimeByEmployee=ot.ToLookup(x=>x.EmployeeID);var punchesBySchedule=punches.ToLookup(x=>x.ScheduleID);
        var days=Enumerable.Range(0,end.Day).Select(i=>start.AddDays(i)).ToArray();
        bool Working(DateOnly date)=>config.Settings.WorkingDays.Contains(date.DayOfWeek==DayOfWeek.Sunday?7:(int)date.DayOfWeek);
        var results=new List<TimesheetSnapshot>();
        foreach(var id in ids) {
            var errors=new List<string>();var warnings=new List<string>();var output=new List<TimesheetDay>();
            var employeeSchedules=schedulesByEmployee[id].ToLookup(x=>x.WorkDate);
            var employeeLeaves=leavesByEmployee[id].ToArray();var employeeOt=overtimeByEmployee[id].ToArray();
            var consumedOt=new Dictionary<long,double>();var occupied=new List<(DateTime Start,DateTime End)>();
            foreach(var date in days) {
                var eligible=date>=people[id].HireDate;var daily=employeeSchedules[date].ToArray();var holiday=config.Settings.HolidayDates.Contains(date);
                if(daily.Length>1)errors.Add($"{date}: duplicate work schedules.");
                var schedule=daily.FirstOrDefault();var attendance=schedule==null?null:punchesBySchedule[schedule.ID].FirstOrDefault();
                var leave=employeeLeaves.Where(x=>x.Leave.FromDate<=date&&x.Leave.ToDate>=date).ToArray();
                if(leave.Length>1)errors.Add($"{date}: overlapping approved leave.");
                decimal paid=0,unpaid=0;
                foreach(var l in leave) {
                    // Existing leave requests store a total day quantity, not daily sessions. Distribute only over working days.
                    var count=Enumerable.Range(0,l.Leave.ToDate.DayNumber-l.Leave.FromDate.DayNumber+1).Select(i=>l.Leave.FromDate.AddDays(i)).Count(d=>Working(d)&&!config.Settings.HolidayDates.Contains(d));
                    var quantity=count==0?0:l.Leave.RequestedDays/count;
                    if(Working(date)&&!holiday) {if(l.Paid)paid+=quantity;else unpaid+=quantity;}
                }
                if(schedule!=null&&punchesBySchedule[schedule.ID].Count()>1)errors.Add($"{date}: duplicate attendance rows.");
                AttendanceRuleSnapshot? snapshot=null;
                if(schedule!=null) {if(string.IsNullOrWhiteSpace(schedule.RulesSnapshotJson))errors.Add($"{date}: schedule has no verified rule snapshot.");else snapshot=Read<AttendanceRuleSnapshot>(schedule.RulesSnapshotJson);}
                int scheduled= snapshot==null?0:Math.Max(0,(int)(snapshot.EndAtUtc-snapshot.StartAtUtc).TotalMinutes-snapshot.BreakMinutes);
                int worked=0;DateTime? regularStart=null,regularEnd=null;var spans=new List<OvertimeSpan>();
                if(attendance!=null&&(!attendance.CheckInAt.HasValue||!attendance.CheckOutAt.HasValue))errors.Add($"{date}: incomplete attendance; request an adjustment before locking.");
                if(snapshot!=null&&attendance?.CheckInAt is DateTime checkin&&attendance.CheckOutAt is DateTime checkout) {
                    if(checkout<=checkin)errors.Add($"{date}: invalid attendance interval.");
                    regularStart=checkin>snapshot.StartAtUtc?checkin:snapshot.StartAtUtc;regularEnd=checkout<snapshot.EndAtUtc?checkout:snapshot.EndAtUtc;
                    worked=Math.Max(0,(int)(regularEnd.Value-regularStart.Value).TotalMinutes-snapshot.BreakMinutes);
                    if(occupied.Any(x=>checkin<x.End&&checkout>x.Start))errors.Add($"{date}: overlapping attendance intervals.");occupied.Add((checkin,checkout));
                    foreach(var request in employeeOt) {
                        if(!request.ApprovedHours.HasValue){errors.Add($"Overtime {request.ID}: approved quantity is missing.");continue;}
                        var approvedEnd=request.StartAt.AddHours((double)request.ApprovedHours.Value);if(approvedEnd>request.EndAt)approvedEnd=request.EndAt;
                        var a=checkin>request.StartAt?checkin:request.StartAt;var b=checkout<approvedEnd?checkout:approvedEnd;if(b<=a)continue;
                        var pieces=new List<(DateTime A,DateTime B)>();
                        // Regular scheduled minutes must not also be paid as overtime.
                        if(a<snapshot.StartAtUtc)pieces.Add((a,b<snapshot.StartAtUtc?b:snapshot.StartAtUtc));
                        if(b>snapshot.EndAtUtc)pieces.Add((a>snapshot.EndAtUtc?a:snapshot.EndAtUtc,b));
                        foreach(var piece in pieces.Where(x=>x.B>x.A)) {
                            var remaining=(double)request.ApprovedHours.Value*60-consumedOt.GetValueOrDefault(request.ID);if(remaining<=0)continue;
                            var stop=piece.B< piece.A.AddMinutes(remaining)?piece.B:piece.A.AddMinutes(remaining);
                            if(spans.Any(x=>piece.A<x.EndUtc&&stop>x.StartUtc)){errors.Add($"{date}: overlapping approved overtime.");continue;}
                            spans.Add(new(piece.A,stop,request.ID));consumedOt[request.ID]=consumedOt.GetValueOrDefault(request.ID)+(stop-piece.A).TotalMinutes;
                        }
                    }
                }
                if(scheduled>0&&(decimal)worked/scheduled+paid+unpaid>1.0001m)errors.Add($"{date}: work and approved leave exceed one day; reconcile leave/attendance.");
                if(schedule!=null&&attendance==null&&paid+unpaid==0)warnings.Add($"{date}: scheduled absence, no attendance recorded.");
                output.Add(new(date,eligible,Working(date),holiday,scheduled,worked,paid,unpaid,regularStart,regularEnd,spans.ToArray(),schedule?.ID,attendance?.ID,attendance?.LateMinutes??0));
            }
            results.Add(new(id,key,config.Version,days.Count(Working),output.ToArray(),errors.ToArray(),warnings.ToArray()) {WorkingDays=config.Settings.WorkingDays,Holidays=config.Settings.HolidayDates});
        }
        return results.ToArray();
    }
    public Task<PayrollReceipt> CalculateTimesheet(string actor,long id,PayrollCalculationRequest r,CancellationToken ct)=>Transaction<PayrollReceipt>(async()=> {
        await Global(actor,"UPDATE",ct);await db.Set<TimesheetPeriod>().Where(x=>x.ID==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
        var row=await db.Set<TimesheetPeriod>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();
        if(row.LastCalculationKey==r.RequestKey)return new(Read<PayrollIssue[]>(row.ErrorsJson??"[]").Length==0,id,row.Status,row.Version,await db.Set<TimesheetDetail>().CountAsync(x=>x.PeriodID==id,ct),Read<PayrollIssue[]>(row.ErrorsJson??"[]").Length);
        Version(row.Version,r.Version);if(row.Status!="OPEN"&&row.Status!="DRAFT")throw BusinessException.Conflict("Timesheet is locked.");
        var snapshots=await BuildTimesheets(row.PeriodKey,ct);await db.Set<TimesheetDetail>().Where(x=>x.PeriodID==id).ExecuteDeleteAsync(ct);
        var issues=snapshots.SelectMany(s=>s.Errors.Select(e=>new PayrollIssue(s.EmployeeId,"SOURCE_INVALID",e))).ToArray();
        foreach(var s in snapshots)db.Add(new TimesheetDetail {PeriodID=id,EmployeeID=s.EmployeeId,SnapshotJson=Json(s),UniqueKey=$"{id}:{s.EmployeeId}",CalculatedAt=Now,
            WorkedDays=s.Days.Sum(d=>d.ScheduledMinutes==0?0:(decimal)d.WorkedMinutes/d.ScheduledMinutes),PaidLeaveDays=s.Days.Sum(d=>d.PaidLeave),OvertimeHours=s.Days.Sum(d=>d.Overtime.Sum(o=>(decimal)(o.EndUtc-o.StartUtc).TotalHours)),LateMinutes=s.Days.Sum(d=>d.LateMinutes)});
        row.InputHash=Hash(snapshots);row.ErrorsJson=Json(issues);row.LastCalculationKey=r.RequestKey;row.Version++;
        Audit(actor,"TimesheetPeriod",id,"TIMESHEET_CALCULATED",new{row.Version,sourceHash=row.InputHash});return new(issues.Length==0,id,row.Status,row.Version,snapshots.Length,issues.Length);
    },ct);
    public Task<TimesheetPeriod> LockTimesheet(string actor,long id,PayrollVersion r,CancellationToken ct)=>Transaction(async()=> {
        await Global(actor,"APPROVE",ct);await db.Set<TimesheetPeriod>().Where(x=>x.ID==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
        var row=await db.Set<TimesheetPeriod>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();Version(row.Version,r.Version);
        if(row.Status!="OPEN"||row.InputHash==null||Read<PayrollIssue[]>(row.ErrorsJson??"[]").Length>0)throw BusinessException.Conflict("Calculate and resolve timesheet errors before locking.");
        if(PayrollEngine.LocalDay(Now)<=Month(row.PeriodKey).End)throw BusinessException.Conflict("Month must finish before locking its timesheet.");
        if(row.InputHash!=Hash(await BuildTimesheets(row.PeriodKey,ct)))throw BusinessException.Conflict("Attendance inputs changed; calculate the timesheet again.");
        row.Status="LOCKED";row.ClosedAt=Now;row.ClosedByUserID=actor;row.Version++;Audit(actor,"TimesheetPeriod",id,"TIMESHEET_LOCKED",new{row.Version,row.InputHash});return row;
    },ct);
}
