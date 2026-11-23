using System.Data;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Authorization.Services;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Employees.Services;
using HRM.API.Modules.Payroll.DTOs;
using HRM.API.Modules.Payroll.Entities;
using HRM.API.Modules.System.Entities;
using HRM.API.Modules.System.Services;
using HRM.API.Modules.Approvals.Services;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.Notifications.DTOs;
using Microsoft.EntityFrameworkCore;
using MySqlConnector;
namespace HRM.API.Modules.Payroll.Services;
public sealed partial class PayrollService(AppDbContext db,EmployeeDataScope scopes,IPermissionService permissions,TimeProvider clock,
    SystemSettingsService settings,ApprovalWorkflowService workflows,NotificationService notifications)
{
    internal static readonly JsonSerializerOptions JsonOptions=new(JsonSerializerDefaults.Web);
    internal static string Json(object value)=>JsonSerializer.Serialize(value,JsonOptions);
    internal static T Read<T>(string? value) {
        if(string.IsNullOrWhiteSpace(value))throw BusinessException.Conflict("Legacy payroll/timesheet data has no verified snapshot; reconcile it before use.");
        try {return JsonSerializer.Deserialize<T>(value,JsonOptions)??throw BusinessException.Conflict("Invalid payroll snapshot.");}
        catch(JsonException){throw BusinessException.Conflict("Invalid stored payroll snapshot; reconcile before use.");}
    }
    internal static string Hash(object value)=>Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(Json(value))));
    private DateTime Now=>clock.GetUtcNow().UtcDateTime;
    internal static (DateOnly Start,DateOnly End) Month(string key)
    {
        if(!DateOnly.TryParseExact(key+"-01","yyyy-MM-dd",CultureInfo.InvariantCulture,DateTimeStyles.None,out var date) || date.Year is <2000 or >2100)throw BusinessException.Invalid("Invalid payroll month (2000..2100).");
        return(date,date.AddMonths(1).AddDays(-1));
    }
    private async Task<EmployeeAccess> Access(string actor,string screen,string action,CancellationToken ct)
    {
        if(!await permissions.HasPermissionAsync(actor,screen,action,ct))throw BusinessException.Scope();
        return await scopes.GetAsync(actor,screen,action,ct);
    }
    private async Task<EmployeeAccess> SalaryAccess(string actor,string action,CancellationToken ct,bool global=false)
    {
        var a=await Access(actor,PayrollScreens.Salary,action,ct);
        if(action!="VIEW") {a.DemandWrite();if(global && a.Scope!="ALL")throw BusinessException.Scope();}
        return a;
    }
    private async Task<EmployeeAccess> PayrollAccess(string actor,string action,CancellationToken ct)
    {
        var a=await Access(actor,PayrollScreens.Payroll,action,ct);if(action is not ("VIEW" or "EXPORT"))a.DemandWrite();return a;
    }
    private async Task<int> MyEmployee(string actor,string action,CancellationToken ct)
    {
        if(!await permissions.HasPermissionAsync(actor,PayrollScreens.Mine,action,ct))throw BusinessException.Scope();
        return await db.Set<User>().Where(u=>u.UserId==actor && u.Status=="ACTIVE" && u.EmployeeId!=null).Select(u=>u.EmployeeId).SingleOrDefaultAsync(ct)
            ??throw new BusinessException(403,"HRM_AUTH_006","An employee link is required.","EMPLOYEE_LINK_REQUIRED");
    }
    private async Task<T> Transaction<T>(Func<Task<T>> work,CancellationToken ct)
    {
        await using var tx=await db.Database.BeginTransactionAsync(IsolationLevel.Serializable,ct);
        try {var result=await work();await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return result;}
        catch(DbUpdateConcurrencyException) {throw BusinessException.Conflict("Payroll changed; reload before retrying.");}
        catch(Exception e) when(Concurrent(e)) {throw BusinessException.Conflict("Concurrent payroll operation; reload and retry using the same request key.");}
    }
    private static bool Concurrent(Exception e)=>e is MySqlException {Number:1062 or 1205 or 1213} || e.InnerException!=null && Concurrent(e.InnerException);
    private static void Version(long actual,long expected) {if(actual!=expected)throw BusinessException.Conflict("Version changed; reload before updating.");}
    // Audit metadata only: generic audit readers must never acquire salary values or reasons.
    private void Audit(string actor,string entity,long id,string action,object? value)=>db.Add(new AuditLog {
        ActorUserID=actor,EntityType=entity,EntityID=id.ToString(CultureInfo.InvariantCulture),Action=action,AfterJSON=value==null?null:Json(value),CreatedAt=Now });
    private async Task CatalogLock(CancellationToken ct)=>_ = await db.Set<SystemSetting>().Where(s=>s.Key==SettingsDefaults.PasswordKey)
        .ExecuteUpdateAsync(s=>s.SetProperty(x=>x.Version,x=>x.Version),ct);
    private static bool Overlap(DateOnly from,DateOnly? to,DateOnly otherFrom,DateOnly? otherTo)=>from<=(otherTo??DateOnly.MaxValue) && otherFrom<=(to??DateOnly.MaxValue);
    private static void Dates(DateOnly from,DateOnly? to)
    {if(from.Year is <2000 or >2100 || to.HasValue && (to<from || to.Value.Year>2100))throw BusinessException.Invalid("Invalid effective date range.");}
    private async Task GuardSalaryDates(int employee,DateOnly from,DateOnly? to,CancellationToken ct)
    {
        var keys=await (from d in db.Set<PayrollDetail>() join p in db.Set<PayrollPeriod>() on d.PayrollPeriodID equals p.ID
            where d.EmployeeID==employee && (p.Status=="LOCKED" || p.Status=="PAID" || p.Status=="APPROVED" || p.ApprovalId!=null)
            select p.PeriodKey).Distinct().ToListAsync(ct);
        if(keys.Any(key=>Overlap(from,to,Month(key).Start,Month(key).End)))throw BusinessException.Conflict("Salary dates touch a submitted, approved or locked payroll; use an authorized adjustment in a later open period.");
    }
    public async Task<object> Employees(string actor,PageQuery q,CancellationToken ct,bool salary)
    {
        var a=await Access(actor,salary?PayrollScreens.Salary:PayrollScreens.Payroll,"VIEW",ct);var rows=a.Apply(db.Employees).AsNoTracking();
        if(!string.IsNullOrWhiteSpace(q.Search))rows=rows.Where(x=>x.FullName.Contains(q.Search)||x.EmployeeCode.Contains(q.Search));
        return new {success=true,total=await rows.CountAsync(ct),page=q.Page,pageSize=q.PageSize,data=await rows.OrderBy(x=>x.EmployeeCode).Skip(Paging.Offset(q)).Take(q.PageSize)
            .Select(x=>new{x.Id,x.EmployeeCode,x.FullName,x.DepartmentId,x.TeamId}).ToListAsync(ct)};
    }
    public async Task<object> Components(string actor,PageQuery q,CancellationToken ct)
    {
        await SalaryAccess(actor,"VIEW",ct);var rows=db.Set<SalaryComponent>().AsNoTracking();
        if(!string.IsNullOrWhiteSpace(q.Search))rows=rows.Where(x=>x.Code.Contains(q.Search)||x.Name.Contains(q.Search));
        return new PageResult<SalaryComponent>(true,await rows.CountAsync(ct),q.Page,q.PageSize,await rows.OrderBy(x=>x.Code).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct));
    }
    public Task<SalaryComponent> SaveComponent(string actor,long? id,SalaryComponentRequest r,CancellationToken ct)=>Transaction(async()=> {
        await SalaryAccess(actor,id.HasValue?"UPDATE":"NEW",ct,true);await CatalogLock(ct);
        if(new[]{"BASE","ALLOWANCE","NIGHT","OVERTIME","KPI","TAX"}.Contains(r.Code)||r.Code.StartsWith("INS_",StringComparison.Ordinal))throw BusinessException.Invalid("Component code is reserved for payroll calculations.");
        if(r.Kind!="EARNING" && (r.Taxable || r.OvertimeIncluded) || r.Kind=="EARNING" && r.TaxDeductible)throw BusinessException.Invalid("Invalid tax/overtime flags for component kind.");
        var row=id.HasValue?await db.Set<SalaryComponent>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing():new SalaryComponent();
        if(id.HasValue) {Version(row.Version,r.Version);if(row.Code!=r.Code || row.Kind!=r.Kind)throw BusinessException.Conflict("Component code/kind is immutable; create another component.");row.Version++;}
        if(await db.Set<SalaryComponent>().AnyAsync(x=>x.ID!=(id??0) && x.Code==r.Code,ct))throw BusinessException.Conflict("Component code already exists.");
        row.Code=r.Code;row.Name=r.Name.Trim();row.Kind=r.Kind;row.Taxable=r.Taxable;row.TaxDeductible=r.TaxDeductible;row.OvertimeIncluded=r.OvertimeIncluded;row.IsActive=r.IsActive;
        if(!id.HasValue)db.Add(row);await db.SaveChangesAsync(ct);Audit(actor,"SalaryComponent",row.ID,"SALARY_COMPONENT_SAVED",new{row.Code,row.Version,row.IsActive});return row;
    },ct);
    public async Task<object> Profiles(string actor,PayrollQuery q,CancellationToken ct)
    {
        var a=await SalaryAccess(actor,"VIEW",ct);var people=a.Apply(db.Employees);if(q.EmployeeId.HasValue)people=people.Where(x=>x.Id==q.EmployeeId);
        if(q.DepartmentId.HasValue)people=people.Where(x=>x.DepartmentId==q.DepartmentId);if(q.TeamId.HasValue)people=people.Where(x=>x.TeamId==q.TeamId);
        if(!string.IsNullOrWhiteSpace(q.Search))people=people.Where(x=>x.EmployeeCode.Contains(q.Search)||x.FullName.Contains(q.Search));
        var rows=from p in db.Set<SalaryProfile>().AsNoTracking() join e in people on p.EmployeeID equals e.Id
            select new {profile=p,employeeCode=e.EmployeeCode,employeeName=e.FullName};
        return new{success=true,total=await rows.CountAsync(ct),page=q.Page,pageSize=q.PageSize,data=await rows.OrderBy(x=>x.profile.EmployeeID).ThenByDescending(x=>x.profile.EffectiveFrom).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct)};
    }
    public Task<SalaryProfile> CreateProfile(string actor,SalaryProfileRequest r,CancellationToken ct)=>Transaction(async()=> {
        var a=await SalaryAccess(actor,"NEW",ct);var employees=a.Apply(db.Employees);
        await db.Employees.Where(e=>e.Id==r.EmployeeId).ExecuteUpdateAsync(s=>s.SetProperty(e=>e.CreatedAt,e=>e.CreatedAt),ct);
        var person=await employees.SingleOrDefaultAsync(e=>e.Id==r.EmployeeId,ct)??throw BusinessException.Missing();
        Dates(r.EffectiveFrom,r.EffectiveTo);if(r.EffectiveFrom<person.HireDate)throw BusinessException.Invalid("Salary cannot take effect before hire date.");
        PayrollEngine.Money(r.BaseSalary);PayrollEngine.Money(r.AllowanceAmount);PayrollEngine.Money(r.InsuranceBase);PayrollEngine.Money(r.KpiBonusAmount);
        if(r.Items.Any(x=>x==null) || r.Items.Select(x=>x.ComponentId).Distinct().Count()!=r.Items.Length)throw BusinessException.Invalid("Duplicate/null salary components.");
        await GuardSalaryDates(r.EmployeeId,r.EffectiveFrom,r.EffectiveTo,ct);
        var profiles=await db.Set<SalaryProfile>().Where(x=>x.EmployeeID==r.EmployeeId).ToListAsync(ct);
        if(r.SupersedeProfileId.HasValue) {
            var updateAccess=await SalaryAccess(actor,"UPDATE",ct);if(!await updateAccess.Apply(db.Employees).AnyAsync(x=>x.Id==r.EmployeeId,ct))throw BusinessException.Scope();
            var previous=profiles.SingleOrDefault(x=>x.ID==r.SupersedeProfileId)??throw BusinessException.Missing();Version(previous.Version,r.SupersedeVersion??0);
            if(previous.EffectiveFrom>=r.EffectiveFrom || previous.EffectiveTo<r.EffectiveFrom)throw BusinessException.Invalid("Superseded salary must cover the new effective date and start earlier.");
            await GuardSalaryDates(r.EmployeeId,r.EffectiveFrom,previous.EffectiveTo,ct);
            previous.EffectiveTo=r.EffectiveFrom.AddDays(-1);previous.Version++;
            Audit(actor,"SalaryProfile",previous.ID,"SALARY_PROFILE_CLOSED",new{previous.EffectiveTo,previous.Version});
        }
        if(profiles.Any(x=>Overlap(r.EffectiveFrom,r.EffectiveTo,x.EffectiveFrom,x.EffectiveTo)))throw BusinessException.Conflict("Salary effective date ranges overlap.");
        var ids=r.Items.Select(x=>x.ComponentId).ToArray();var components=await db.Set<SalaryComponent>().Where(c=>ids.Contains(c.ID)&&c.IsActive).ToDictionaryAsync(x=>x.ID,ct);
        if(components.Count!=ids.Length)throw BusinessException.Invalid("Salary component is missing or inactive.");
        var items=r.Items.Select(i=>{PayrollEngine.Money(i.Amount);var c=components[i.ComponentId];return new CompensationItem(c.ID,c.Code,c.Name,c.Kind,i.Amount,i.Prorate,c.Taxable,c.TaxDeductible,c.OvertimeIncluded);}).ToArray();
        var row=new SalaryProfile {EmployeeID=r.EmployeeId,BaseSalary=r.BaseSalary,AllowanceAmount=r.AllowanceAmount,InsuranceBase=r.InsuranceBase,Dependents=r.Dependents,
            KpiBonusAmount=r.KpiBonusAmount,EffectiveFrom=r.EffectiveFrom,EffectiveTo=r.EffectiveTo,CurrencyCode=r.CurrencyCode,PayBasis=r.PayBasis,ItemsJson=Json(items),Reason=r.Reason.Trim(),IsVerified=true};
        db.Add(row);await db.SaveChangesAsync(ct);Audit(actor,"SalaryProfile",row.ID,"SALARY_PROFILE_CREATED",new{row.EmployeeID,row.EffectiveFrom,row.EffectiveTo,reasonRecorded=true});return row;
    },ct);
    public async Task<object> Policies(string actor,PageQuery q,CancellationToken ct,bool payroll=false)
    {
        await Access(actor,payroll?PayrollScreens.Payroll:PayrollScreens.Salary,"VIEW",ct);var rows=db.Set<PayrollPolicy>().AsNoTracking();if(payroll)rows=rows.Where(x=>x.Status=="PUBLISHED");
        if(!string.IsNullOrWhiteSpace(q.Search))rows=rows.Where(x=>x.Code.Contains(q.Search)||x.Name.Contains(q.Search));
        return new PageResult<PayrollPolicy>(true,await rows.CountAsync(ct),q.Page,q.PageSize,await rows.OrderByDescending(x=>x.EffectiveFrom).ThenBy(x=>x.Code).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct));
    }
    public Task<PayrollPolicy> SavePolicy(string actor,long? id,PayrollPolicyRequest r,CancellationToken ct)=>Transaction(async()=> {
        await SalaryAccess(actor,id.HasValue?"UPDATE":"NEW",ct,true);await CatalogLock(ct);Dates(r.EffectiveFrom,r.EffectiveTo);PayrollEngine.Validate(r.Rules);
        var row=id.HasValue?await db.Set<PayrollPolicy>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing():new PayrollPolicy();
        if(id.HasValue){Version(row.Version,r.Version);if(row.Status!="DRAFT")throw BusinessException.Conflict("Published policy rules are immutable; create a new version.");row.Version++;}
        if(await db.Set<PayrollPolicy>().AnyAsync(x=>x.ID!=(id??0)&&x.Code==r.Code,ct))throw BusinessException.Conflict("Policy code already exists.");
        row.Code=r.Code;row.Name=r.Name.Trim();row.EffectiveFrom=r.EffectiveFrom;row.EffectiveTo=r.EffectiveTo;row.LegalReference=r.LegalReference.Trim();row.RulesJson=Json(r.Rules);row.Status="DRAFT";
        if(!id.HasValue)db.Add(row);await db.SaveChangesAsync(ct);Audit(actor,"PayrollPolicy",row.ID,"PAYROLL_POLICY_SAVED",new{row.Version,row.Status,rulesHash=Hash(r.Rules)});return row;
    },ct);
    public Task<PayrollPolicy> PublishPolicy(string actor,long id,PolicyPublishRequest r,CancellationToken ct)=>Transaction(async()=> {
        await SalaryAccess(actor,"UPDATE",ct,true);await CatalogLock(ct);
        var row=await db.Set<PayrollPolicy>().SingleOrDefaultAsync(x=>x.ID==id,ct)??throw BusinessException.Missing();Version(row.Version,r.Version);
        if(row.Status!="DRAFT")throw BusinessException.Conflict("Only draft policy can be published.");PayrollEngine.Validate(Read<PayrollRules>(row.RulesJson));
        var existing=await db.Set<PayrollPolicy>().Where(x=>x.Status=="PUBLISHED").ToListAsync(ct);
        if(r.SupersedePolicyId.HasValue) {
            var previous=existing.SingleOrDefault(x=>x.ID==r.SupersedePolicyId)??throw BusinessException.Missing();Version(previous.Version,r.SupersedeVersion??0);
            if(previous.EffectiveFrom>=row.EffectiveFrom || previous.EffectiveTo<row.EffectiveFrom)throw BusinessException.Invalid("Invalid predecessor policy dates.");
            var periods=await db.Set<PayrollPeriod>().Where(p=>p.PolicyId==previous.ID && (p.Status=="LOCKED" || p.Status=="PAID" || p.Status=="APPROVED" || p.ApprovalId!=null)).Select(p=>p.PeriodKey).ToListAsync(ct);
            if(periods.Any(k=>Month(k).End>=row.EffectiveFrom))throw BusinessException.Conflict("Cannot shorten policy dates used by approved/submitted payroll.");
            previous.EffectiveTo=row.EffectiveFrom.AddDays(-1);previous.Version++;
        }
        var currency=Read<PayrollRules>(row.RulesJson).CurrencyCode;
        if(existing.Any(x=>Read<PayrollRules>(x.RulesJson).CurrencyCode==currency && Overlap(row.EffectiveFrom,row.EffectiveTo,x.EffectiveFrom,x.EffectiveTo)))throw BusinessException.Conflict("Published policy effective dates overlap.");
        row.Status="PUBLISHED";row.Version++;Audit(actor,"PayrollPolicy",row.ID,"PAYROLL_POLICY_PUBLISHED",new{row.Version,row.EffectiveFrom,row.EffectiveTo});return row;
    },ct);
}
