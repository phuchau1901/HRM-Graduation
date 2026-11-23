using HRM.API.Common;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Approvals.Services;
public sealed partial class ApprovalWorkflowService
{
    private async Task<IQueryable<ApprovalRequest>> ApprovalQuery(string actor, ApprovalQuery q, CancellationToken ct)
    {
        var access = await scopes.GetAsync(actor, Approvals, "VIEW", ct);
        var employees = access.Apply(db.Employees.AsNoTracking());
        if (q.View == "MY") employees = employees.Where(e => e.Id == access.EmployeeId);
        if (q.View == "TEAM")
        {
            if (access.Scope == "SELF") throw BusinessException.Scope();
            employees = employees.Where(e => e.DepartmentId == access.DepartmentId);
        }
        if (q.EmployeeId.HasValue) employees = employees.Where(e => e.Id == q.EmployeeId);
        return db.Set<ApprovalRequest>().AsNoTracking().Where(a => employees.Any(e => e.Id == a.EmployeeId));
    }
    private IQueryable<ApprovalView> ApprovalProjection(IQueryable<ApprovalRequest> query) => from a in query join e in db.Employees.AsNoTracking() on a.EmployeeId equals (int?)e.Id
        select new ApprovalView(a.ID, a.RequestType, a.ReferenceID, a.EmployeeId, e.FullName, a.RequestedByUserID, a.Status, a.CreatedAt, a.Version,
            db.Set<ApprovalStep>().Where(s => s.ApprovalRequestID == a.ID && s.Decision == "PENDING").OrderBy(s => s.StepNo).Select(s => (int?)s.StepNo).FirstOrDefault());
    public async Task<PageResult<ApprovalView>> ApprovalList(string actor, ApprovalQuery q, CancellationToken ct)
    {
        var query = await ApprovalQuery(actor, q, ct);
        if (q.Status is not null) query = query.Where(a => a.Status == q.Status);
        if (q.Module is not null)
        {
            var kinds = modules.Where(m => m.Code == q.Module).SelectMany(m => m.RequestTypes).ToArray();
            if (kinds.Length == 0) throw BusinessException.Invalid("Unknown approval module.");
            query = query.Where(a => kinds.Contains(a.RequestType));
        }
        if (q.RequestType is not null) query = query.Where(a => a.RequestType == q.RequestType);
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await ApprovalProjection(query.OrderByDescending(a => a.ID).Skip(Paging.Offset(q)).Take(q.PageSize)).ToListAsync(ct));
    }
    public async Task<ApprovalDetail> ApprovalGet(string actor, long id, CancellationToken ct)
    {
        var row = await ApprovalProjection((await ApprovalQuery(actor, new(), ct)).Where(a => a.ID == id)).SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
        var steps = await db.Set<ApprovalStep>().AsNoTracking().Where(s => s.ApprovalRequestID == id).OrderBy(s => s.StepNo).Select(s => new ApprovalStepView(s.ID, s.StepNo, s.ApproverUserID, s.Decision, s.Comment, s.DecidedAt, s.ApproverEmployeeId)).ToListAsync(ct);
        var module = modules.SingleOrDefault(m => m.RequestTypes.Contains(row.RequestType, StringComparer.Ordinal));
        var entity = await db.Set<ApprovalRequest>().AsNoTracking().SingleAsync(a => a.ID == id, ct);
        if (module != null) await module.AuthorizeReadAsync(entity, actor, ct);
        var details = module == null ? null : await module.GetDetailsAsync(entity, ct);
        return new(row, steps, details);
    }
    public async Task<PageResult<ApprovalHistoryView>> History(string actor, long id, ApprovalQuery q, CancellationToken ct)
    {
        if (!await (await ApprovalQuery(actor, new(), ct)).AnyAsync(a => a.ID == id, ct)) throw BusinessException.Missing();
        var key = id.ToString(global::System.Globalization.CultureInfo.InvariantCulture);
        var query = db.Set<AuditLog>().AsNoTracking().Where(a => a.EntityType == "ApprovalRequest" && a.EntityID == key);
        var total = await query.CountAsync(ct);
        return new(true, total, q.Page, q.PageSize, await query.OrderBy(a => a.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(a => new ApprovalHistoryView(a.ID, a.ActorUserID, a.Action, a.BeforeJSON, a.AfterJSON, a.CreatedAt)).ToListAsync(ct));
    }
}
