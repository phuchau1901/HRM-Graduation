using HRM.API.Common;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Attendance.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Leave.Services;
public sealed partial class LeaveWorkflowService
{
    private IQueryable<LeaveView> LeaveProjection(IQueryable<LeaveRequest> requests) =>
        from r in requests join e in db.Employees.AsNoTracking() on r.EmployeeID equals e.Id join t in db.Set<LeaveType>() on r.LeaveTypeID equals t.ID
        select new LeaveView(r.ID, e.Id, e.FullName, t.ID, t.Name, r.FromDate, r.ToDate, r.RequestedDays, r.Reason, r.Status, r.Version,
            db.Set<ApprovalRequest>().Where(a => a.RequestType == "LEAVE" && a.ReferenceID == r.ID).OrderByDescending(a => a.ID).Select(a => (long?)a.ID).FirstOrDefault());
    public async Task<PageResult<LeaveView>> Leaves(string actor, WorkflowQuery q, CancellationToken ct)
    {
        var employees = await Visible(actor, Leave, q, ct);
        var query = db.Set<LeaveRequest>().AsNoTracking().Where(r => employees.Any(e => e.Id == r.EmployeeID));
        if (q.Status is not null) query = query.Where(r => r.Status == q.Status);
        if (q.Year.HasValue) query = query.Where(r => r.FromDate.Year <= q.Year && r.ToDate.Year >= q.Year);
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await LeaveProjection(query.OrderByDescending(r => r.ID).Skip(Paging.Offset(q)).Take(q.PageSize)).ToListAsync(ct));
    }
    public async Task<LeaveView> LeaveDetail(string actor, long id, CancellationToken ct)
    {
        var employees = await Visible(actor, Leave, new(), ct);
        return await LeaveProjection(db.Set<LeaveRequest>().AsNoTracking().Where(r => r.ID == id && employees.Any(e => e.Id == r.EmployeeID))).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
    }
    private IQueryable<OvertimeView> OvertimeProjection(IQueryable<OvertimeRequest> requests) =>
        from r in requests join e in db.Employees.AsNoTracking() on r.EmployeeID equals e.Id
        select new OvertimeView(r.ID, e.Id, e.FullName, r.StartAt, r.EndAt, r.RequestedHours, r.ApprovedHours, r.Reason, r.Status, r.Version,
            db.Set<ApprovalRequest>().Where(a => a.RequestType == "OVERTIME" && a.ReferenceID == r.ID).OrderByDescending(a => a.ID).Select(a => (long?)a.ID).FirstOrDefault());
    public async Task<PageResult<OvertimeView>> Overtimes(string actor, WorkflowQuery q, CancellationToken ct)
    {
        var employees = await Visible(actor, Overtime, q, ct);
        var query = db.Set<OvertimeRequest>().AsNoTracking().Where(r => employees.Any(e => e.Id == r.EmployeeID)); if (q.Status is not null) query = query.Where(r => r.Status == q.Status);
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await OvertimeProjection(query.OrderByDescending(r => r.ID).Skip(Paging.Offset(q)).Take(q.PageSize)).ToListAsync(ct));
    }
    public async Task<OvertimeView> OvertimeDetail(string actor, long id, CancellationToken ct)
    {
        var employees = await Visible(actor, Overtime, new(), ct);
        return await OvertimeProjection(db.Set<OvertimeRequest>().AsNoTracking().Where(r => r.ID == id && employees.Any(e => e.Id == r.EmployeeID))).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
    }
    public async Task<PageResult<AdjustmentView>> AdjustmentList(string actor, WorkflowQuery q, CancellationToken ct)
    {
        var employees = await Visible(actor, Adjustments, q, ct);
        var query = db.Set<AttendanceAdjustment>().AsNoTracking().Where(r => employees.Any(e => e.Id == r.EmployeeID));
        if (q.Status is not null) query = query.Where(r => r.Status == q.Status);
        var total = await query.CountAsync(ct);
        var rows = await query.OrderByDescending(r => r.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(r => new AdjustmentView(r.ID, r.EmployeeID, r.AttendanceID, r.ProposedCheckIn, r.ProposedCheckOut, r.Reason, r.Status, r.Version,
            db.Set<ApprovalRequest>().Where(a => a.RequestType == "ATTENDANCE_ADJUSTMENT" && a.ReferenceID == r.ID).OrderByDescending(a => a.ID).Select(a => (long?)a.ID).FirstOrDefault())).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, rows);
    }
    private async Task<IQueryable<ApprovalRequest>> ApprovalQuery(string actor, WorkflowQuery q, CancellationToken ct)
    {
        var employees = await Visible(actor, Approvals, q, ct);
        return db.Set<ApprovalRequest>().AsNoTracking().Where(a => employees.Any(e => e.Id == a.EmployeeId));
    }
    private IQueryable<ApprovalView> ApprovalProjection(IQueryable<ApprovalRequest> query) => from a in query join e in db.Employees.AsNoTracking() on a.EmployeeId equals (int?)e.Id
        select new ApprovalView(a.ID, a.RequestType, a.ReferenceID, a.EmployeeId, e.FullName, a.RequestedByUserID, a.Status, a.CreatedAt, a.Version,
            db.Set<ApprovalStep>().Where(s => s.ApprovalRequestID == a.ID && s.Decision == "PENDING").OrderBy(s => s.StepNo).Select(s => (int?)s.StepNo).FirstOrDefault());
    public async Task<PageResult<ApprovalView>> ApprovalList(string actor, WorkflowQuery q, CancellationToken ct)
    {
        var query = await ApprovalQuery(actor, q, ct);
        if (q.Status is not null) query = query.Where(a => a.Status == q.Status);
        if (q.RequestType is not null) query = query.Where(a => a.RequestType == q.RequestType);
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await ApprovalProjection(query.OrderByDescending(a => a.ID).Skip(Paging.Offset(q)).Take(q.PageSize)).ToListAsync(ct));
    }
    public async Task<ApprovalDetail> ApprovalGet(string actor, long id, CancellationToken ct)
    {
        var row = await ApprovalProjection((await ApprovalQuery(actor, new(), ct)).Where(a => a.ID == id)).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
        var steps = await db.Set<ApprovalStep>().AsNoTracking().Where(s => s.ApprovalRequestID == id).OrderBy(s => s.StepNo).Select(s => new ApprovalStepView(s.ID, s.StepNo, s.ApproverUserID, s.Decision, s.Comment, s.DecidedAt, s.ApproverEmployeeId)).ToListAsync(ct);
        object? details = row.RequestType switch
        {
            "LEAVE" or "LEAVE_CANCELLATION" => await LeaveProjection(db.Set<LeaveRequest>().AsNoTracking().Where(r => r.ID == row.ReferenceId && r.EmployeeID == row.EmployeeId)).SingleOrDefaultAsync(ct),
            "OVERTIME" => await OvertimeProjection(db.Set<OvertimeRequest>().AsNoTracking().Where(r => r.ID == row.ReferenceId && r.EmployeeID == row.EmployeeId)).SingleOrDefaultAsync(ct),
            "ATTENDANCE_ADJUSTMENT" => await db.Set<AttendanceAdjustment>().AsNoTracking().SingleOrDefaultAsync(r => r.ID == row.ReferenceId && r.EmployeeID == row.EmployeeId, ct),
            _ => null
        };
        return new(row, steps, details);
    }
    public async Task<PageResult<ApprovalHistoryView>> History(string actor, long id, WorkflowQuery q, CancellationToken ct)
    {
        if (!await (await ApprovalQuery(actor, new(), ct)).AnyAsync(a => a.ID == id, ct)) throw BusinessException.Missing();
        var key = id.ToString(global::System.Globalization.CultureInfo.InvariantCulture);
        var query = db.Set<AuditLog>().AsNoTracking().Where(a => a.EntityType == "ApprovalRequest" && a.EntityID == key);
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await query.OrderBy(a => a.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(a => new ApprovalHistoryView(a.ID, a.ActorUserID, a.Action, a.BeforeJSON, a.AfterJSON, a.CreatedAt)).ToListAsync(ct));
    }
}
