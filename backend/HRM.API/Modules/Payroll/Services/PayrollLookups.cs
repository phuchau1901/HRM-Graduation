using HRM.API.Common;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Payroll.Services;
public sealed partial class PayrollService {
 public async Task<object> Lookups(string actor,bool salary,CancellationToken ct) {
  var a=await Access(actor,salary?PayrollScreens.Salary:PayrollScreens.Payroll,"VIEW",ct);var people=a.Apply(db.Employees);
  return new{departments=await db.Departments.Where(d=>people.Any(e=>e.DepartmentId==d.Id)).Select(d=>new{d.Id,name=d.DepartmentName}).ToListAsync(ct),teams=await db.Teams.Where(t=>people.Any(e=>e.TeamId==t.Id)).Select(t=>new{t.Id,name=t.TeamName,t.DepartmentId}).ToListAsync(ct),components=await db.Set<SalaryComponent>().Where(c=>c.IsActive).OrderBy(c=>c.Code).ToListAsync(ct)};
 }
 public async Task<object> TimesheetDetails(string actor,long id,CancellationToken ct) {
  var a=await PayrollAccess(actor,"VIEW",ct);var source=await db.Set<TimesheetPeriod>().AsNoTracking().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();
  var people=a.Apply(db.Employees);var rows=await (from t in db.Set<TimesheetDetail>().AsNoTracking() join e in people on t.EmployeeID equals e.Id where t.PeriodID==id orderby e.EmployeeCode select new{e.EmployeeCode,e.FullName,t.WorkedDays,t.PaidLeaveDays,t.OvertimeHours,t.LateMinutes,t.SnapshotJson}).Take(2001).ToListAsync(ct);
  if(rows.Count>2000)throw BusinessException.Invalid("Too many timesheet details.");return new {source.ID,source.PeriodKey,source.Status,source.Version,data=rows};
 }
 public async Task<object> Adjustments(string actor,long id,CancellationToken ct) {await Period(actor,id,"VIEW",ct);return await db.Set<PayrollAdjustment>().AsNoTracking().Where(x=>x.PayrollPeriodId==id).OrderBy(x=>x.ID).ToListAsync(ct);}
 public Task<PayrollAdjustment> CancelAdjustment(string actor,long id,long adjustmentId,PayrollVersion r,CancellationToken ct)=>Transaction(async()=> {
  var p=await Period(actor,id,"UPDATE",ct);if(p.Status is not ("OPEN" or "REVIEW")||p.ApprovalId!=null)throw BusinessException.Conflict("Period is no longer editable.");
  var row=await db.Set<PayrollAdjustment>().SingleOrDefaultAsync(x=>x.ID==adjustmentId&&x.PayrollPeriodId==id,ct)??throw BusinessException.Missing();Version(row.Version,r.Version);if(row.IsCancelled)throw BusinessException.Conflict("Adjustment already cancelled.");
  row.IsCancelled=true;row.Version++;p.Status="OPEN";p.InputHash=null;p.Version++;Audit(actor,"PayrollAdjustment",row.ID,"PAYROLL_ADJUSTMENT_CANCELLED",new{row.Version});return row;
 },ct);
}
