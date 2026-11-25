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
    public async Task<object?> GetDetailsAsync(ApprovalRequest approval, CancellationToken ct) {var row=await (
        from r in db.Set<OvertimeRequest>().AsNoTracking() join e in db.Employees.AsNoTracking() on r.EmployeeID equals e.Id
        where r.ID == approval.ReferenceID && r.EmployeeID == approval.EmployeeId
        select new OvertimeView(r.ID, e.Id, e.FullName, r.StartAt, r.EndAt, r.RequestedHours, r.ApprovedHours, r.Reason, r.Status, r.Version, approval.ID)
    ).SingleOrDefaultAsync(ct);
        if(row==null)return null;
        var evidence=await db.Set<HRM.API.Modules.Attendance.Entities.UnscheduledAttendance>().AsNoTracking().Where(x=>x.OvertimeRequestId==approval.ReferenceID&&x.EmployeeID==approval.EmployeeId).OrderBy(x=>x.StartAtUtc).Select(x=>new HRM.API.Modules.Attendance.DTOs.UnscheduledEvidenceView(x.ID,x.StartAtUtc,x.EndAtUtc,x.Status)).ToListAsync(ct);
        return row with {ActualEvidence=evidence};
    }
    public async Task CompleteAsync(ApprovalRequest approval, bool approved, string actor, CancellationToken ct)
    {
        await db.Set<OvertimeRequest>().Where(x=>x.ID==approval.ReferenceID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
        var overtime = await db.Set<OvertimeRequest>().FindAsync([approval.ReferenceID], ct) ?? throw BusinessException.Missing();
        if(approved) {var start=HRM.API.Modules.Payroll.Services.PayrollEngine.LocalDay(overtime.StartAt);var end=HRM.API.Modules.Payroll.Services.PayrollEngine.LocalDay(overtime.EndAt);
            await HRM.API.Modules.Payroll.Services.TimesheetLocks.RequireOpen(db,start,ct);if(start.Month!=end.Month||start.Year!=end.Year)await HRM.API.Modules.Payroll.Services.TimesheetLocks.RequireOpen(db,end,ct);}
        if (overtime.EmployeeID != approval.EmployeeId || overtime.Status != "PENDING") throw BusinessException.Conflict("Overtime is no longer pending.");
        await db.Set<HRM.API.Modules.Attendance.Entities.UnscheduledAttendance>().Where(x=>x.OvertimeRequestId==overtime.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Status,approved?"APPROVED":"REJECTED").SetProperty(x=>x.Version,x=>x.Version+1),ct);
        overtime.Status = approved ? "APPROVED" : "REJECTED"; overtime.ApprovedHours = approved ? overtime.RequestedHours : null; overtime.Version++;
    }
}
