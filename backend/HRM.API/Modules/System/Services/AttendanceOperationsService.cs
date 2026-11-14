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
namespace HRM.API.Modules.System.Services;
public sealed class AttendanceOperationsService(AppDbContext db, SystemSettingsService settings, AttendanceConfigurationService schedules, TimeProvider clock)
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
        await settings.Demand(actor, SystemScreens.Attendance, "VIEW", ct);
        var visible = (await schedules.Scoped(actor, SystemScreens.Attendance, "VIEW", ct)).AsNoTracking();
        if (q.EmployeeId.HasValue) visible = visible.Where(x => x.EmployeeID == q.EmployeeId);
        if (q.From.HasValue) visible = visible.Where(x => x.WorkDate >= q.From); if (q.To.HasValue) visible = visible.Where(x => x.WorkDate <= q.To);
        var query = from a in db.Set<AttendanceEntity>().AsNoTracking() join s in visible on a.ScheduleID equals s.ID select new { Attendance = a, Schedule = s };
        var total = await query.CountAsync(ct); var rows = await query.OrderBy(x => x.Schedule.WorkDate).ThenBy(x => x.Attendance.ID).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows.Select(x => Dto(x.Attendance, x.Schedule)).ToList());
    }
    public async Task<AttendanceView> Punch(string actor, PunchRequest r, bool checkIn, CancellationToken ct)
    {
        SettingsDefaults.Validate(r); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var action = checkIn ? "NEW" : "UPDATE";
        var schedule = await schedules.Find(actor, r.ScheduleId, SystemScreens.Attendance, action, true, ct);
        var ownEmployee = await db.Set<User>().AsNoTracking().Where(x => x.UserId == actor && x.Status == "ACTIVE").Select(x => x.EmployeeId).SingleAsync(ct);
        if (ownEmployee != schedule.EmployeeID) throw BusinessException.Scope();
        if (schedule.Status != "SCHEDULED") throw BusinessException.Conflict("Schedule is not open.");
        var operation = checkIn ? "CHECK_IN" : "CHECK_OUT";
        var previous = await db.Set<AttendanceRequest>().AsNoTracking().SingleOrDefaultAsync(x => x.RequestKey == r.RequestKey, ct);
        if (previous is not null)
        {
            if (previous.EmployeeID != schedule.EmployeeID || previous.Operation != operation) throw BusinessException.Conflict("Request key already used.");
            var existing = await db.Set<AttendanceEntity>().SingleOrDefaultAsync(x => x.ID == previous.AttendanceID && x.ScheduleID == schedule.ID, ct) ?? throw BusinessException.Conflict("Request key belongs to another schedule.");
            await tx.CommitAsync(ct); return Dto(existing, schedule);
        }
        var rules = Rules(schedule); var now = clock.GetUtcNow().UtcDateTime; AttendanceRules.Window(rules, now, checkIn);
        var qr = await Evidence(rules, r, now, ct);
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
    private async Task<long?> Evidence(AttendanceRuleSnapshot rules, PunchRequest request, DateTime now, CancellationToken ct)
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
        var schedule = await schedules.Find(actor, id, SystemScreens.Attendance, "APPROVE", true, ct);
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
        await settings.Demand(actor, SystemScreens.Qr, "VIEW", ct); var query = db.Set<QRSession>().AsNoTracking(); var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x => new QrView(x.ID, x.LocationCode, DateTime.SpecifyKind(x.ValidFrom, DateTimeKind.Utc), DateTime.SpecifyKind(x.ExpiresAt, DateTimeKind.Utc), x.Status)).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }
    public async Task<QrCreated> CreateQr(string actor, QrCreateRequest r, CancellationToken ct)
    {
        SettingsDefaults.Validate(r); await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await settings.Demand(actor, SystemScreens.Qr, "NEW", ct);
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        if (!config.Settings.Locations.Any(x => x.Code == r.LocationCode)) throw BusinessException.Invalid("Location is not configured.");
        var now = clock.GetUtcNow().UtcDateTime; var token = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var row = new QRSession { LocationCode = r.LocationCode, NonceHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token))), ValidFrom = now, ExpiresAt = now.AddSeconds(r.LifetimeSeconds), Status = "ACTIVE" };
        db.Add(row); await db.SaveChangesAsync(ct); settings.Audit(actor, "QR_SESSION_CREATED", "qr:" + row.ID, null, new { row.LocationCode, row.ExpiresAt });
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return new(new(row.ID, row.LocationCode, now, row.ExpiresAt, row.Status), token);
    }
}
