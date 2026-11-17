using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Approvals.Modules.Overtime;
public sealed class OvertimeApprovalModule(AppDbContext db) : IApprovalModule
{
    public string Code => "OVERTIME";
    public IReadOnlyCollection<string> RequestTypes => ["OVERTIME"];
    public async Task<object?> GetDetailsAsync(ApprovalRequest approval, CancellationToken ct) => await (
        from r in db.Set<OvertimeRequest>().AsNoTracking() join e in db.Employees.AsNoTracking() on r.EmployeeID equals e.Id
        where r.ID == approval.ReferenceID && r.EmployeeID == approval.EmployeeId
        select new OvertimeView(r.ID, e.Id, e.FullName, r.StartAt, r.EndAt, r.RequestedHours, r.ApprovedHours, r.Reason, r.Status, r.Version, approval.ID)
    ).SingleOrDefaultAsync(ct);
    public async Task CompleteAsync(ApprovalRequest approval, bool approved, string actor, CancellationToken ct)
    {
        var overtime = await db.Set<OvertimeRequest>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
        if (overtime.EmployeeID != approval.EmployeeId || overtime.Status != "PENDING") throw BusinessException.Conflict("Overtime is no longer pending.");
        overtime.Status = approved ? "APPROVED" : "REJECTED"; overtime.ApprovedHours = approved ? overtime.RequestedHours : null; overtime.Version++;
    }
}
