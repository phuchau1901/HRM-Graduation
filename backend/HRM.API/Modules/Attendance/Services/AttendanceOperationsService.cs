using HRM.API.Modules.System.Services;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Work.DTOs;
using HRM.API.Modules.Work.Services;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.System.DTOs;
using Microsoft.EntityFrameworkCore;
using AttendanceEntity = HRM.API.Modules.Attendance.Entities.Attendance;
namespace HRM.API.Modules.Attendance.Services;
public sealed class AttendanceOperationsService(AppDbContext db, SystemSettingsService settings, WorkScheduleService schedules, TimeProvider clock, UnscheduledAttendanceService unscheduled)
{
    private static AttendanceRuleSnapshot Rules(WorkSchedule schedule) => schedule.RulesSnapshotJson is null
        ? throw BusinessException.Conflict("Legacy schedule has no reviewed rules snapshot; do not infer historical rules.") : SettingsDefaults.Read<AttendanceRuleSnapshot>(schedule.RulesSnapshotJson);
    private AttendanceView Dto(AttendanceEntity a, WorkSchedule s)
    {
        var rules = s.RulesSnapshotJson is null ? null : SettingsDefaults.Read<AttendanceRuleSnapshot>(s.RulesSnapshotJson);
        var status = a.Status;
        if (rules is not null && a.CheckInAt.HasValue && !a.CheckOutAt.HasValue && clock.GetUtcNow().UtcDateTime > rules.CheckOutCloseUtc) status = "MISSING_CHECK_OUT";
        return new(a.ID, a.ScheduleID, s.EmployeeID, s.WorkDate, a.CheckInAt.HasValue ? AttendanceRules.Utc(a.CheckInAt.Value) : null,
            a.CheckOutAt.HasValue ? AttendanceRules.Utc(a.CheckOutAt.Value) : null, a.LateMinutes, a.EarlyMinutes, status,
            a.CheckInAt.HasValue && a.CheckOutAt.HasValue && rules is not null ? Math.Max(0, (int)(a.CheckOutAt.Value - a.CheckInAt.Value).TotalMinutes - rules.BreakMinutes) : null);
    }
    public async Task<PageResult<AttendanceView>> List(string actor, ScheduleQuery q, CancellationToken ct)
    {
        await settings.Demand(actor, AttendanceScreens.Attendance, "VIEW", ct);
        var visible = (await schedules.Scoped(actor, AttendanceScreens.Attendance, "VIEW", ct)).AsNoTracking();
        if (q.EmployeeId.HasValue) visible = visible.Where(x => x.EmployeeID == q.EmployeeId);
        if (q.From.HasValue) visible = visible.Where(x => x.WorkDate >= q.From); if (q.To.HasValue) visible = visible.Where(x => x.WorkDate <= q.To);
        var query = from a in db.Set<AttendanceEntity>().AsNoTracking() join s in visible on a.ScheduleID equals s.ID select new { Attendance = a, Schedule = s };
        var total = await query.CountAsync(ct); var rows = await query.OrderBy(x => x.Schedule.WorkDate).ThenBy(x => x.Attendance.ID).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows.Select(x => Dto(x.Attendance, x.Schedule)).ToList());
    }
    public async Task<AttendanceView> Punch(string actor,PunchRequest r,bool checkIn,CancellationToken ct) {
        try{return await PunchCore(actor,r,checkIn,ct);}
        catch(Exception e) when(e is DbUpdateConcurrencyException||e.GetBaseException() is MySqlConnector.MySqlException {Number:1062 or 1205 or 1213}) {throw BusinessException.Conflict("Concurrent punch operation; retry using the same requestKey.");}
    }
    private async Task<AttendanceView> PunchCore(string actor, PunchRequest r, bool checkIn, CancellationToken ct)
    {
        SettingsDefaults.Validate(r); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await settings.Demand(actor, AttendanceScreens.MyAttendance, "UPDATE", ct);
        var ownEmployee = await (from user in db.Set<User>().AsNoTracking()
                                 join employee in db.Employees.AsNoTracking() on user.EmployeeId equals (int?)employee.Id
                                 where user.UserId == actor && user.Status == "ACTIVE"
                                 select (int?)employee.Id).SingleOrDefaultAsync(ct)
            ?? throw new BusinessException(403,"HRM_AUTH_006","An employee link is required.","EMPLOYEE_LINK_REQUIRED");
        await db.Employees.Where(x=>x.Id==ownEmployee).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.CreatedAt,x=>x.CreatedAt),ct);
        var operation = checkIn ? "CHECK_IN" : "CHECK_OUT";
        var previous = await db.Set<AttendanceRequest>().AsNoTracking().SingleOrDefaultAsync(x => x.RequestKey == r.RequestKey, ct);
        if(previous is not null) {
            if(previous.EmployeeID!=ownEmployee||previous.Operation!=operation)throw BusinessException.Conflict("Request key already used.");
            if(previous.UnscheduledAttendanceId.HasValue) {
                if(r.ScheduleId.HasValue)throw BusinessException.Conflict("Request key belongs to unscheduled attendance.");
                var raw=await db.Set<UnscheduledAttendance>().SingleAsync(x=>x.ID==previous.UnscheduledAttendanceId&&x.EmployeeID==ownEmployee,ct);
                await tx.CommitAsync(ct);return checkIn?UnscheduledAttendanceService.View(raw):await unscheduled.TrySubmit(actor,raw.ID,ct);
            }
            var existing=await db.Set<AttendanceEntity>().SingleAsync(x=>x.ID==previous.AttendanceID,ct);
            var original=await db.Set<WorkSchedule>().SingleOrDefaultAsync(x=>x.ID==existing.ScheduleID&&x.EmployeeID==ownEmployee,ct)??throw BusinessException.Missing();
            if(r.ScheduleId.HasValue&&r.ScheduleId!=original.ID)throw BusinessException.Conflict("Request key belongs to another schedule.");
            await tx.CommitAsync(ct);return Dto(existing,original);
        }
        var openRaw=await db.Set<UnscheduledAttendance>().AnyAsync(x=>x.EmployeeID==ownEmployee&&x.OpenEmployeeKey!=null,ct);
        if(openRaw&&checkIn)throw BusinessException.Conflict("Check out the open unscheduled attendance first.");
        if(openRaw&&r.ScheduleId.HasValue)throw BusinessException.Conflict("An unscheduled attendance is open; omit scheduleId to check it out.");
        var scheduleId=r.ScheduleId??(openRaw?(long?)null:await ResolveSchedule(ownEmployee,checkIn,ct));
        if(!scheduleId.HasValue) {
            var raw=await unscheduled.Record(actor,ownEmployee,r,checkIn,ct);await tx.CommitAsync(ct);
            return checkIn?UnscheduledAttendanceService.View(raw):await unscheduled.TrySubmit(actor,raw.ID,ct);
        }
        var owned=db.Set<WorkSchedule>().Where(s=>s.ID==scheduleId&&s.EmployeeID==ownEmployee);
        if(await owned.ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct)!=1)throw BusinessException.Missing();
        var schedule=await owned.SingleAsync(ct);
        if(schedule.Status!="SCHEDULED")throw BusinessException.Conflict("Schedule is not open.");
        await HRM.API.Modules.Payroll.Services.TimesheetLocks.RequireOpen(db, schedule.WorkDate, ct);
        var rules = Rules(schedule); var now = clock.GetUtcNow().UtcDateTime; AttendanceRules.Window(rules, now, checkIn);
        var qr = await Evidence(db,rules, r, now, ct);
        var attendance = await db.Set<AttendanceEntity>().SingleOrDefaultAsync(x => x.ScheduleID == schedule.ID, ct) ?? new AttendanceEntity { ScheduleID = schedule.ID };
        if (checkIn)
        {
            if (attendance.CheckInAt.HasValue || attendance.CheckOutAt.HasValue) throw BusinessException.Conflict("Check-in already recorded or checkout precedes this request.");
            attendance.CheckInAt = now; attendance.CheckInQRID = qr; attendance.LateMinutes = AttendanceRules.Late(rules, now); attendance.Status = "INCOMPLETE";
        }
        else
        {
            if (attendance.CheckOutAt.HasValue) throw BusinessException.Conflict("Check-out already recorded.");
            if (!attendance.CheckInAt.HasValue && rules.MissingPunchRule == MissingPunchRules.Reject) throw BusinessException.Conflict("Check-in is required before check-out.");
            if (attendance.CheckInAt.HasValue && now < AttendanceRules.Utc(attendance.CheckInAt.Value)) throw BusinessException.Conflict("Check-out cannot precede check-in.");
            attendance.CheckOutAt = now; attendance.CheckOutQRID = qr; attendance.EarlyMinutes = AttendanceRules.Early(rules, now);
            attendance.Status = attendance.CheckInAt.HasValue ? "COMPLETE" : "MISSING_CHECK_IN";
        }
        if (attendance.ID == 0) db.Add(attendance); await db.SaveChangesAsync(ct);
        db.Add(new AttendanceRequest { EmployeeID = schedule.EmployeeID, AttendanceID = attendance.ID, RequestKey = r.RequestKey, Operation = operation, CreatedAt = now });
        settings.Audit(actor, operation, "attendance:" + attendance.ID, null, new { scheduleId = schedule.ID, atUtc = now, attendance.Status, attendance.LateMinutes, attendance.EarlyMinutes });
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(attendance, schedule);
    }
    public async Task<object> PunchContext(string actor,bool checkIn,CancellationToken ct) {
        await settings.Demand(actor,AttendanceScreens.MyAttendance,"UPDATE",ct);
        var employee=await db.Set<User>().Where(x=>x.UserId==actor&&x.Status=="ACTIVE"&&x.EmployeeId!=null).Select(x=>x.EmployeeId).SingleOrDefaultAsync(ct)??throw new BusinessException(403,"HRM_AUTH_006","An employee link is required.","EMPLOYEE_LINK_REQUIRED");
        var open=await db.Set<UnscheduledAttendance>().AsNoTracking().SingleOrDefaultAsync(x=>x.EmployeeID==employee&&x.OpenEmployeeKey!=null,ct);
        if(open!=null){var config=SettingsDefaults.Read<AttendanceSettingsRequest>(open.SettingsSnapshotJson);return new{recordType="UNSCHEDULED",config.RequireQr,config.RequireGps,openId=(long?)open.ID};}
        var id=await ResolveSchedule(employee,checkIn,ct);
        if(id.HasValue){var rule=Rules(await db.Set<WorkSchedule>().AsNoTracking().SingleAsync(x=>x.ID==id,ct));return new{recordType="SCHEDULED",rule.RequireQr,rule.RequireGps,openId=(long?)null};}
        var current=await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey,ct);return new{recordType="UNSCHEDULED",current.Settings.RequireQr,current.Settings.RequireGps,openId=(long?)null};
    }
    private async Task<long?> ResolveSchedule(int employee,bool checkIn,CancellationToken ct)
    {
        var now=clock.GetUtcNow().UtcDateTime;
        var date=AttendanceRules.LocalDate(now,"Asia/Ho_Chi_Minh");var from=date.AddDays(-4);var to=date.AddDays(4);
        var schedules=await db.Set<WorkSchedule>().AsNoTracking().Where(x=>x.EmployeeID==employee&&x.Status=="SCHEDULED"&&x.WorkDate>=from&&x.WorkDate<=to).OrderBy(x=>x.ID).Take(65).ToListAsync(ct);
        if(schedules.Count>64)throw BusinessException.Conflict("Too many candidate schedules; specify scheduleId.");
        var candidates=schedules.Where(x=>x.RulesSnapshotJson!=null).Where(x=> {
            var rules=Rules(x);return now>=(checkIn?rules.CheckInOpenUtc:rules.CheckOutOpenUtc)&&now<=(checkIn?rules.CheckInCloseUtc:rules.CheckOutCloseUtc);
        }).ToArray();
        if(!checkIn&&candidates.Length>1) {
            var ids=candidates.Select(x=>x.ID).ToArray();var opened=await db.Set<AttendanceEntity>().Where(x=>ids.Contains(x.ScheduleID)&&x.CheckInAt!=null&&x.CheckOutAt==null).Select(x=>x.ScheduleID).ToListAsync(ct);
            if(opened.Count==1)return opened[0];
        }
        if(candidates.Length==0) {
            if(schedules.Where(x=>x.RulesSnapshotJson!=null).Any(x=>{var rule=Rules(x);return now>=rule.StartAtUtc&&now<=rule.EndAtUtc;}))throw BusinessException.Conflict("A scheduled shift is in progress but its attendance window is closed; request an attendance adjustment.");
            return null;
        }
        if(candidates.Length!=1)throw BusinessException.Conflict("Multiple shifts match the current attendance window; specify scheduleId.");
        return candidates[0].ID;
    }
    internal static async Task<long?> Evidence(AppDbContext db,AttendanceRuleSnapshot rules, PunchRequest request, DateTime now, CancellationToken ct)
    {
        string? qrLocation = null; long? qrId = null;
        if (rules.RequireQr)
        {
            if (!request.QrSessionId.HasValue || string.IsNullOrEmpty(request.QrToken)) throw BusinessException.Invalid("Valid QR evidence is required.");
            var qr = await db.Set<QRSession>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == request.QrSessionId && x.Status == "ACTIVE" && x.ValidFrom <= now && x.ExpiresAt > now, ct);
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.QrToken)));
            if (qr is null || !rules.Locations.Any(x => x.Code == qr.LocationCode) || !CryptographicOperations.FixedTimeEquals(Encoding.ASCII.GetBytes(hash), Encoding.ASCII.GetBytes(qr.NonceHash))) throw BusinessException.Scope();
            qrLocation = qr.LocationCode; qrId = qr.ID;
        }
        if (rules.RequireGps)
        {
            if (!request.Latitude.HasValue || !request.Longitude.HasValue || !double.IsFinite(request.Latitude.Value) || !double.IsFinite(request.Longitude.Value)) throw BusinessException.Invalid("GPS evidence is required.");
            if (!rules.Locations.Any(x => (qrLocation is null || x.Code == qrLocation) && AttendanceRules.DistanceMeters(request.Latitude.Value, request.Longitude.Value, x.Latitude, x.Longitude) <= x.RadiusMeters)) throw BusinessException.Scope();
        }
        return qrId;
    }
    public async Task<AttendanceView> Close(string actor, long id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var schedule = await schedules.Find(actor, id, AttendanceScreens.Attendance, "APPROVE", true, ct);
        await HRM.API.Modules.Payroll.Services.TimesheetLocks.RequireOpen(db, schedule.WorkDate, ct);
        var rules = Rules(schedule);
        if (clock.GetUtcNow().UtcDateTime <= rules.CheckOutCloseUtc) throw BusinessException.Conflict("Attendance window has not closed.");
        if (schedule.Status == "CANCELLED") throw BusinessException.Conflict("Schedule is cancelled.");
        var attendance = await db.Set<AttendanceEntity>().SingleOrDefaultAsync(x => x.ScheduleID == id, ct) ?? new AttendanceEntity { ScheduleID = id };
        attendance.Status = attendance.CheckInAt.HasValue ? attendance.CheckOutAt.HasValue ? "COMPLETE" : "MISSING_CHECK_OUT" : attendance.CheckOutAt.HasValue ? "MISSING_CHECK_IN" : "ABSENT";
        if (attendance.ID == 0) db.Add(attendance); schedule.Status = "CLOSED"; schedule.Version++;
        settings.Audit(actor, "ATTENDANCE_CLOSED", "schedule:" + id, null, new { attendance.Status });
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(attendance, schedule);
    }
    public async Task<PageResult<QrView>> QrList(string actor, PageQuery q, CancellationToken ct)
    {
        await settings.Demand(actor, AttendanceScreens.Qr, "VIEW", ct); var query = db.Set<QRSession>().AsNoTracking(); var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x => new QrView(x.ID, x.LocationCode, DateTime.SpecifyKind(x.ValidFrom, DateTimeKind.Utc), DateTime.SpecifyKind(x.ExpiresAt, DateTimeKind.Utc), x.Status)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }
    public async Task<QrCreated> CreateQr(string actor, QrCreateRequest r, CancellationToken ct)
    {
        SettingsDefaults.Validate(r); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await settings.Demand(actor, AttendanceScreens.Qr, "NEW", ct);
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        if (!config.Settings.Locations.Any(x => x.Code == r.LocationCode)) throw BusinessException.Invalid("Location is not configured.");
        var now = clock.GetUtcNow().UtcDateTime; var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var row = new QRSession { LocationCode = r.LocationCode, NonceHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))), ValidFrom = now, ExpiresAt = now.AddSeconds(r.LifetimeSeconds), Status = "ACTIVE" };
        db.Add(row); await db.SaveChangesAsync(ct); settings.Audit(actor, "QR_SESSION_CREATED", "qr:" + row.ID, null, new { row.LocationCode, row.ExpiresAt });
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(new(row.ID, row.LocationCode, now, row.ExpiresAt, row.Status), token);
    }
}
