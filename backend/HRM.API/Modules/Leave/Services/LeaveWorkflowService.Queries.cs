using HRM.API.Modules.Approvals.Entities;
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
}
