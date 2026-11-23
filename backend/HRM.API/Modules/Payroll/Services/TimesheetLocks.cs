using System.Globalization;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Payroll.Services;
public static class TimesheetLocks
{
    public static async Task RequireOpen(AppDbContext db, DateOnly date, CancellationToken ct)
    {
        var key=date.ToString("yyyy-MM",CultureInfo.InvariantCulture);
        if(db.Database.CurrentTransaction!=null)await db.Set<TimesheetPeriod>().Where(p=>p.PeriodKey==key).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.ClosedAt,x=>x.ClosedAt),ct);
        if(await db.Set<TimesheetPeriod>().AnyAsync(p=>p.PeriodKey==key && (p.ClosedAt!=null || p.Status!="OPEN" && p.Status!="DRAFT"),ct))
            throw BusinessException.Conflict("Timesheet period is locked; attendance cannot be changed.");
    }
}
