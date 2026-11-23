using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Approvals.Entities;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Leave.DTOs;
using HRM.API.Modules.Leave.Entities;
using HRM.API.Modules.Leave.Services;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Approvals.Modules.Leave;
public sealed class LeaveApprovalModule(AppDbContext db, LeaveBalanceAccounting accounting, TimeProvider clock) : IApprovalModule
{
    public string Code => "LEAVE";
    public IReadOnlyCollection<string> RequestTypes => ["LEAVE", "LEAVE_CANCELLATION"];
    public string? WorkflowFallback(string requestType) => requestType == "LEAVE_CANCELLATION" ? "LEAVE" : null;
    public async Task<object?> GetDetailsAsync(ApprovalRequest approval, CancellationToken ct) => await (
        from r in db.Set<LeaveRequest>().AsNoTracking()
        join e in db.Employees.AsNoTracking() on r.EmployeeID equals e.Id
        join t in db.Set<LeaveType>() on r.LeaveTypeID equals t.ID
        where r.ID == approval.ReferenceID && r.EmployeeID == approval.EmployeeId
        select new LeaveView(r.ID, e.Id, e.FullName, t.ID, t.Name, r.FromDate, r.ToDate, r.RequestedDays, r.Reason, r.Status, r.Version,
            db.Set<ApprovalRequest>().Where(a => a.RequestType == "LEAVE" && a.ReferenceID == r.ID).OrderByDescending(a => a.ID).Select(a => (long?)a.ID).FirstOrDefault())
    ).SingleOrDefaultAsync(ct);
    public async Task CompleteAsync(ApprovalRequest approval, bool approved, string actor, CancellationToken ct)
    {
        var leave = await db.Set<LeaveRequest>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
        if(approved) {var month=new DateOnly(leave.FromDate.Year,leave.FromDate.Month,1);while(month<=leave.ToDate) {await HRM.API.Modules.Payroll.Services.TimesheetLocks.RequireOpen(db,month,ct);month=month.AddMonths(1);}}
        if (leave.EmployeeID != approval.EmployeeId) throw BusinessException.Conflict("Leave approval linkage mismatch.");
        if (approval.RequestType == "LEAVE")
        {
            if (leave.Status != "PENDING") throw BusinessException.Conflict("Leave is no longer pending.");
            await accounting.ApplyAsync(leave, approved ? "USE" : "RELEASE", actor, ct); leave.Status = approved ? "APPROVED" : "REJECTED";
        }
        else
        {
            if (approval.RequestType != "LEAVE_CANCELLATION" || leave.Status != "CANCELLATION_PENDING") throw BusinessException.Conflict("Leave cancellation is no longer pending.");
            if (approved)
            {
                if (leave.FromDate <= VietnamBusinessDate.Today(clock)) throw BusinessException.Conflict("Leave has started; cancellation requires a separate historical correction procedure.");
                await accounting.ApplyAsync(leave, "REFUND", actor, ct);
            }
            leave.Status = approved ? "CANCELLED" : "APPROVED";
        }
        leave.Version++;
    }
}
