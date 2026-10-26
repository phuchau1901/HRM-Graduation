using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Data;
using HRM.API.Modules.Auth.Entities;
using HRM.API.Modules.Auth.Services;
using HRM.API.Modules.Authorization.DTOs;
using HRM.API.Modules.Authorization.Entities;
using HRM.API.Modules.Employees.Entities;
using HRM.API.Modules.System.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Modules.Authorization.Services;

// All administration writes take the same existing catalog-row lock before reading grants.
// No role name carries implicit privilege. All grants come from the database.
public sealed class AdministrationService(AppDbContext db, IPermissionService permissions, PasswordService passwords)
{
    public const string Users = "WEB_USERS", Roles = "WEB_ROLES", Permissions = "WEB_PERMISSIONS";
    public static string Version(object value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value))));
    private static BusinessException Denied() => new(403, "HRM_ADMIN_403", "Operation exceeds current administrative authority.");
    private static void Match(string? header, string version)
    {
        if (string.IsNullOrEmpty(header)) throw new BusinessException(428, "HRM_ADMIN_428", "If-Match is required; read the resource first.");
        if (header != '"' + version + '"') throw new BusinessException(412, "HRM_ADMIN_412", "Resource changed; reload before updating.");
    }
    public async Task Demand(string actor, string screen, string action, CancellationToken ct)
    { if (!await permissions.HasPermissionAsync(actor, screen, action, ct)) throw Denied(); }
    private async Task<T> Write<T>(string actor, string screen, string action, Func<Task<T>> work, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        await db.Screens.Where(x => x.Code == Permissions).ExecuteUpdateAsync(s => s.SetProperty(x => x.IsActive, x => x.IsActive), ct);
        if (!await db.Screens.AnyAsync(x => x.Code == Permissions && x.IsActive, ct))
            throw BusinessException.Conflict("Administration must first be bootstrapped by an approved database operator.");
        await Demand(actor, screen, action, ct);
        var result = await work();
        await db.SaveChangesAsync(ct);
        await EnsureRecovery(ct);
        await tx.CommitAsync(ct);
        return result;
    }
    private async Task EnsureRecovery(CancellationToken ct)
    {
        var candidates = await db.Set<User>().AsNoTracking().Where(x => x.Status == "ACTIVE" && x.PasswordHash != "" && db.Set<UserRole>().Any(ur => ur.UserID == x.UserId && db.RoleDetails.Any(d => d.RoleID == ur.RoleID && d.CanApprove == "Y" && db.Screens.Any(s => s.ID == d.ScreenID && s.Code == Users && s.IsActive))))
            .Select(x => x.UserId).ToListAsync(ct);
        foreach (var id in candidates)
        {
            var grants = await permissions.GetSnapshotAsync(id, ct);
            if (new[] { (Users, "VIEW"), (Users, "UPDATE"), (Users, "APPROVE"), (Roles, "VIEW"), (Roles, "UPDATE"),
                    (Permissions, "VIEW"), (Permissions, "UPDATE"), (Permissions, "APPROVE") }
                .All(p => grants.TryGetValue(p.Item1, out var actions) && actions.Contains(p.Item2))) return;
        }
        throw BusinessException.Conflict("This would remove the last active account able to administer and recover access.");
    }
    private void Audit(string actor, string action, string entity, string id, object? before, object? after, string trace)
        => db.Set<AuditLog>().Add(new() { ActorUserID = actor, Action = action, EntityType = entity,
            EntityID = id.Length <= 60 ? id : Version(id)[..60], CreatedAt = DateTime.UtcNow,
            BeforeJSON = JsonSerializer.Serialize(new { resourceId = id, traceId = trace, value = before }),
            AfterJSON = JsonSerializer.Serialize(new { resourceId = id, traceId = trace, value = after }) });
    private async Task Revoke(IQueryable<User> query, CancellationToken ct)
    {
        var ids = query.Select(x => x.UserId);
        await db.Set<RefreshToken>().Where(x => ids.Contains(x.UserID) && x.RevokedAt == null)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RevokedAt, DateTime.UtcNow), ct);
        await query.ExecuteUpdateAsync(s => s.SetProperty(x => x.AuthVersion, x => x.AuthVersion + 1), ct);
    }
    private Task RevokeRoles(long[] roles, CancellationToken ct) => Revoke(db.Set<User>().Where(u =>
        db.Set<UserRole>().Any(ur => ur.UserID == u.UserId && roles.Contains(ur.RoleID))), ct);
    private async Task<HashSet<string>> RawCapabilities(long[] roles, CancellationToken ct)
    {
        var details = await (from d in db.RoleDetails.AsNoTracking() join s in db.Screens on d.ScreenID equals s.ID
                             where roles.Contains(d.RoleID) select new { s.Code, Detail = d }).ToListAsync(ct);
        var result = details.SelectMany(x => PermissionActions.Columns.Where(p => p.Value(x.Detail) == "Y")
            .Select(p => x.Code + ":" + p.Key)).ToHashSet(StringComparer.Ordinal);
        var extended = await (from a in db.Set<RoleScreenAction>().AsNoTracking() join s in db.Screens on a.ScreenID equals s.ID
                              where roles.Contains(a.RoleID) select new { s.Code, a.ActionCode }).ToListAsync(ct);
        result.UnionWith(extended.Select(x => x.Code + ":" + x.ActionCode));
        return result;
    }
    private async Task Dominates(string actor, long[] roleIds, CancellationToken ct)
    {
        var own = await permissions.GetSnapshotAsync(actor, ct);
        var allowed = own.SelectMany(x => x.Value.Select(a => x.Key + ":" + a)).ToHashSet(StringComparer.Ordinal);
        if (!(await RawCapabilities(roleIds, ct)).IsSubsetOf(allowed)) throw Denied();
    }
    private async Task ValidateRoles(string actor, long[] ids, CancellationToken ct)
    {
        if (ids.Distinct().Count() != ids.Length || ids.Any(x => x <= 0) || await db.Set<Role>().CountAsync(x => ids.Contains(x.ID), ct) != ids.Length)
            throw BusinessException.Invalid("Role IDs must be unique existing positive IDs.");
        await Dominates(actor, ids, ct);
    }
    private async Task CheckUser(string? id, UserUpdateRequestBase request, CancellationToken ct)
    {
        if (await db.Set<User>().AnyAsync(x => x.UserId != id && x.Email == request.Email, ct)) throw BusinessException.Conflict("Email already exists.");
        if (request.EmployeeId is int employee && (!await db.Set<Employee>().AnyAsync(x => x.Id == employee, ct) ||
            await db.Set<User>().AnyAsync(x => x.UserId != id && x.EmployeeId == employee, ct)))
            throw BusinessException.Invalid("Employee must exist and must not already have an account.");
    }
    public async Task<AdminUserDto> User(string id, CancellationToken ct)
    {
        var u = await db.Set<User>().AsNoTracking().Where(x => x.UserId == id)
            .Select(x => new { x.UserId, x.Email, x.EmployeeId, x.Status, x.CreatedAt, x.AuthVersion })
            .SingleOrDefaultAsync(ct) ?? throw BusinessException.Missing();
        var roles = await (from ur in db.Set<UserRole>() join r in db.Set<Role>() on ur.RoleID equals r.ID
                           where ur.UserID == id orderby r.ID select new AdminRoleDto(r.ID, r.Code, r.Name)).ToListAsync(ct);
        return new(u.UserId, u.Email, u.EmployeeId, u.Status, u.CreatedAt, roles,
            Version(new { u.UserId, u.Email, u.EmployeeId, u.Status, u.CreatedAt, u.AuthVersion, roles }));
    }
    public async Task<PageResult<AdminUserDto>> UserList(PageQuery q, long? roleId, CancellationToken ct)
    {
        var query = db.Set<User>().AsNoTracking().AsQueryable();
        if (roleId != null)
        {
            if (!await db.Set<Role>().AnyAsync(x => x.ID == roleId, ct)) throw BusinessException.Missing();
            query = query.Where(u => db.Set<UserRole>().Any(r => r.UserID == u.UserId && r.RoleID == roleId));
        }
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.UserId.Contains(q.Search) || x.Email.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var ids = await query.OrderBy(x => x.UserId).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x => x.UserId).ToListAsync(ct);
        var rows = new List<AdminUserDto>(); foreach (var id in ids) rows.Add(await User(id, ct));
        return new(true, total, q.Page, q.PageSize, rows);
    }
    public Task<AdminUserDto> CreateUser(string actor, UserCreateRequest request, string trace, CancellationToken ct)
        => Write(actor, Users, "NEW", async () =>
        {
            if (await db.Set<User>().AnyAsync(x => x.UserId == request.UserId, ct)) throw BusinessException.Conflict("User ID already exists.");
            await CheckUser(null, request, ct); await ValidateRoles(actor, request.RoleIds, ct);
            if (request.RoleIds.Length > 0) await Demand(actor, Users, "APPROVE", ct);
            var credentials = passwords.Hash(request.Password);
            db.Set<User>().Add(new() { UserId = request.UserId, Email = request.Email, EmployeeId = request.EmployeeId,
                PasswordHash = credentials.PasswordHash, Salt = credentials.Salt, Status = "ACTIVE", CreatedAt = DateTime.UtcNow });
            foreach (var role in request.RoleIds) db.Set<UserRole>().Add(new() { UserID = request.UserId, RoleID = role });
            await db.SaveChangesAsync(ct); var result = await User(request.UserId, ct);
            Audit(actor, "USER_CREATE", "User", request.UserId, null, result, trace); return result;
        }, ct);
    public Task<AdminUserDto> ChangeUser(string actor, string id, object request, string? etag, string trace, CancellationToken ct)
        => Write(actor, Users, request is ResetPasswordRequest or UserRolesRequest ? "APPROVE" : "UPDATE", async () =>
        {
            var before = await User(id, ct); Match(etag, before.Version);
            await Dominates(actor, before.Roles.Select(x => x.Id).ToArray(), ct);
            var user = await db.Set<User>().SingleAsync(x => x.UserId == id, ct);
            string operation;
            switch (request)
            {
                case UserUpdateRequest update:
                    await CheckUser(id, update, ct); user.Email = update.Email; user.EmployeeId = update.EmployeeId; operation = "USER_UPDATE"; break;
                case UserStatusRequest status: user.Status = status.Status; operation = "USER_STATUS"; break;
                case UserRolesRequest roles:
                    if (actor == before.UserId) throw Denied();
                    await ValidateRoles(actor, roles.RoleIds, ct);
                    db.Set<UserRole>().RemoveRange(await db.Set<UserRole>().Where(x => x.UserID == id).ToListAsync(ct));
                    await db.SaveChangesAsync(ct);
                    foreach (var role in roles.RoleIds) db.Set<UserRole>().Add(new() { UserID = id, RoleID = role });
                    operation = "USER_ROLES"; break;
                case ResetPasswordRequest reset:
                    if (actor == before.UserId) throw Denied();
                    var acting = await db.Set<User>().AsNoTracking().SingleAsync(x => x.UserId == actor, ct);
                    if (passwords.VerifyForLogin(reset.CurrentPassword, acting.PasswordHash, acting.Salt) == PasswordCheck.Failed) throw Denied();
                    var credentials = passwords.Hash(reset.NewPassword);
                    user.PasswordHash = credentials.PasswordHash; user.Salt = credentials.Salt; operation = "PASSWORD_RESET"; break;
                default: throw BusinessException.Invalid("Unsupported operation.");
            }
            await db.SaveChangesAsync(ct);
            await Revoke(db.Set<User>().Where(x => x.UserId == id), ct);
            var after = await User(id, ct); Audit(actor, operation, "User", id, before, after, trace); return after;
        }, ct);
    public async Task<AdminScreenDto> Screen(long id, CancellationToken ct)
    {
        var s = await db.Screens.AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing();
        return new(s.ID, s.Code, s.Name, s.Platform, s.Icon, s.IsActive, Version(new { s.ID, s.Code, s.Name, s.Platform, s.Icon, s.IsActive }));
    }
    public async Task<PageResult<AdminScreenDto>> ScreenList(ScreenCatalogQuery q, CancellationToken ct)
    {
        var query = db.Screens.AsNoTracking().Where(x => x.IsActive);
        if (q.Platform != null) query = query.Where(x => x.Platform == q.Platform);
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.Code.Contains(q.Search) || x.Name.Contains(q.Search));
        var total = await query.CountAsync(ct);
        var ids = await query.OrderBy(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x => x.ID).ToListAsync(ct);
        var rows = new List<AdminScreenDto>(); foreach (var id in ids) rows.Add(await Screen(id, ct));
        return new(true, total, q.Page, q.PageSize, rows);
    }
    public Task<AdminScreenDto> SaveScreen(string actor, long? id, ScreenRequest? request, bool? active, string? etag, string trace, CancellationToken ct)
        => Write(actor, Permissions, id == null ? "NEW" : "UPDATE", async () =>
        {
            var before = id == null ? null : await Screen(id.Value, ct);
            if (before != null) Match(etag, before.Version);
            var screen = id == null ? new Screen() : await db.Screens.SingleAsync(x => x.ID == id, ct);
            if (request != null)
            {
                if (await db.Screens.AnyAsync(x => x.ID != (id ?? 0) && x.Code == request.Code, ct)) throw BusinessException.Conflict("Screen code already exists.");
                if (before != null && (before.Code != request.Code || before.Platform != request.Platform) &&
                    (new[] { Users, Roles, Permissions }.Contains(before.Code) || await db.RoleDetails.AnyAsync(x => x.ScreenID == id, ct) || await db.Set<RoleScreenAction>().AnyAsync(x => x.ScreenID == id, ct)))
                    throw BusinessException.Conflict("Referenced or bootstrap screen codes/platforms cannot be renamed.");
                screen.Code = request.Code; screen.Name = request.Name; screen.Platform = request.Platform;
                screen.Icon = request.Icon; screen.IsActive = request.IsActive;
            }
            else screen.IsActive = active!.Value;
            if (before is { IsActive: false } && screen.IsActive)
            {
                // Reactivating a catalog entry must not awaken dormant grants beyond the actor's current authority.
                var roleIds = await db.RoleDetails.Where(x => x.ScreenID == screen.ID).Select(x => x.RoleID)
                    .Union(db.Set<RoleScreenAction>().Where(x => x.ScreenID == screen.ID).Select(x => x.RoleID)).ToArrayAsync(ct);
                await Dominates(actor, roleIds, ct);
            }
            if (id == null) db.Screens.Add(screen);
            await db.SaveChangesAsync(ct);
            var roles = await db.RoleDetails.Where(x => x.ScreenID == screen.ID).Select(x => x.RoleID)
                .Union(db.Set<RoleScreenAction>().Where(x => x.ScreenID == screen.ID).Select(x => x.RoleID)).ToArrayAsync(ct);
            await RevokeRoles(roles, ct);
            var result = await Screen(screen.ID, ct); Audit(actor, "SCREEN_SAVE", "Screen", screen.ID.ToString(), before, result, trace); return result;
        }, ct);
    public async Task<RoleMatrixDto> Matrix(long id, CancellationToken ct)
    {
        var role = await db.Set<Role>().AsNoTracking().SingleOrDefaultAsync(x => x.ID == id, ct) ?? throw BusinessException.Missing();
        var details = await db.RoleDetails.AsNoTracking().Where(x => x.RoleID == id).ToListAsync(ct);
        var extended = await db.Set<RoleScreenAction>().AsNoTracking().Where(x => x.RoleID == id).ToListAsync(ct);
        var ids = details.Select(x => x.ScreenID).Concat(extended.Select(x => x.ScreenID)).Distinct().ToArray();
        var screens = await db.Screens.AsNoTracking().Where(x => ids.Contains(x.ID)).OrderBy(x => x.ID).ToListAsync(ct);
        var rows = screens.Select(s => new MatrixScreenDto(s.ID, s.Code, s.Name, s.Platform, s.IsActive,
            PermissionActions.Columns.ToDictionary(p => p.Key, p => details.Any(d => d.ScreenID == s.ID && p.Value(d) == "Y")),
            extended.Where(x => x.ScreenID == s.ID).Select(x => x.ActionCode).OrderBy(x => x, StringComparer.Ordinal).ToArray())).ToArray();
        var users = await db.Set<UserRole>().Where(x => x.RoleID == id).OrderBy(x => x.UserID).Select(x => x.UserID).ToArrayAsync(ct);
        return new(id, rows, Version(new { role.ID, role.Code, role.Name, rows, users }));
    }
    public async Task<AdminRoleView> Role(long id, CancellationToken ct)
    {
        var matrix = await Matrix(id, ct); var role = await db.Set<Role>().AsNoTracking().SingleAsync(x => x.ID == id, ct);
        return new(role.ID, role.Code, role.Name, matrix.Version);
    }
    public async Task<PageResult<AdminRoleView>> RoleList(PageQuery q, CancellationToken ct)
    {
        var query = db.Set<Role>().AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(q.Search)) query = query.Where(x => x.Code.Contains(q.Search) || x.Name.Contains(q.Search));
        var total = await query.CountAsync(ct); var ids = await query.OrderBy(x => x.ID).Skip(Paging.Offset(q)).Take(q.PageSize).Select(x => x.ID).ToArrayAsync(ct);
        var rows = new List<AdminRoleView>(); foreach (var id in ids) rows.Add(await Role(id, ct));
        return new(true, total, q.Page, q.PageSize, rows);
    }
    public Task<AdminRoleView?> SaveRole(string actor, long? id, RoleRequest? request, string? etag, string trace, CancellationToken ct)
        => Write<AdminRoleView?>(actor, Roles, id == null ? "NEW" : request == null ? "DELETE" : "UPDATE", async () =>
        {
            var before = id == null ? null : await Role(id.Value, ct);
            if (before != null) { Match(etag, before.Version); await Dominates(actor, [id!.Value], ct); }
            var role = id == null ? new Role() : await db.Set<Role>().SingleAsync(x => x.ID == id, ct);
            if (request == null)
            {
                if (await db.Set<UserRole>().AnyAsync(x => x.RoleID == id, ct) || await db.RoleDetails.AnyAsync(x => x.RoleID == id, ct) || await db.Set<RoleScreenAction>().AnyAsync(x => x.RoleID == id, ct))
                    throw BusinessException.Conflict("Remove assignments and grants explicitly before deleting a role.");
                db.Set<Role>().Remove(role); Audit(actor, "ROLE_DELETE", "Role", id!.Value.ToString(), before, null, trace); return null;
            }
            if (await db.Set<Role>().AnyAsync(x => x.ID != (id ?? 0) && x.Code == request.Code, ct)) throw BusinessException.Conflict("Role code already exists.");
            role.Code = request.Code; role.Name = request.Name; if (id == null) db.Set<Role>().Add(role);
            await db.SaveChangesAsync(ct); await RevokeRoles([role.ID], ct);
            var after = await Role(role.ID, ct); Audit(actor, "ROLE_SAVE", "Role", role.ID.ToString(), before, after, trace); return after;
        }, ct);
    public Task<RoleMatrixDto> SaveMatrix(string actor, long id, PermissionMatrixRequest request, string? etag, string trace, CancellationToken ct)
        => Write(actor, Permissions, "UPDATE", async () =>
        {
            await Demand(actor, Permissions, "APPROVE", ct);
            var before = await Matrix(id, ct); Match(etag, before.Version);
            if (await db.Set<UserRole>().AnyAsync(x => x.UserID == actor && x.RoleID == id, ct)) throw Denied();
            await Dominates(actor, [id], ct);
            if (request.Screens.Select(x => x.ScreenCode).Distinct(StringComparer.Ordinal).Count() != request.Screens.Length) throw BusinessException.Invalid("Duplicate screens.");
            var own = await permissions.GetSnapshotAsync(actor, ct);
            foreach (var patch in request.Screens)
            {
                var screen = await db.Screens.SingleOrDefaultAsync(x => x.Code == patch.ScreenCode, ct) ?? throw BusinessException.Invalid("Screen code does not exist.");
                if (patch.Standard?.Keys.Any(x => !PermissionActions.Columns.ContainsKey(x)) == true ||
                    patch.ExtendedActions?.Any(x => !PermissionActions.Extended.Contains(x)) == true ||
                    patch.ExtendedActions?.Distinct().Count() != patch.ExtendedActions?.Length) throw BusinessException.Invalid("Invalid or duplicate action code.");
                var proposed = (patch.Standard ?? []).Where(x => x.Value).Select(x => x.Key).Concat(patch.ExtendedActions ?? []).ToArray();
                if (proposed.Length > 0 && (!screen.IsActive || proposed.Any(x => !own.GetValueOrDefault(screen.Code, []).Contains(x)))) throw Denied();
                if (patch.Standard != null)
                {
                    var detail = await db.RoleDetails.SingleOrDefaultAsync(x => x.RoleID == id && x.ScreenID == screen.ID, ct);
                    if (detail == null) { detail = new() { RoleID = id, ScreenID = screen.ID }; db.RoleDetails.Add(detail); }
                    foreach (var flag in patch.Standard) SetFlag(detail, flag.Key, flag.Value);
                }
                if (patch.ExtendedActions != null)
                {
                    var existing = await db.Set<RoleScreenAction>().Where(x => x.RoleID == id && x.ScreenID == screen.ID).ToListAsync(ct);
                    db.Set<RoleScreenAction>().RemoveRange(existing.Where(x => PermissionActions.Extended.Contains(x.ActionCode) && !patch.ExtendedActions.Contains(x.ActionCode)));
                    foreach (var action in patch.ExtendedActions.Where(a => existing.All(x => x.ActionCode != a)))
                        db.Set<RoleScreenAction>().Add(new() { RoleID = id, ScreenID = screen.ID, ActionCode = action });
                }
            }
            await db.SaveChangesAsync(ct); await RevokeRoles([id], ct);
            var after = await Matrix(id, ct); Audit(actor, "PERMISSIONS_UPDATE", "Role", id.ToString(), before, after, trace); return after;
        }, ct);
    private static void SetFlag(RoleDetail d, string action, bool value)
    {
        var flag = value ? "Y" : "N";
        switch (action) { case "VIEW": d.CanView = flag; break; case "NEW": d.CanNew = flag; break;
            case "UPDATE": d.CanUpdate = flag; break; case "DELETE": d.CanDelete = flag; break;
            case "APPROVE": d.CanApprove = flag; break; case "EXPORT": d.CanExport = flag; break; }
    }
    public static object Actions() => new { standard = PermissionActions.Columns.Keys.OrderBy(x => x).ToArray(), extended = PermissionActions.Extended.OrderBy(x => x).ToArray() };
}
