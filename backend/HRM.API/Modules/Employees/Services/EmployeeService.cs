using System.Data;
using System.Globalization;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.DTOs;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.Notifications.DTOs;
using HRM.API.Modules.Notifications.Services;
using HRM.API.Modules.Organization.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;
namespace HRM.API.Modules.Employees.Services;

public sealed class EmployeeService(AppDbContext db, EmployeeDataScope scopes, NotificationService notifications)
{
    private static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);
    private static EmployeeDto Dto(Employee e) => new(e.Id, e.EmployeeCode, e.FullName, e.Email, e.DateOfBirth,
        e.PhoneNumber, e.HireDate, e.DepartmentId, e.PositionId, e.EmploymentStatus, DateTime.SpecifyKind(e.CreatedAt, DateTimeKind.Utc), e.TeamId, e.Team?.TeamName);
    private static ContractDto Dto(Contract c) => new(c.ID, c.EmployeeID, c.ContractNo, c.ContractType, c.StartDate, c.EndDate, c.Status, c.AttachmentURL);
    public Task<PageResult<EmployeeDto>> ListAsync(string userId, EmployeeQuery q, CancellationToken ct)
        => ListAsync(userId, q, false, ct);
    public Task<PageResult<EmployeeDto>> UnlinkedAsync(string userId, EmployeeQuery q, CancellationToken ct)
        => ListAsync(userId, q, true, ct);
    private async Task<PageResult<EmployeeDto>> ListAsync(string userId, EmployeeQuery q, bool unlinkedOnly, CancellationToken ct)
    {
        var access = await scopes.GetAsync(userId, "WEB_EMPLOYEES", "VIEW", ct);
        var query = access.Apply(db.Set<Employee>().AsNoTracking());
        if (unlinkedOnly) query = query.Where(employee => !db.Set<User>().Any(user => user.EmployeeId == employee.Id));
        if (q.DepartmentId.HasValue) query = query.Where(x => x.DepartmentId == q.DepartmentId);
        if (q.TeamId.HasValue) query = query.Where(x => x.TeamId == q.TeamId);
        if (q.EmploymentStatus is not null) query = query.Where(x => x.EmploymentStatus == q.EmploymentStatus);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.EmployeeCode.Contains(q.Search) || x.FullName.Contains(q.Search) || x.Email.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var data = await query.Include(x => x.Team).OrderBy(x => x.Id).Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct);
        return new(true, total, q.Page, q.PageSize, data.Select(Dto).ToList());
    }
    private async Task<Employee> FindAsync(string actor, int id, bool write, CancellationToken ct, string screen = "WEB_EMPLOYEES", string action = "VIEW")
    {
        var access = await scopes.GetAsync(actor, screen, action, ct); if (write) access.DemandWrite();
        return await access.Apply(db.Set<Employee>()).Include(x => x.Team).SingleOrDefaultAsync(x => x.Id == id, ct) ?? throw BusinessException.Missing();
    }
    public async Task<EmployeeDto> GetAsync(string actor, int id, CancellationToken ct) => Dto(await FindAsync(actor, id, false, ct));
    private async Task ValidateDepartmentAsync(int id, CancellationToken ct)
    {
        if (!await db.Set<Department>().AnyAsync(x => x.Id == id && x.IsActive, ct)) throw BusinessException.Invalid("An active department is required.");
    }
    private async Task ValidatePositionAsync(long? id, CancellationToken ct)
    {
        if (id.HasValue && !await db.Set<Position>().AnyAsync(x => x.ID == id && x.IsActive, ct))
            throw BusinessException.Invalid("An active position is required.");
    }
    private async Task<Team?> ValidateTeamAsync(int? id, int departmentId, CancellationToken ct)
    {
        if (!id.HasValue) return null;
        return await db.Set<Team>().Include(x => x.Department)
            .SingleOrDefaultAsync(x => x.Id == id && x.DepartmentId == departmentId && x.IsActive && x.Department.IsActive, ct)
            ?? throw BusinessException.Invalid("Team must be active and belong to the employee's active department.");
    }
    private void AuditTeam(string actor, Employee employee, int? oldTeamId, int oldDepartmentId, string trace)
    {
        if (oldTeamId == employee.TeamId) return;
        db.Add(new AuditLog
        {
            ActorUserID = actor, Action = "EMPLOYEE_TEAM_CHANGED", EntityType = "Employee",
            EntityID = employee.Id.ToString(CultureInfo.InvariantCulture), CreatedAt = DateTime.UtcNow,
            BeforeJSON = JsonSerializer.Serialize(new { teamId = oldTeamId, departmentId = oldDepartmentId }),
            AfterJSON = JsonSerializer.Serialize(new { teamId = employee.TeamId, departmentId = employee.DepartmentId, traceId = trace })
        });
    }
    private static void ValidateProfile(EmployeeProfileRequest request, DateOnly hireDate)
    {
        if (request.DateOfBirth.HasValue && (request.DateOfBirth > Today || request.DateOfBirth > hireDate))
            throw BusinessException.Invalid("Date of birth must not be after hire date or today.");
    }
    private async Task CheckEmailAsync(string email, int? id, CancellationToken ct)
    {
        if (await db.Set<Employee>().AnyAsync(x => x.Email == email && x.Id != id, ct)) throw BusinessException.Conflict("Employee email already exists.");
    }
    public async Task<EmployeeDto> CreateAsync(string actor, EmployeeCreateRequest request, string trace, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var access = await scopes.GetAsync(actor, "WEB_EMPLOYEES", "NEW", ct); access.DemandDepartment(request.DepartmentId);
        await ValidateDepartmentAsync(request.DepartmentId, ct);
        await ValidatePositionAsync(request.PositionId, ct);
        var team = await ValidateTeamAsync(request.TeamId, request.DepartmentId, ct);
        if (request.HireDate == default) throw BusinessException.Invalid("HireDate is required.");
        ValidateProfile(request, request.HireDate);
        var code = request.EmployeeCode.Trim(); var email = request.Email.Trim();
        if (await db.Set<Employee>().AnyAsync(x => x.EmployeeCode == code, ct)) throw BusinessException.Conflict("Employee code already exists.");
        await CheckEmailAsync(email, null, ct);
        var entity = new Employee { EmployeeCode = code, FullName = request.FullName.Trim(), Email = email,
            DateOfBirth = request.DateOfBirth, PhoneNumber = request.PhoneNumber, HireDate = request.HireDate,
            DepartmentId = request.DepartmentId, TeamId = request.TeamId, Team = team, PositionId = request.PositionId, EmploymentStatus = request.EmploymentStatus, CreatedAt = DateTime.UtcNow };
        db.Add(entity); await db.SaveChangesAsync(ct); Audit(actor, entity.Id, "EMPLOYEE_CREATED", trace);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Dto(entity);
    }
    public async Task<EmployeeDto> UpdateAsync(string actor, int id, EmployeeProfileRequest request, string trace, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var entity = await FindAsync(actor, id, true, ct, action: "UPDATE"); ValidateProfile(request, entity.HireDate);
        var oldTeamId = entity.TeamId;
        var targetTeamId = request.TeamIdSpecified ? request.TeamId : entity.TeamId;
        var targetTeam = targetTeamId == entity.TeamId ? entity.Team : await ValidateTeamAsync(targetTeamId, entity.DepartmentId, ct);
        if (entity.PositionId != request.PositionId) await ValidatePositionAsync(request.PositionId, ct);
        await CheckEmailAsync(request.Email.Trim(), id, ct);
        if (entity.FullName == request.FullName.Trim() && entity.Email == request.Email.Trim() &&
            entity.TeamId == targetTeamId && entity.PositionId == request.PositionId && entity.PhoneNumber == request.PhoneNumber && entity.DateOfBirth == request.DateOfBirth && entity.EmploymentStatus == request.EmploymentStatus)
        {
            await tx.CommitAsync(ct); return Dto(entity);
        }
        entity.TeamId = targetTeamId; entity.Team = targetTeam;
        AuditTeam(actor, entity, oldTeamId, entity.DepartmentId, trace);
        entity.PositionId = request.PositionId;
        entity.FullName = request.FullName.Trim(); entity.Email = request.Email.Trim(); entity.PhoneNumber = request.PhoneNumber;
        entity.DateOfBirth = request.DateOfBirth; entity.EmploymentStatus = request.EmploymentStatus;
        Audit(actor, id, "EMPLOYEE_UPDATED", trace); await db.SaveChangesAsync(ct);
        await NotifyAsync(id, "Employee record updated", "Your employee record has been updated. Open the application for details.", trace, ct);
        await tx.CommitAsync(ct); return Dto(entity);
    }
    public async Task DeactivateAsync(string actor, int id, string trace, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var entity = await FindAsync(actor, id, true, ct, action: "DELETE");
        if (entity.EmploymentStatus == "TERMINATED") throw BusinessException.Conflict("A terminated employee cannot be reactivated by deactivation.");
        if (entity.EmploymentStatus != "INACTIVE")
        {
            entity.EmploymentStatus = "INACTIVE"; Audit(actor, id, "EMPLOYEE_DEACTIVATED", trace); await db.SaveChangesAsync(ct);
            await NotifyAsync(id, "Employee record updated", "Your employee record has been updated. Open the application for details.", trace, ct);
        }
        await tx.CommitAsync(ct);
    }
    public async Task<EmployeeDto> TransferAsync(string actor, int id, DepartmentTransferRequest request, string trace, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var access = await scopes.GetAsync(actor, "WEB_EMPLOYEES", "UPDATE", ct); if (access.Scope != "ALL") throw BusinessException.Scope();
        var entity = await FindAsync(actor, id, true, ct, action: "UPDATE"); await ValidateDepartmentAsync(request.DepartmentId, ct);
        if (entity.DepartmentId == request.DepartmentId) throw BusinessException.Invalid("Employee already belongs to this department.");
        var last = await db.Set<EmployeeHistory>().Where(x => x.EmployeeID == id).OrderByDescending(x => x.EffectiveDate)
            .Select(x => (DateOnly?)x.EffectiveDate).FirstOrDefaultAsync(ct);
        if (request.EffectiveDate < entity.HireDate || request.EffectiveDate > Today || request.EffectiveDate == default || request.EffectiveDate < last)
            throw BusinessException.Invalid("EffectiveDate must be between hire date/latest history and today; future transfers require a separate scheduling workflow.");
        db.Add(new EmployeeHistory { EmployeeID = id, OldDepartmentID = entity.DepartmentId, NewDepartmentID = request.DepartmentId,
            EffectiveDate = request.EffectiveDate, Reason = request.Reason.Trim(), ChangedByUserID = actor });
        var oldTeamId = entity.TeamId; var oldDepartmentId = entity.DepartmentId;
        var targetTeam = await ValidateTeamAsync(request.TeamId, request.DepartmentId, ct);
        entity.TeamId = request.TeamId; entity.Team = targetTeam;
        entity.DepartmentId = request.DepartmentId;
        AuditTeam(actor, entity, oldTeamId, oldDepartmentId, trace);
        Audit(actor, id, "EMPLOYEE_DEPARTMENT_CHANGED", trace);
        await db.SaveChangesAsync(ct);
        await NotifyAsync(id, "Employee record updated", "Your organization assignment has changed. Open the application for details.", trace, ct);
        await tx.CommitAsync(ct); return Dto(entity);
    }
    public async Task<PageResult<EmployeeHistoryDto>> HistoryAsync(string actor, int id, PageQuery q, CancellationToken ct)
    {
        await FindAsync(actor, id, false, ct);
        var query = db.Set<EmployeeHistory>().AsNoTracking().Where(x => x.EmployeeID == id);
        return new(true, await query.CountAsync(ct), q.Page, q.PageSize, await query.OrderByDescending(x => x.EffectiveDate).ThenByDescending(x => x.ID)
            .Skip(Paging.Offset(q)).Take(q.PageSize).Select(x => new EmployeeHistoryDto(x.ID, x.EmployeeID, x.OldDepartmentID, x.NewDepartmentID,
                x.OldPositionID, x.NewPositionID, x.EffectiveDate, x.Reason, x.ChangedByUserID)).ToListAsync(ct));
    }
    public async Task<PageResult<ContractDto>> ContractsAsync(string actor, int employeeId, PageQuery q, CancellationToken ct)
    {
        await FindAsync(actor, employeeId, false, ct, "WEB_CONTRACTS", "VIEW");
        var query = db.Set<Contract>().AsNoTracking().Where(x => x.EmployeeID == employeeId);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.ContractNo.Contains(q.Search));
        return new(true, await query.CountAsync(ct), q.Page, q.PageSize, (await query.OrderByDescending(x => x.ID)
            .Skip(Paging.Offset(q)).Take(q.PageSize).ToListAsync(ct)).Select(Dto).ToList());
    }
    public async Task<ContractDto> ContractAsync(string actor, int employeeId, long id, CancellationToken ct)
    {
        await FindAsync(actor, employeeId, false, ct, "WEB_CONTRACTS", "VIEW");
        return Dto(await db.Set<Contract>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == id && x.EmployeeID == employeeId, ct) ?? throw BusinessException.Missing());
    }
    public async Task<ContractDto> SaveContractAsync(string actor, int employeeId, long? id, ContractRequest request, string trace, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var employee = await FindAsync(actor, employeeId, true, ct, "WEB_CONTRACTS", id.HasValue ? "UPDATE" : "NEW");
        if (request.StartDate == default || request.StartDate < employee.HireDate || request.EndDate < request.StartDate)
            throw BusinessException.Invalid("Contract dates are invalid or precede employee hire date.");
        if (request.Status == "ACTIVE" && (request.StartDate > Today || request.EndDate < Today))
            throw BusinessException.Invalid("An ACTIVE contract must include today.");
        if (request.Status is "EXPIRED" or "TERMINATED" && (!request.EndDate.HasValue || request.EndDate > Today))
            throw BusinessException.Invalid("A closed contract requires an EndDate no later than today.");
        if (request.AttachmentUrl is not null && (!Uri.TryCreate(request.AttachmentUrl, UriKind.Absolute, out var uri) || uri.Scheme != "https" || uri.UserInfo.Length > 0))
            throw BusinessException.Invalid("AttachmentUrl must be an absolute HTTPS URL without credentials.");
        var number = request.ContractNo.Trim();
        if (await db.Set<Contract>().AnyAsync(x => x.ContractNo == number && x.ID != id, ct)) throw BusinessException.Conflict("Contract number already exists.");
        var entity = id.HasValue ? await db.Set<Contract>().SingleOrDefaultAsync(x => x.ID == id && x.EmployeeID == employeeId, ct) ?? throw BusinessException.Missing() : new Contract { EmployeeID = employeeId };
        if (id.HasValue && entity.ContractNo == number && entity.ContractType == request.ContractType.Trim() &&
            entity.StartDate == request.StartDate && entity.EndDate == request.EndDate && entity.Status == request.Status && entity.AttachmentURL == request.AttachmentUrl)
        {
            await tx.CommitAsync(ct); return Dto(entity);
        }
        if (id.HasValue && entity.Status is not ("DRAFT" or "ACTIVE")) throw BusinessException.Conflict("Closed contracts are immutable.");
        if (entity.Status == "ACTIVE" && request.Status is not ("ACTIVE" or "EXPIRED" or "TERMINATED")) throw BusinessException.Conflict("An ACTIVE contract cannot return to DRAFT or CANCELLED.");
        if (request.Status == "ACTIVE" && await db.Set<Contract>().AnyAsync(x => x.EmployeeID == employeeId && x.ID != id && x.Status == "ACTIVE" &&
                (!x.EndDate.HasValue || x.EndDate >= request.StartDate) && (!request.EndDate.HasValue || x.StartDate <= request.EndDate), ct))
            throw BusinessException.Conflict("ACTIVE contract dates overlap an existing ACTIVE contract.");
        entity.ContractNo = number; entity.ContractType = request.ContractType.Trim(); entity.StartDate = request.StartDate;
        entity.EndDate = request.EndDate; entity.Status = request.Status; entity.AttachmentURL = request.AttachmentUrl;
        if (!id.HasValue) db.Add(entity);
        await db.SaveChangesAsync(ct); Audit(actor, employeeId, id.HasValue ? "CONTRACT_UPDATED" : "CONTRACT_CREATED", trace, entity.ID);
        await db.SaveChangesAsync(ct);
        await NotifyAsync(employeeId, "Contract updated", "A contract record has been updated. Open the application for details.", trace, ct);
        await tx.CommitAsync(ct); return Dto(entity);
    }
    private void Audit(string actor, int id, string action, string trace, long? contractId = null) => db.Add(new AuditLog
    {
        ActorUserID = actor, Action = action, EntityType = contractId.HasValue ? "Contract" : "Employee",
        EntityID = (contractId ?? id).ToString(CultureInfo.InvariantCulture), CreatedAt = DateTime.UtcNow,
        AfterJSON = JsonSerializer.Serialize(new { employeeId = id, contractId, traceId = trace })
    });
    private async Task NotifyAsync(int id, string title, string content, string trace, CancellationToken ct)
    {
        var users = await db.Set<User>().AsNoTracking().Where(x => x.EmployeeId == id && x.Status == "ACTIVE").Select(x => x.UserId).ToArrayAsync(ct);
        if (users.Length == 0) return;
        await notifications.CreateInternalAsync(new CreateNotificationRequest { Title = title, Content = content,
            Targets = [new NotificationTargetRequest { Type = users.Length == 1 ? "USER" : "USERS", UserIds = users }],
            ReferenceType = "EMPLOYEE", ReferenceId = id.ToString(CultureInfo.InvariantCulture) }, "SYSTEM",
            "employee:" + id + ":" + Guid.NewGuid().ToString("N"), trace, ct);
    }
}
