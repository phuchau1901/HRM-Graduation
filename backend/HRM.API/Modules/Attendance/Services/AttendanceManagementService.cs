using System.Globalization;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Attendance.DTOs;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.System.DTOs;
using HRM.API.Modules.System.Services;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Attendance.Services;
public sealed class AttendanceManagementService(AppDbContext db, EmployeeDataScope scopes, SystemSettingsService settings, TimeProvider clock, HRM.API.Modules.Authorization.Services.IPermissionService permissions)
{
    private (DateOnly From, DateOnly To) Dates(DailyAttendanceQuery q)
    {
        var today = VietnamBusinessDate.Today(clock);
        if (q.Date.HasValue && (q.From.HasValue || q.To.HasValue)) throw BusinessException.Invalid("Use Date or From/To, not both.");
        var from = q.Date ?? q.From ?? today; var to = q.Date ?? q.To ?? from;
        if (from.Year < 1900 || to.Year > 9998 || to < from || to.DayNumber - from.DayNumber > 30) throw BusinessException.Invalid("Select 1..31 days in the supported calendar (1900..9998).");
        return (from, to);
    }
    private async Task<IQueryable<DailyAttendanceRow>> Query(string actor, DailyAttendanceQuery q, string action, bool me, DateTime now, CancellationToken ct)
    {
        var (from, to) = Dates(q);
        EmployeeAccess access;
        if (me)
        {
            await settings.Demand(actor, AttendanceScreens.MyAttendance, "VIEW", ct);
            var employee = await (from user in db.Set<HRM.API.Modules.Authorization.Entities.User>().AsNoTracking()
                                  join person in db.Employees.AsNoTracking() on user.EmployeeId equals (int?)person.Id
                                  where user.UserId==actor && user.Status=="ACTIVE"
                                  select new { person.Id,person.DepartmentId }).SingleOrDefaultAsync(ct)
                ?? throw new BusinessException(403,"HRM_AUTH_006","An employee link is required.","EMPLOYEE_LINK_REQUIRED");
            // Ownership filter only: never read data-scope grants for the personal endpoint.
            access=new EmployeeAccess("SELF",employee.Id,employee.DepartmentId);
        }
        else
        {
            await settings.Demand(actor, AttendanceScreens.Attendance, action, ct);
            access=await scopes.GetAsync(actor, AttendanceScreens.Attendance, action, ct);
        }
        var config = await settings.Read<AttendanceSettingsRequest>(SettingsDefaults.AttendanceKey, ct);
        var sqlite = db.Database.ProviderName == "Microsoft.EntityFrameworkCore.Sqlite";
        var args = new List<object> { from.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), to.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture), now,
            access.Scope, access.EmployeeId ?? 0, access.DepartmentId ?? 0, q.DepartmentId ?? 0, q.TeamId ?? 0, me ? access.EmployeeId!.Value : q.EmployeeId ?? 0 };
        string DatesIn(IEnumerable<DateOnly> dates)
        {
            var parameters = new List<string>();
            foreach (var day in dates) { parameters.Add("{" + args.Count + "}"); args.Add(day.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)); }
            return parameters.Count == 0 ? "NULL" : string.Join(',', parameters);
        }
        var days = Enumerable.Range(0, to.DayNumber - from.DayNumber + 1).Select(from.AddDays).ToArray();
        var holidays = DatesIn(days.Where(config.Settings.HolidayDates.Contains));
        var rest = DatesIn(days.Where(d => !config.Settings.WorkingDays.Contains(((int)d.DayOfWeek + 6) % 7 + 1)));
        string Json(string field) => sqlite ? $"CASE WHEN json_valid(s.rules_snapshot_json) THEN json_extract(s.rules_snapshot_json, '$.{field}') END"
            : $"CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.{field}')) END";
        string Time(string field) => sqlite ? $"datetime({Json(field)})" : $"CAST(REPLACE(REPLACE({Json(field)}, 'T', ' '), 'Z', '') AS DATETIME(6))";
        var next = sqlite ? "date(work_date, '+1 day')" : "DATE_ADD(work_date, INTERVAL 1 DAY)";
        var elapsed = sqlite ? "CAST(ROUND((julianday(CheckOutAtUtc) - julianday(CheckInAtUtc)) * 1440, 6) AS INTEGER)" : "TIMESTAMPDIFF(MINUTE, CheckInAtUtc, CheckOutAtUtc)";
        var max = sqlite ? "MAX" : "GREATEST";
        // Parameterized read model: employee x day, LEFT JOIN schedules and punches. All paging,
        // filters and statistics remain SQL-side, including derived snapshot/window statuses.
        var sql = $$"""
            WITH RECURSIVE days(work_date) AS (
                SELECT DATE({0}) UNION ALL SELECT {{next}} FROM days WHERE work_date < DATE({1})
            ), base AS (
                SELECT e.Id AS EmployeeId, e.EmployeeCode, e.FullName AS EmployeeName,
                    e.DepartmentId, d.DepartmentName, e.TeamId, t.TeamName, days.work_date AS WorkDate,
                    s.id AS ScheduleId, a.id AS AttendanceId,
                    COALESCE({{Json("shiftCode")}}, sh.code) AS ShiftCode,
                    {{Json("timezone")}} AS Timezone, {{Json("workDate")}} AS SnapshotDate,
                    {{Time("startAtUtc")}} AS ShiftStartAtUtc, {{Time("endAtUtc")}} AS ShiftEndAtUtc,
                    {{Time("checkInOpenUtc")}} AS CheckInOpenUtc, {{Time("checkInCloseUtc")}} AS CheckInCloseUtc,
                    {{Time("checkOutOpenUtc")}} AS CheckOutOpenUtc, {{Time("checkOutCloseUtc")}} AS CheckOutCloseUtc,
                    a.check_in_at AS CheckInAtUtc, a.check_out_at AS CheckOutAtUtc,
                    COALESCE(a.late_minutes, 0) AS LateMinutes, COALESCE(a.early_minutes, 0) AS EarlyMinutes,
                    COALESCE({{Json("breakMinutes")}}, 0) AS BreakMinutes,
                    CASE WHEN {{Json("requireQr")}} IN ('true', '1', 1) THEN 1 ELSE 0 END AS RequireQr,
                    CASE WHEN {{Json("requireGps")}} IN ('true', '1', 1) THEN 1 ELSE 0 END AS RequireGps,
                    s.rules_snapshot_json AS RulesJson, {{Json("missingPunchRule")}} AS MissingPunchRule,
                    CASE WHEN days.work_date IN ({{holidays}}) THEN 1 ELSE 0 END AS IsHoliday,
                    CASE WHEN days.work_date IN ({{rest}}) THEN 1 ELSE 0 END AS IsDayOff,
                    CASE WHEN EXISTS (SELECT 1 FROM leave_requests l WHERE l.employee_id=e.Id
                        AND l.status IN ('APPROVED','CANCELLATION_PENDING') AND l.from_date<=days.work_date AND l.to_date>=days.work_date) THEN 1 ELSE 0 END AS IsOnLeave,
                    CASE WHEN EXISTS (SELECT 1 FROM timesheet_periods p WHERE p.period_key={{(sqlite ? "substr(days.work_date,1,7)" : "DATE_FORMAT(days.work_date,'%Y-%m')")}}
                        AND (p.closed_at IS NOT NULL OR p.status NOT IN ('OPEN','DRAFT'))) THEN 1 ELSE 0 END AS IsPeriodLocked,
                    e.EmploymentStatus
                FROM employees e CROSS JOIN days
                JOIN departments d ON d.Id=e.DepartmentId
                LEFT JOIN teams t ON t.Id=e.TeamId
                LEFT JOIN work_schedules s ON s.employee_id=e.Id AND s.work_date=days.work_date AND s.status<>'CANCELLED'
                LEFT JOIN attendances a ON a.schedule_id=s.id
                LEFT JOIN shifts sh ON sh.id=s.shift_id
                WHERE e.HireDate<=days.work_date
                    AND ({3}='ALL' OR ({3}='SELF' AND e.Id={4}) OR ({3}='DEPARTMENT' AND e.DepartmentId={5}))
                    AND ({6}=0 OR e.DepartmentId={6}) AND ({7}=0 OR e.TeamId={7}) AND ({8}=0 OR e.Id={8})
            ), shaped AS (
                SELECT base.*,
                    CASE WHEN ScheduleId IS NOT NULL AND (ShiftStartAtUtc IS NULL OR ShiftEndAtUtc IS NULL OR CheckInOpenUtc IS NULL
                        OR CheckInCloseUtc IS NULL OR CheckOutOpenUtc IS NULL OR CheckOutCloseUtc IS NULL OR SnapshotDate IS NULL OR SnapshotDate<>WorkDate) THEN 1 ELSE 0 END AS SnapshotMissing
                FROM base WHERE EmploymentStatus='ACTIVE' OR ScheduleId IS NOT NULL OR IsOnLeave=1
            )
            SELECT EmployeeId, EmployeeCode, EmployeeName, DepartmentId, DepartmentName, TeamId, TeamName, WorkDate,
                ScheduleId, AttendanceId, ShiftCode, Timezone, ShiftStartAtUtc, ShiftEndAtUtc, CheckInOpenUtc, CheckInCloseUtc,
                CheckOutOpenUtc, CheckOutCloseUtc, CheckInAtUtc, CheckOutAtUtc, LateMinutes, EarlyMinutes,
                CASE WHEN LateMinutes>0 THEN 1 ELSE 0 END AS IsLate, CASE WHEN EarlyMinutes>0 THEN 1 ELSE 0 END AS IsEarly,
                IsOnLeave, IsHoliday, IsPeriodLocked, SnapshotMissing, RequireQr, RequireGps, MissingPunchRule, RulesJson,
                CASE WHEN CheckInAtUtc IS NOT NULL AND CheckOutAtUtc IS NOT NULL AND SnapshotMissing=0 THEN {{max}}(0, {{elapsed}}-BreakMinutes) ELSE NULL END AS WorkedMinutes,
                CASE WHEN CheckInAtUtc IS NOT NULL AND CheckOutAtUtc IS NOT NULL THEN 'COMPLETE'
                    WHEN CheckOutAtUtc IS NOT NULL THEN 'MISSING_CHECK_IN'
                    WHEN CheckInAtUtc IS NOT NULL THEN CASE WHEN SnapshotMissing=1 THEN 'LEGACY_UNVERIFIED' WHEN {2}>CheckOutCloseUtc THEN 'MISSING_CHECK_OUT' ELSE 'WORKING' END
                    WHEN IsOnLeave=1 THEN 'ON_LEAVE'
                    WHEN ScheduleId IS NULL THEN CASE WHEN IsHoliday=1 THEN 'HOLIDAY' WHEN IsDayOff=1 THEN 'DAY_OFF' ELSE 'NO_SCHEDULE' END
                    WHEN SnapshotMissing=1 THEN 'LEGACY_UNVERIFIED'
                    WHEN {2}>CheckOutCloseUtc THEN 'ABSENT' ELSE 'NOT_CHECKED_IN' END AS Status
            FROM shaped
            """;
        var query = db.Database.SqlQueryRaw<DailyAttendanceRow>(sql, args.ToArray());
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(r => r.EmployeeCode.Contains(q.Search) || r.EmployeeName.Contains(q.Search));
        if (q.Status == "LATE") query = query.Where(r => r.IsLate);
        else if (q.Status == "EARLY") query = query.Where(r => r.IsEarly);
        else if (q.Status != null) query = query.Where(r => r.Status == q.Status);
        return query;
    }
    private static IOrderedQueryable<DailyAttendanceRow> Ordered(IQueryable<DailyAttendanceRow> query) => query.OrderByDescending(r => r.WorkDate).ThenBy(r => r.EmployeeCode).ThenBy(r => r.EmployeeId).ThenBy(r => r.ScheduleId);
    private static void Utc(DailyAttendanceRow row)
    {
        static DateTime? Value(DateTime? value) => value.HasValue ? DateTime.SpecifyKind(value.Value, DateTimeKind.Utc) : null;
        row.ShiftStartAtUtc=Value(row.ShiftStartAtUtc); row.ShiftEndAtUtc=Value(row.ShiftEndAtUtc); row.CheckInOpenUtc=Value(row.CheckInOpenUtc); row.CheckInCloseUtc=Value(row.CheckInCloseUtc);
        row.CheckOutOpenUtc=Value(row.CheckOutOpenUtc); row.CheckOutCloseUtc=Value(row.CheckOutCloseUtc); row.CheckInAtUtc=Value(row.CheckInAtUtc); row.CheckOutAtUtc=Value(row.CheckOutAtUtc);
    }
    public async Task<DailyAttendancePage> Daily(string actor, DailyAttendanceQuery q, CancellationToken ct, bool me = false)
    {
        if (me && !q.Date.HasValue && !q.From.HasValue && !q.To.HasValue)
        { q.To=VietnamBusinessDate.Today(clock); q.From=q.To.Value.AddDays(-1); }
        var now = clock.GetUtcNow().UtcDateTime; var query = await Query(actor, q, "VIEW", me, now, ct);
        var total = await query.CountAsync(ct); var rows = await Ordered(query).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct); rows.ForEach(Utc);
        return new(true,total,q.Page,q.PageSize,now,rows);
    }
    public async Task<DailyAttendanceStatistics> Statistics(string actor, DailyAttendanceQuery q, CancellationToken ct)
    {
        var now = clock.GetUtcNow().UtcDateTime; var query = await Query(actor,q,"VIEW",false,now,ct); var (from,to)=Dates(q);
        var people = query.GroupBy(r=>r.EmployeeId).Select(g=>new {
            Scheduled=g.Max(r=>r.ScheduleId.HasValue?1:0), CheckedIn=g.Max(r=>r.CheckInAtUtc.HasValue?1:0), Working=g.Max(r=>r.Status=="WORKING"?1:0),
            Late=g.Max(r=>r.IsLate?1:0), Early=g.Max(r=>r.IsEarly?1:0), NotPunched=g.Max(r=>r.ScheduleId.HasValue && !r.CheckInAtUtc.HasValue && !r.CheckOutAtUtc.HasValue && !r.IsOnLeave?1:0),
            OnLeave=g.Max(r=>r.IsOnLeave?1:0), Absent=g.Max(r=>r.Status=="ABSENT"?1:0), MissingCheckOut=g.Max(r=>r.Status=="MISSING_CHECK_OUT"?1:0) });
        var sums = await people.GroupBy(r=>1).Select(g=>new { Employees=g.Count(), Scheduled=g.Sum(r=>r.Scheduled),CheckedIn=g.Sum(r=>r.CheckedIn),Working=g.Sum(r=>r.Working),Late=g.Sum(r=>r.Late),Early=g.Sum(r=>r.Early),NotPunched=g.Sum(r=>r.NotPunched),OnLeave=g.Sum(r=>r.OnLeave),Absent=g.Sum(r=>r.Absent),MissingCheckOut=g.Sum(r=>r.MissingCheckOut) }).SingleOrDefaultAsync(ct);
        return new(true,now,from,to,sums?.Employees??0,sums?.Scheduled??0,sums?.CheckedIn??0,sums?.Working??0,sums?.Late??0,sums?.Early??0,sums?.NotPunched??0,sums?.OnLeave??0,sums?.Absent??0,sums?.MissingCheckOut??0);
    }
    public async Task<DailyAttendanceDetail> Detail(string actor, int employeeId, DateOnly date, long? scheduleId, CancellationToken ct)
    {
        if (employeeId<=0 || scheduleId<=0) throw BusinessException.Invalid("Valid employee and schedule IDs required.");
        var personalView=await permissions.HasPermissionAsync(actor,AttendanceScreens.MyAttendance,"VIEW",ct);
        int? ownId=null;
        if(personalView)
            ownId=await (from user in db.Set<HRM.API.Modules.Authorization.Entities.User>().AsNoTracking()
                         join person in db.Employees.AsNoTracking() on user.EmployeeId equals (int?)person.Id
                         where user.UserId==actor && user.Status=="ACTIVE" select (int?)person.Id).SingleOrDefaultAsync(ct);
        var personal=personalView && ownId==employeeId;
        if(!personal && !await permissions.HasPermissionAsync(actor,AttendanceScreens.Attendance,"VIEW",ct))
        {
            if(!personalView) throw new BusinessException(403,"HRM_AUTH_003","VIEW permission required on WEB_MY_ATTENDANCE or WEB_ATTENDANCE.","PERMISSION_DENIED");
            if(!ownId.HasValue) throw new BusinessException(403,"HRM_AUTH_006","An employee link is required.","EMPLOYEE_LINK_REQUIRED");
            throw BusinessException.Missing();
        }
        var query=await Query(actor,new DailyAttendanceQuery { Date=date, EmployeeId=employeeId },"VIEW",personal,clock.GetUtcNow().UtcDateTime,ct);
        var row=await query.SingleOrDefaultAsync(r=>r.ScheduleId==scheduleId,ct)??throw BusinessException.Missing(); Utc(row);
        var adjustments=row.AttendanceId.HasValue ? await db.Set<AttendanceAdjustment>().AsNoTracking().Where(a=>a.AttendanceID==row.AttendanceId && a.EmployeeID==row.EmployeeId).OrderByDescending(a=>a.ID)
            .Select(a=>new AttendanceAdjustmentSummary(a.ID,a.Status,a.Reason,a.ProposedCheckIn,a.ProposedCheckOut)).Take(20).ToListAsync(ct) : [];
        adjustments=adjustments.Select(a=>a with { ProposedCheckIn=a.ProposedCheckIn.HasValue?DateTime.SpecifyKind(a.ProposedCheckIn.Value,DateTimeKind.Utc):null, ProposedCheckOut=a.ProposedCheckOut.HasValue?DateTime.SpecifyKind(a.ProposedCheckOut.Value,DateTimeKind.Utc):null }).ToList();
        return new(row,row.SnapshotMissing || row.RulesJson==null ? null : SettingsDefaults.Read<AttendanceRuleSnapshot>(row.RulesJson),adjustments);
    }
    public async Task<AttendanceFilters> Filters(string actor,CancellationToken ct)
    {
        await settings.Demand(actor,AttendanceScreens.Attendance,"VIEW",ct); var access=await scopes.GetAsync(actor,AttendanceScreens.Attendance,"VIEW",ct); var employees=access.Apply(db.Employees.AsNoTracking());
        var departments=await (from e in employees join d in db.Departments on e.DepartmentId equals d.Id select new AttendanceFilterOption(d.Id,d.DepartmentName)).Distinct().ToListAsync(ct);
        var teams=await (from e in employees join t in db.Teams on e.TeamId equals (int?)t.Id select new AttendanceFilterOption(t.Id,t.TeamName)).Distinct().ToListAsync(ct);
        return new(departments,teams);
    }
    public async Task<byte[]> Export(string actor,DailyAttendanceQuery q,CancellationToken ct)
    {
        var query=await Query(actor,q,"EXPORT",false,clock.GetUtcNow().UtcDateTime,ct); var rows=await Ordered(query).Take(10001).ToListAsync(ct);
        if(rows.Count>10000) throw BusinessException.Invalid("Export limit is 10000 rows. Narrow the dates or filters."); rows.ForEach(Utc);
        return AttendanceWorkbook.Create(rows);
    }
}
