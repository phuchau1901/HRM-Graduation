-- Read-only diagnostic for GET /api/attendances/daily (MySQL 8).
-- SQL equivalent to the current read model, not a captured production command.
-- Example assumes 23 November 2026; change dates to the actual failing request.
-- SET statements affect only this connection's session variables, not stored data.
-- Set scope/current employee/department to the effective WEB_ATTENDANCE VIEW scope.
SET @from = '2026-11-23';
SET @to = @from;
SET @nowUtc = UTC_TIMESTAMP(6);
SET @scope = 'ALL';
SET @currentEmployeeId = 0;
SET @currentDepartmentId = 0;
SET @departmentId = 0;
SET @teamId = 0;
SET @employeeId = 0;
SET @search = NULL;
SET @status = NULL;
SET @holidays = COALESCE((SELECT JSON_EXTRACT(json_value, '$.holidayDates') FROM system_settings WHERE setting_key='ATTENDANCE'),JSON_ARRAY());
SET @workingDays = COALESCE((SELECT JSON_EXTRACT(json_value, '$.workingDays') FROM system_settings WHERE setting_key='ATTENDANCE'),JSON_ARRAY(1,2,3,4,5));

WITH RECURSIVE days(work_date) AS (
    SELECT DATE(@from) UNION ALL SELECT DATE_ADD(work_date, INTERVAL 1 DAY) FROM days WHERE work_date < DATE(@to)
), base AS (
    SELECT e.Id AS EmployeeId, e.EmployeeCode, e.FullName AS EmployeeName,
        e.DepartmentId, d.DepartmentName, e.TeamId, t.TeamName, days.work_date AS WorkDate,
        s.id AS ScheduleId, a.id AS AttendanceId,
        COALESCE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.shiftCode')) END, sh.code) AS ShiftCode,
        CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.timezone')) END AS Timezone, CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.workDate')) END AS SnapshotDate,
        CAST(REPLACE(REPLACE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.startAtUtc')) END, 'T', ' '), 'Z', '') AS DATETIME(6)) AS ShiftStartAtUtc, CAST(REPLACE(REPLACE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.endAtUtc')) END, 'T', ' '), 'Z', '') AS DATETIME(6)) AS ShiftEndAtUtc,
        CAST(REPLACE(REPLACE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.checkInOpenUtc')) END, 'T', ' '), 'Z', '') AS DATETIME(6)) AS CheckInOpenUtc, CAST(REPLACE(REPLACE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.checkInCloseUtc')) END, 'T', ' '), 'Z', '') AS DATETIME(6)) AS CheckInCloseUtc,
        CAST(REPLACE(REPLACE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.checkOutOpenUtc')) END, 'T', ' '), 'Z', '') AS DATETIME(6)) AS CheckOutOpenUtc, CAST(REPLACE(REPLACE(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.checkOutCloseUtc')) END, 'T', ' '), 'Z', '') AS DATETIME(6)) AS CheckOutCloseUtc,
        a.check_in_at AS CheckInAtUtc, a.check_out_at AS CheckOutAtUtc,
        COALESCE(a.late_minutes, 0) AS LateMinutes, COALESCE(a.early_minutes, 0) AS EarlyMinutes,
        CAST(COALESCE(NULLIF(CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.breakMinutes')) END, 'null'), 0) AS SIGNED) AS BreakMinutes,
        CASE WHEN CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.requireQr')) END IN ('true', '1', 1) THEN 1 ELSE 0 END AS RequireQr,
        CASE WHEN CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.requireGps')) END IN ('true', '1', 1) THEN 1 ELSE 0 END AS RequireGps,
        s.rules_snapshot_json AS RulesJson, CASE WHEN JSON_VALID(s.rules_snapshot_json) THEN JSON_UNQUOTE(JSON_EXTRACT(s.rules_snapshot_json, '$.missingPunchRule')) END AS MissingPunchRule,
        CASE WHEN JSON_CONTAINS(@holidays, JSON_QUOTE(DATE_FORMAT(days.work_date,'%Y-%m-%d'))) THEN 1 ELSE 0 END AS IsHoliday,
        CASE WHEN NOT JSON_CONTAINS(@workingDays, CAST(WEEKDAY(days.work_date)+1 AS JSON)) THEN 1 ELSE 0 END AS IsDayOff,
        CASE WHEN EXISTS (SELECT 1 FROM leave_requests l WHERE l.employee_id=e.Id
            AND l.status IN ('APPROVED','CANCELLATION_PENDING') AND l.from_date<=days.work_date AND l.to_date>=days.work_date) THEN 1 ELSE 0 END AS IsOnLeave,
        CASE WHEN EXISTS (SELECT 1 FROM timesheet_periods p WHERE p.period_key=DATE_FORMAT(days.work_date,'%Y-%m')
            AND (p.closed_at IS NOT NULL OR p.status NOT IN ('OPEN','DRAFT'))) THEN 1 ELSE 0 END AS IsPeriodLocked,
        e.EmploymentStatus
    FROM employees e CROSS JOIN days
    JOIN departments d ON d.Id=e.DepartmentId
    LEFT JOIN teams t ON t.Id=e.TeamId
    LEFT JOIN work_schedules s ON s.employee_id=e.Id AND s.work_date=days.work_date AND s.status<>'CANCELLED'
    LEFT JOIN attendances a ON a.schedule_id=s.id
    LEFT JOIN shifts sh ON sh.id=s.shift_id
    WHERE e.HireDate<=days.work_date
        AND (@scope='ALL' OR (@scope='SELF' AND e.Id=@currentEmployeeId) OR (@scope='DEPARTMENT' AND e.DepartmentId=@currentDepartmentId))
        AND (@departmentId=0 OR e.DepartmentId=@departmentId) AND (@teamId=0 OR e.TeamId=@teamId) AND (@employeeId=0 OR e.Id=@employeeId)
), shaped AS (
    SELECT base.*,
        CASE WHEN ScheduleId IS NOT NULL AND (ShiftStartAtUtc IS NULL OR ShiftEndAtUtc IS NULL OR CheckInOpenUtc IS NULL
            OR CheckInCloseUtc IS NULL OR CheckOutOpenUtc IS NULL OR CheckOutCloseUtc IS NULL OR SnapshotDate IS NULL OR SnapshotDate<>WorkDate) THEN 1 ELSE 0 END AS SnapshotMissing
    FROM base WHERE EmploymentStatus='ACTIVE' OR ScheduleId IS NOT NULL OR IsOnLeave=1
), result AS (
SELECT EmployeeId, EmployeeCode, EmployeeName, DepartmentId, DepartmentName, TeamId, TeamName, WorkDate,
    ScheduleId, AttendanceId, ShiftCode, Timezone, ShiftStartAtUtc, ShiftEndAtUtc, CheckInOpenUtc, CheckInCloseUtc,
    CheckOutOpenUtc, CheckOutCloseUtc, CheckInAtUtc, CheckOutAtUtc, LateMinutes, EarlyMinutes,
    CASE WHEN LateMinutes>0 THEN 1 ELSE 0 END AS IsLate, CASE WHEN EarlyMinutes>0 THEN 1 ELSE 0 END AS IsEarly,
    IsOnLeave, IsHoliday, IsPeriodLocked, SnapshotMissing, RequireQr, RequireGps, MissingPunchRule, RulesJson,
    CASE WHEN CheckInAtUtc IS NOT NULL AND CheckOutAtUtc IS NOT NULL AND SnapshotMissing=0 THEN CAST(GREATEST(0, TIMESTAMPDIFF(MINUTE, CheckInAtUtc, CheckOutAtUtc)-BreakMinutes) AS SIGNED) ELSE NULL END AS WorkedMinutes,
    CASE WHEN CheckInAtUtc IS NOT NULL AND CheckOutAtUtc IS NOT NULL THEN 'COMPLETE'
        WHEN CheckOutAtUtc IS NOT NULL THEN 'MISSING_CHECK_IN'
        WHEN CheckInAtUtc IS NOT NULL THEN CASE WHEN SnapshotMissing=1 THEN 'LEGACY_UNVERIFIED' WHEN @nowUtc>CheckOutCloseUtc THEN 'MISSING_CHECK_OUT' ELSE 'WORKING' END
        WHEN IsOnLeave=1 THEN 'ON_LEAVE'
        WHEN ScheduleId IS NULL THEN CASE WHEN IsHoliday=1 THEN 'HOLIDAY' WHEN IsDayOff=1 THEN 'DAY_OFF' ELSE 'NO_SCHEDULE' END
        WHEN SnapshotMissing=1 THEN 'LEGACY_UNVERIFIED'
        WHEN @nowUtc>CheckOutCloseUtc THEN 'ABSENT' ELSE 'NOT_CHECKED_IN' END AS Status
FROM shaped
)
SELECT * FROM result
WHERE (@search IS NULL OR LOCATE(@search, EmployeeCode)>0 OR LOCATE(@search, EmployeeName)>0)
  AND (@status IS NULL
       OR (@status='LATE' AND IsLate=1)
       OR (@status='EARLY' AND IsEarly=1)
       OR Status=@status)
ORDER BY WorkDate DESC, EmployeeCode, EmployeeId, ScheduleId
LIMIT 20 OFFSET 0;
