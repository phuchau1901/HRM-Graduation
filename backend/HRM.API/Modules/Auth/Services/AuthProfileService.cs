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
                           where ur.UserID == user.UserId orderby r.Code
                           select new RoleDto(r.ID, r.Code, r.Name)).ToListAsync(ct);
        // Fetch only grants attached to this user's roles. Do not filter CanView here:
        // another role may supply a different action that must participate in the OR.
        var grants = await (from ur in db.Set<UserRole>().AsNoTracking()
                            join detail in db.Set<RoleDetail>().AsNoTracking() on ur.RoleID equals detail.RoleID
                            join screen in db.Set<Screen>().AsNoTracking() on detail.ScreenID equals screen.ID
                            where ur.UserID == user.UserId && screen.IsActive
                            select new
                            {
                                ScreenId = screen.ID, screen.Code, screen.Name, screen.Platform, screen.Icon,
                                detail.CanNew, detail.CanView, detail.CanUpdate, detail.CanDelete,
                                detail.CanApprove, detail.CanExport
                            }).ToListAsync(ct);
        // Actual entity flags are Y/N strings. Aggregate every role first, then include
        // only viewable screens; ADMIN follows exactly the same grant path.
        var permissions = grants.GroupBy(x => x.ScreenId).Select(group =>
        {
            var screen = group.First();
            return new ScreenPermissionDto(screen.ScreenId, screen.Code, screen.Name, screen.Platform, screen.Icon,
                group.Any(x => x.CanNew == "Y") ? "Y" : "N",
                group.Any(x => x.CanView == "Y") ? "Y" : "N",
                group.Any(x => x.CanUpdate == "Y") ? "Y" : "N",
                group.Any(x => x.CanDelete == "Y") ? "Y" : "N",
                group.Any(x => x.CanApprove == "Y") ? "Y" : "N",
                group.Any(x => x.CanExport == "Y") ? "Y" : "N");
        }).Where(x => x.CanView == "Y").OrderBy(x => x.Code).ThenBy(x => x.ScreenId).ToList();
        return new(user, roles, permissions);
    }
}
