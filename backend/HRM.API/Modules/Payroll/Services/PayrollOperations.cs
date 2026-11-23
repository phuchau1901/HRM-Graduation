using HRM.API.Common;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Performance.Entities;
using HRM.API.Modules.Approvals.DTOs;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.Notifications.DTOs;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Payroll.Services;
public sealed partial class PayrollService
{
    internal static IQueryable<PayrollPeriod> VisiblePeriods(IQueryable<PayrollPeriod> q,EmployeeAccess a)=>a.Scope=="ALL"?q:a.Scope=="DEPARTMENT"&&a.DepartmentId.HasValue?q.Where(p=>p.DepartmentId==a.DepartmentId):q.Where(p=>false);
    private async Task<PayrollPeriod> Period(string actor,long id,string action,CancellationToken ct) {
        var a=await PayrollAccess(actor,action,ct);
        var p=await VisiblePeriods(db.Set<PayrollPeriod>(),a).SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();
        var people=a.Apply(db.Employees);
        if(await db.Set<PayrollDetail>().AnyAsync(x=>x.PayrollPeriodID==id&&!people.Any(e=>e.Id==x.EmployeeID),ct))throw BusinessException.Scope();return p;
    }
    public async Task<object> Periods(string actor,PayrollQuery q,CancellationToken ct) {
        var a=await PayrollAccess(actor,"VIEW",ct);var people=a.Apply(db.Employees);var rows=VisiblePeriods(db.Set<PayrollPeriod>().AsNoTracking(),a);
        if(a.Scope!="ALL")rows=rows.Where(p=>!db.Set<PayrollDetail>().Any(d=>d.PayrollPeriodID==p.ID&&!people.Any(e=>e.Id==d.EmployeeID)));
        if(q.PeriodKey!=null)rows=rows.Where(x=>x.PeriodKey==q.PeriodKey);if(q.Status!=null)rows=rows.Where(x=>x.Status==q.Status);
        if(q.DepartmentId.HasValue)rows=rows.Where(x=>x.DepartmentId==q.DepartmentId);
        var total=await rows.CountAsync(ct);var data=await rows.OrderByDescending(x=>x.PeriodKey).ThenBy(x=>x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        if(a.Scope!="ALL") {
            var issues=data.SelectMany(x=>Read<PayrollIssue[]>(x.ErrorsJson??"[]")).ToArray();var ids=issues.Select(x=>x.EmployeeId).Distinct().ToArray();
            var visible=await people.Where(e=>ids.Contains(e.Id)).Select(e=>e.Id).ToListAsync(ct);
            foreach(var p in data)if(p.ErrorsJson!=null)p.ErrorsJson=Json(Read<PayrollIssue[]>(p.ErrorsJson).Where(x=>x.EmployeeId==0||visible.Contains(x.EmployeeId)));
        }
        return new PageResult<PayrollPeriod>(true,total,q.Page,q.PageSize,data);
    }
    public Task<PayrollPeriod> CreatePeriod(string actor,PayrollCreateRequest r,CancellationToken ct)=>Transaction(async()=> {
        var a=await PayrollAccess(actor,"NEW",ct);Month(r.PeriodKey);
        if(r.DepartmentId.HasValue)a.DemandDepartment(r.DepartmentId.Value);else if(a.Scope!="ALL")throw BusinessException.Scope();
        var source=await db.Set<TimesheetPeriod>().SingleOrDefaultAsync(x=>x.PeriodKey==r.PeriodKey,ct)??throw BusinessException.Conflict("Create and lock the source timesheet first.");
        await db.Set<TimesheetPeriod>().Where(x=>x.ID==source.ID).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
        if(source.Status!="LOCKED"||source.InputHash==null)throw BusinessException.Conflict("Payroll requires a verified LOCKED timesheet.");
        var key=r.DepartmentId.HasValue?$"DEPARTMENT:{r.DepartmentId}":"ALL";
        var existing=await db.Set<PayrollPeriod>().Where(x=>x.PeriodKey==r.PeriodKey).ToListAsync(ct);
        if(existing.Any(x=>x.ScopeKey=="ALL"||key=="ALL"||x.ScopeKey==key))throw BusinessException.Conflict("An overlapping payroll period already exists.");
        if(r.DepartmentId.HasValue&&!await db.Departments.AnyAsync(x=>x.Id==r.DepartmentId,ct))throw BusinessException.Invalid("Department does not exist.");
        var row=new PayrollPeriod {PeriodKey=r.PeriodKey,TimesheetPeriodID=source.ID,ScopeKey=key,DepartmentId=r.DepartmentId,Status="OPEN",CreatedBy=actor};db.Add(row);await db.SaveChangesAsync(ct);
        Audit(actor,"PayrollPeriod",row.ID,"PAYROLL_CREATED",new{row.PeriodKey,row.ScopeKey});return row;
    },ct);
    private sealed record BatchInput(long PolicyId,long PolicyVersion,CalculationInput[] Employees);
    // Date closures outside the month and concurrency-version bumps must not invalidate already approved financial inputs.
    // Preserve original versions/dates in payslip snapshots, but compare only the effective financial segments of this month.
    private static string Fingerprint(BatchInput batch)=>Hash(new{batch.PolicyId,employees=batch.Employees.Select(e=> {
        var (start,end)=Month(e.PeriodKey);
        return new{e.PeriodKey,e.Timesheet,profiles=e.Profiles.Select(p=>new{p.ProfileId,from=p.EffectiveFrom<start?start:p.EffectiveFrom,to=!p.EffectiveTo.HasValue||p.EffectiveTo>end?end:p.EffectiveTo.Value,
            p.PayBasis,p.BaseSalary,p.AllowanceAmount,p.InsuranceBase,p.Dependents,p.KpiBonusAmount,p.CurrencyCode,p.Items}),e.Adjustments,e.Rules,e.Kpi};
    })});
    private async Task<BatchInput> Inputs(PayrollPeriod p,long? policyId,CancellationToken ct) {
        var (start,end)=Month(p.PeriodKey);
        var source=await db.Set<TimesheetPeriod>().AsNoTracking().SingleAsync(x=>x.ID==p.TimesheetPeriodID,ct);
        if(source.Status!="LOCKED"||source.InputHash==null)throw BusinessException.Conflict("Source timesheet is not locked and verified.");
        var policies=await db.Set<PayrollPolicy>().AsNoTracking().Where(x=>x.Status=="PUBLISHED"&&x.EffectiveFrom<=start&&(x.EffectiveTo==null||x.EffectiveTo>=end)&&(!policyId.HasValue||x.ID==policyId)).ToListAsync(ct);
        if(policies.Count!=1)throw BusinessException.Invalid("Select exactly one published policy covering the complete payroll month.");
        var policy=policies[0];var rules=Read<PayrollRules>(policy.RulesJson);PayrollEngine.Validate(rules);
        var people=db.Employees.AsNoTracking();if(p.DepartmentId.HasValue)people=people.Where(x=>x.DepartmentId==p.DepartmentId);
        var sources=await (from d in db.Set<TimesheetDetail>().AsNoTracking() join e in people on d.EmployeeID equals e.Id where d.PeriodID==p.TimesheetPeriodID orderby d.EmployeeID select d).ToListAsync(ct);
        if(sources.Count==0)throw BusinessException.Invalid("No employee timesheets in this payroll scope.");
        var ids=sources.Select(x=>x.EmployeeID).ToArray();
        var profiles=await db.Set<SalaryProfile>().AsNoTracking().Where(x=>ids.Contains(x.EmployeeID)&&x.EffectiveFrom<=end&&(x.EffectiveTo==null||x.EffectiveTo>=start)).OrderBy(x=>x.EmployeeID).ThenBy(x=>x.EffectiveFrom).ToListAsync(ct);
        if(profiles.Any(x=>!x.IsVerified))throw BusinessException.Conflict("Legacy salary profiles require verified replacement before payroll.");
        var adjustments=await db.Set<PayrollAdjustment>().AsNoTracking().Where(x=>x.PayrollPeriodId==p.ID&&!x.IsCancelled).OrderBy(x=>x.ID).ToListAsync(ct);
        var kpiKey=PayrollEngine.KpiPeriod(p.PeriodKey,rules.KpiPeriodType).Key;
        var kpis=await db.Set<KpiTarget>().AsNoTracking().Where(x=>ids.Contains(x.EmployeeID)&&x.PeriodKey==kpiKey&&x.Status=="APPROVED").OrderBy(x=>x.ID).ToListAsync(ct);
        var inputs=sources.Select(s=>new CalculationInput(p.PeriodKey,Read<TimesheetSnapshot>(s.SnapshotJson),profiles.Where(x=>x.EmployeeID==s.EmployeeID).Select(x=>new SalarySlice(x.ID,x.EffectiveFrom,x.EffectiveTo,x.PayBasis??"",x.BaseSalary,x.AllowanceAmount,x.InsuranceBase,x.Dependents,x.KpiBonusAmount,x.CurrencyCode,Read<CompensationItem[]>(x.ItemsJson),x.Version)).ToArray(),
            adjustments.Where(x=>x.EmployeeId==s.EmployeeID).Select(x=>Read<CompensationItem>(x.ComponentSnapshotJson)).ToArray(),rules,
            kpis.Where(x=>x.EmployeeID==s.EmployeeID).Select(x=>new KpiPayInput(x.ID,x.PeriodKey,x.Status,x.FinalScore,x.Version)).SingleOrDefault())).ToArray();
        return new(policy.ID,policy.Version,inputs);
    }
    public Task<PayrollReceipt> Calculate(string actor,long id,PayrollCalculationRequest r,CancellationToken ct)=>Transaction<PayrollReceipt>(async()=> {
        var p=await Period(actor,id,"UPDATE",ct);await db.Set<PayrollPeriod>().Where(x=>x.ID==id).ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
        if(p.LastCalculationKey==r.RequestKey&&r.PolicyId.HasValue&&r.PolicyId!=p.PolicyId)throw BusinessException.Conflict("Request key was used with another policy.");
        if(p.LastCalculationKey==r.RequestKey)return new(Read<PayrollIssue[]>(p.ErrorsJson??"[]").Length==0,id,p.Status,p.Version,await db.Set<PayrollDetail>().CountAsync(x=>x.PayrollPeriodID==id,ct),Read<PayrollIssue[]>(p.ErrorsJson??"[]").Length);
        Version(p.Version,r.Version);if(p.Status is not ("OPEN" or "REVIEW")||p.ApprovalId!=null)throw BusinessException.Conflict("Payroll cannot be recalculated in its current state.");
        p.Status="CALCULATING";var issues=new List<PayrollIssue>();var rows=new List<PayrollDetail>();BatchInput? batch=null;
        try {batch=await Inputs(p,r.PolicyId,ct);
            foreach(var input in batch.Employees)try {
                var result=PayrollEngine.Calculate(input);rows.Add(new PayrollDetail {PayrollPeriodID=id,EmployeeID=input.Timesheet.EmployeeId,UniqueKey=$"{id}:{input.Timesheet.EmployeeId}",EmployeePeriodKey=$"{p.PeriodKey}:{input.Timesheet.EmployeeId}",
                    BaseSalary=result.BaseSalary,Allowances=result.Allowances,OvertimePay=result.OvertimePay,KPIBonus=result.KpiBonus,GrossSalary=result.Gross,Deductions=result.Deductions,NetSalary=result.Net,TaxAmount=result.Tax,InsuranceAmount=result.Insurance,EmployerInsurance=result.EmployerInsurance,CalculationSnapshot=Json(new{input,result})});
            }catch(BusinessException e){issues.Add(new(input.Timesheet.EmployeeId,"CALCULATION_INVALID",e.Message));}
        }catch(BusinessException e){issues.Add(new(0,"SOURCE_INVALID",e.Message));}
        await db.Set<PayrollDetail>().Where(x=>x.PayrollPeriodID==id).ExecuteDeleteAsync(ct);
        if(issues.Count==0)db.AddRange(rows);
        p.PolicyId=batch?.PolicyId;p.InputHash=issues.Count==0?Fingerprint(batch!):null;p.Status=issues.Count==0?"REVIEW":"OPEN";p.ErrorsJson=Json(issues);p.LastCalculationKey=r.RequestKey;p.CalculatedBy=actor;p.Version++;
        Audit(actor,"PayrollPeriod",id,"PAYROLL_CALCULATED",new{p.Status,p.Version,p.InputHash});return new(issues.Count==0,id,p.Status,p.Version,issues.Count==0?rows.Count:0,issues.Count);
    },ct);
    private async Task Unchanged(PayrollPeriod p,CancellationToken ct) {
        if(p.InputHash==null||p.PolicyId==null||Read<PayrollIssue[]>(p.ErrorsJson??"[]").Length!=0||p.InputHash!=Fingerprint(await Inputs(p,p.PolicyId,ct)))throw BusinessException.Conflict("Payroll inputs changed or contain errors; recalculate before continuing.");
    }
    public Task<PayrollPeriod> Submit(string actor,long id,PayrollVersion r,CancellationToken ct)=>Transaction(async()=> {
        var p=await Period(actor,id,"UPDATE",ct);Version(p.Version,r.Version);if(p.Status!="REVIEW"||p.ApprovalId!=null)throw BusinessException.Conflict("Payroll is not ready to submit.");await Unchanged(p,ct);
        var configuration=await db.Set<SystemSetting>().Where(x=>x.Key==ApprovalWorkflowService.SettingsKey).Select(x=>x.JsonValue).SingleOrDefaultAsync(ct);
        var routes=configuration==null?null:Read<WorkflowRoute[]>(configuration);
        var route=routes?.SingleOrDefault(x=>x.RequestType=="PAYROLL_PERIOD");
        if(route==null||route.AllowSelfApproval||route.Steps.Any(s=>s.ApproverType=="TEAM_LEAD"||!p.DepartmentId.HasValue&&s.ApproverType=="DEPARTMENT_MANAGER"))throw BusinessException.Conflict("Configure a PAYROLL_PERIOD route without self approval; global payroll requires USER/HR approvers.");
        var first=await db.Set<PayrollDetail>().Where(x=>x.PayrollPeriodID==id).OrderBy(x=>x.EmployeeID).Select(x=>x.EmployeeID).FirstAsync(ct);
        var approval=await workflows.StartAsync(actor,await db.Employees.SingleAsync(x=>x.Id==first,ct),"PAYROLL_PERIOD",id,ct);p.ApprovalId=approval.ID;p.Version++;
        Audit(actor,"PayrollPeriod",id,"PAYROLL_SUBMITTED",new{p.ApprovalId,p.Version});return p;
    },ct);
    public Task<PayrollPeriod> Lock(string actor,long id,PayrollVersion r,CancellationToken ct)=>Transaction(async()=> {
        var p=await Period(actor,id,"APPROVE",ct);Version(p.Version,r.Version);if(p.Status!="APPROVED")throw BusinessException.Conflict("Only approved payroll can be locked.");await Unchanged(p,ct);
        p.Status="LOCKED";p.LockedAt=Now;p.PublishedAt=Now;p.Version++;Audit(actor,"PayrollPeriod",id,"PAYROLL_LOCKED",new{p.Version,p.InputHash});
        var employees=db.Set<PayrollDetail>().Where(x=>x.PayrollPeriodID==id).Select(x=>x.EmployeeID);
        var users=await db.Set<User>().Where(x=>x.Status=="ACTIVE"&&x.EmployeeId!=null&&employees.Contains(x.EmployeeId.Value)).Select(x=>x.UserId).ToArrayAsync(ct);
        foreach(var group in users.Chunk(500))await notifications.CreateInternalAsync(new CreateNotificationRequest {Title="Phiếu lương đã phát hành",Content=$"Bạn có thể xem phiếu lương kỳ {p.PeriodKey}.",ReferenceType="PAYROLL",ReferenceId=id.ToString(),Targets=[new(){Type="USERS",UserIds=group}]},"SYSTEM",$"payroll:{id}:published:{Array.IndexOf(users,group[0])}","",ct);
        return p;
    },ct);
    public Task<PayrollPeriod> Paid(string actor,long id,PayrollPaymentRequest r,CancellationToken ct)=>Transaction(async()=> {
        var p=await Period(actor,id,"APPROVE",ct);Version(p.Version,r.Version);
        if(p.Status!="LOCKED"||!p.LockedAt.HasValue||p.InputHash==null||p.PolicyId==null||r.PaidAt.UtcDateTime<p.LockedAt||r.PaidAt.UtcDateTime>Now||string.IsNullOrWhiteSpace(r.Reference))throw BusinessException.Invalid("Payment requires locked payroll, a confirmation reference and a valid payment timestamp.");
        p.Status="PAID";p.PaidAt=r.PaidAt.UtcDateTime;p.PaymentReference=r.Reference.Trim();p.PaidBy=actor;p.Version++;Audit(actor,"PayrollPeriod",id,"PAYROLL_PAYMENT_CONFIRMED",new{p.Version,p.PaidAt,confirmationRecorded=true});return p;
    },ct);
    public Task<PayrollAdjustment> Adjustment(string actor,long id,PayrollAdjustmentRequest r,CancellationToken ct)=>Transaction(async()=> {
        var p=await Period(actor,id,"UPDATE",ct);if(p.Status is not ("OPEN" or "REVIEW")||p.ApprovalId!=null)throw BusinessException.Conflict("Adjustments require an open, unsubmitted payroll.");
        var existing=await db.Set<PayrollAdjustment>().SingleOrDefaultAsync(x=>x.RequestKey==r.RequestKey,ct);
        if(existing!=null){if(existing.PayrollPeriodId!=id||existing.EmployeeId!=r.EmployeeId||existing.ComponentId!=r.ComponentId||existing.Amount!=r.Amount||existing.Reason!=r.Reason.Trim())throw BusinessException.Conflict("Request key belongs to a different adjustment.");return existing;}
        PayrollEngine.Money(r.Amount);if(r.Amount<=0)throw BusinessException.Invalid("Adjustment amount must be positive.");
        var access=await PayrollAccess(actor,"UPDATE",ct);var people=access.Apply(db.Employees);
        if(!await people.AnyAsync(x=>x.Id==r.EmployeeId&&(!p.DepartmentId.HasValue||x.DepartmentId==p.DepartmentId),ct)||!await db.Set<TimesheetDetail>().AnyAsync(x=>x.PeriodID==p.TimesheetPeriodID&&x.EmployeeID==r.EmployeeId,ct))throw BusinessException.Missing();
        var c=await db.Set<SalaryComponent>().SingleOrDefaultAsync(x=>x.ID==r.ComponentId&&x.IsActive,ct)??throw BusinessException.Invalid("Component is missing or inactive.");
        var row=new PayrollAdjustment {PayrollPeriodId=id,EmployeeId=r.EmployeeId,ComponentId=c.ID,Amount=r.Amount,Reason=r.Reason.Trim(),RequestKey=r.RequestKey,CreatedBy=actor,CreatedAt=Now,
            ComponentSnapshotJson=Json(new CompensationItem(c.ID,c.Code,c.Name,c.Kind,r.Amount,false,c.Taxable,c.TaxDeductible,c.OvertimeIncluded))};db.Add(row);p.Status="OPEN";p.InputHash=null;p.Version++;
        await db.SaveChangesAsync(ct);Audit(actor,"PayrollAdjustment",row.ID,"PAYROLL_ADJUSTMENT_CREATED",new{row.EmployeeId,row.PayrollPeriodId,reasonRecorded=true});return row;
    },ct);
    private async Task<IQueryable<PayrollRow>> Rows(string actor,PayrollQuery q,bool mine,string action,CancellationToken ct) {
        var people=db.Employees.AsNoTracking();if(mine){var employee=await MyEmployee(actor,action,ct);people=people.Where(x=>x.Id==employee);}else people=(await Access(actor,PayrollScreens.Payroll,action,ct)).Apply(people);
        if(q.EmployeeId.HasValue)people=people.Where(x=>x.Id==q.EmployeeId);if(q.DepartmentId.HasValue)people=people.Where(x=>x.DepartmentId==q.DepartmentId);if(q.TeamId.HasValue)people=people.Where(x=>x.TeamId==q.TeamId);
        if(!string.IsNullOrWhiteSpace(q.Search))people=people.Where(x=>x.EmployeeCode.Contains(q.Search)||x.FullName.Contains(q.Search));
        var rows=from d in db.Set<PayrollDetail>().AsNoTracking() join p in db.Set<PayrollPeriod>() on d.PayrollPeriodID equals p.ID join e in people on d.EmployeeID equals e.Id
            join department in db.Departments on e.DepartmentId equals department.Id
            join team in db.Teams on e.TeamId equals team.Id into teams from team in teams.DefaultIfEmpty()
            where p.PolicyId!=null&&p.InputHash!=null&&d.UniqueKey!=null&&d.EmployeePeriodKey!=null&&(!mine||p.Status=="LOCKED"||p.Status=="PAID")&&(q.PeriodKey==null||p.PeriodKey==q.PeriodKey)&&(q.Status==null||p.Status==q.Status)
            select new PayrollRow {PolicyId=p.PolicyId,Id=d.ID,PayrollPeriodId=p.ID,PeriodKey=p.PeriodKey,EmployeeId=e.Id,EmployeeCode=e.EmployeeCode,EmployeeName=e.FullName,DepartmentName=department.DepartmentName,TeamName=team==null?null:team.TeamName,Status=p.Status,Gross=d.GrossSalary,Deductions=d.Deductions,Net=d.NetSalary};return rows;
    }
    private async Task<Dictionary<long,string>> Currencies(IEnumerable<long?> ids,CancellationToken ct) {
        var keys=ids.Where(x=>x.HasValue).Select(x=>x!.Value).Distinct().ToArray();
        var policies=await db.Set<PayrollPolicy>().AsNoTracking().Where(x=>keys.Contains(x.ID)).Select(x=>new{x.ID,x.RulesJson}).ToListAsync(ct);
        return policies.ToDictionary(x=>x.ID,x=>Read<PayrollRules>(x.RulesJson).CurrencyCode);
    }
    public async Task<object> Payslips(string actor,PayrollQuery q,bool mine,CancellationToken ct) {
        var rows=await Rows(actor,q,mine,"VIEW",ct);var total=await rows.CountAsync(ct);
        var data=await rows.OrderByDescending(x=>x.PeriodKey).ThenBy(x=>x.EmployeeCode).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        var currencies=await Currencies(data.Select(x=>x.PolicyId),ct);foreach(var x in data)x.CurrencyCode=x.PolicyId.HasValue?currencies.GetValueOrDefault(x.PolicyId.Value,""):"";
        return new PageResult<PayrollRow>(true,total,q.Page,q.PageSize,data);
    }
    private sealed record PayrollTotal(long? policyId,int employees,decimal gross,decimal deductions,decimal net);
    public async Task<object> Statistics(string actor,PayrollQuery q,CancellationToken ct) {
        var rows=await Rows(actor,q,false,"VIEW",ct);
        // SQLite 8 has no decimal SUM translator. Relational tests aggregate exact integer cents;
        // production MySQL always uses native decimal SUM (no float conversion or materialized payroll rows).
        var totals=db.Database.ProviderName=="Microsoft.EntityFrameworkCore.Sqlite"
            ?await rows.GroupBy(x=>x.PolicyId).Select(g=>new PayrollTotal(g.Key,g.Count(),g.Sum(x=>(long)(x.Gross*100m))/100m,g.Sum(x=>(long)(x.Deductions*100m))/100m,g.Sum(x=>(long)(x.Net*100m))/100m)).ToListAsync(ct)
            :await rows.GroupBy(x=>x.PolicyId).Select(g=>new PayrollTotal(g.Key,g.Count(),g.Sum(x=>x.Gross),g.Sum(x=>x.Deductions),g.Sum(x=>x.Net))).ToListAsync(ct);
        var currencies=await Currencies(totals.Select(x=>x.policyId),ct);
        if(totals.Any(x=>!x.policyId.HasValue||!currencies.ContainsKey(x.policyId.Value)))throw BusinessException.Conflict("Legacy payroll has no verified currency; reconcile before aggregating.");
        var codes=totals.Select(x=>currencies[x.policyId!.Value]).Distinct().ToArray();
        if(codes.Length>1)throw BusinessException.Invalid("Payroll totals contain multiple currencies; narrow the period/department/employee filters before aggregating.");
        return new{employees=totals.Sum(x=>x.employees),gross=totals.Sum(x=>x.gross),deductions=totals.Sum(x=>x.deductions),net=totals.Sum(x=>x.net),currencyCode=codes.SingleOrDefault()};
    }
    public async Task<object> Detail(string actor,long id,bool mine,CancellationToken ct) {
        var row=await (await Rows(actor,new(),mine,"VIEW",ct)).SingleOrDefaultAsync(x=>x.Id==id,ct)??throw BusinessException.Missing();
        var detail=await db.Set<PayrollDetail>().AsNoTracking().SingleAsync(x=>x.ID==id,ct);
        var currencies=await Currencies([row.PolicyId],ct);row.CurrencyCode=row.PolicyId.HasValue?currencies.GetValueOrDefault(row.PolicyId.Value,""):"";
        // Personal payslips expose calculated lines only, not confidential profile/policy inputs or HR adjustment reasons.
        using var snapshot=global::System.Text.Json.JsonDocument.Parse(detail.CalculationSnapshot);
        var result=snapshot.RootElement.GetProperty("result").Clone();
        return new{row,result,snapshot=mine?null:(object)Read<global::System.Text.Json.JsonElement>(detail.CalculationSnapshot)};
    }
    public async Task<byte[]> Export(string actor,PayrollQuery q,CancellationToken ct) {
        var rows=await (await Rows(actor,q,false,"EXPORT",ct)).OrderBy(x=>x.EmployeeCode).Take(10001).ToListAsync(ct);if(rows.Count>10000)throw BusinessException.Invalid("Narrow export to at most 10000 rows.");
        var currencies=await Currencies(rows.Select(x=>x.PolicyId),ct);
        return SpreadsheetWorkbook.Create("Payroll",["Kỳ","Mã nhân viên","Họ tên","Phòng ban","Thu nhập","Khấu trừ","Thực lĩnh","Trạng thái","Tiền tệ"],rows.Select(x=>new[]{x.PeriodKey,x.EmployeeCode,x.EmployeeName,x.DepartmentName,x.Gross.ToString(global::System.Globalization.CultureInfo.InvariantCulture),x.Deductions.ToString(global::System.Globalization.CultureInfo.InvariantCulture),x.Net.ToString(global::System.Globalization.CultureInfo.InvariantCulture),x.Status,x.PolicyId.HasValue?currencies.GetValueOrDefault(x.PolicyId.Value,""):""}).ToArray(),new HashSet<int>{4,5,6});
    }
}
