using HRM.API.Data;
using HRM.API.Modules.Auth.DTOs;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Modules.Auth.Services;

public sealed class AuthProfileService(AppDbContext db)
{
    public async Task<AuthProfileDto?> GetAsync(string userId, CancellationToken ct = default)
    {
        var user = await db.Set<User>().AsNoTracking().Where(x => x.UserId == userId && x.Status == "ACTIVE")
            .Select(x => new AuthUserDto(x.UserId, x.Email, x.EmployeeId)).SingleOrDefaultAsync(ct);
        if (user is null) return null;
        var roles = await (from ur in db.Set<UserRole>().AsNoTracking()
                           join r in db.Set<Role>().AsNoTracking() on ur.RoleID equals r.ID
                           where ur.UserID == userId orderby r.Code
                           select new RoleDto(r.ID, r.Code, r.Name)).ToListAsync(ct);
        var roleIds = roles.Select(x => x.Id).ToArray();
        var details = roleIds.Length == 0 ? new List<RoleDetail>()
            : await db.Set<RoleDetail>().AsNoTracking().Where(x => roleIds.Contains(x.RoleID)).ToListAsync(ct);
        var screens = await db.Set<Screen>().AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Code).ToListAsync(ct);
        // Permissions are additive: an explicit Y in any assigned role grants that action.
        // Missing/invalid flags deny; there is no implicit ADMIN bypass or permission mutation.
        var byScreen = details.ToLookup(x => x.ScreenID);
        var permissions = screens.Select(s =>
        {
            var grants = byScreen[s.ID].ToArray();
            string Flag(Func<RoleDetail, string> selector) => grants.Any(x => selector(x) == "Y") ? "Y" : "N";
            return new ScreenPermissionDto(s.ID, s.Code, s.Name, s.Platform, s.Route, s.Icon, s.ParentID, s.SortOrder,
                Flag(x => x.CanNew), Flag(x => x.CanView), Flag(x => x.CanUpdate),
                Flag(x => x.CanDelete), Flag(x => x.CanApprove), Flag(x => x.CanExport));
        }).ToList();
        return new(user, roles, permissions);
    }
}
