using HRM.API.Data;
using HRM.API.Modules.Authorization.Entities;
using Microsoft.EntityFrameworkCore;

namespace HRM.API.Modules.Authorization.Services;

public sealed class PermissionService(AppDbContext db) : IPermissionService
{
    public async Task<Dictionary<string, string[]>> GetSnapshotAsync(string userId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId) || userId.Length > 100)
            return new(StringComparer.Ordinal);
        var rows = await (from user in db.Set<User>().AsNoTracking()
                          join ur in db.Set<UserRole>() on user.UserId equals ur.UserID
                          join role in db.Set<Role>() on ur.RoleID equals role.ID
                          join detail in db.Set<RoleDetail>() on role.ID equals detail.RoleID
                          join screen in db.Set<Screen>() on detail.ScreenID equals screen.ID
                          where user.UserId == userId && user.Status == "ACTIVE" && screen.IsActive
                          select new { screen.Code, Detail = detail }).ToListAsync(ct);
        var result = rows.GroupBy(x => x.Code, StringComparer.Ordinal).OrderBy(x => x.Key, StringComparer.Ordinal)
            .ToDictionary(g => g.Key, g => PermissionActions.Columns
                .Where(a => g.Any(x => a.Value(x.Detail) == "Y")).Select(a => a.Key).OrderBy(x => x, StringComparer.Ordinal).ToArray(), StringComparer.Ordinal);
        var extended = await (from user in db.Set<User>().AsNoTracking()
                              join ur in db.Set<UserRole>() on user.UserId equals ur.UserID
                              join role in db.Set<Role>() on ur.RoleID equals role.ID
                              join grant in db.Set<RoleScreenAction>() on role.ID equals grant.RoleID
                              join screen in db.Set<Screen>() on grant.ScreenID equals screen.ID
                              where user.UserId == userId && user.Status == "ACTIVE" && screen.IsActive
                              select new { screen.Code, grant.ActionCode }).ToListAsync(ct);
        foreach (var group in extended.Where(x => PermissionActions.Extended.Contains(x.ActionCode)).GroupBy(x => x.Code))
            result[group.Key] = (result.GetValueOrDefault(group.Key) ?? []).Concat(group.Select(x => x.ActionCode))
                .Distinct(StringComparer.Ordinal).OrderBy(x => x, StringComparer.Ordinal).ToArray();
        return result;
    }

    public Task<bool> HasPermissionAsync(string userId, string screenCode, string action, CancellationToken ct = default)
    {
        var operation = PermissionActions.Normalize(action);
        if (string.IsNullOrWhiteSpace(userId) || userId.Length > 100 ||
            string.IsNullOrWhiteSpace(screenCode) || screenCode.Length > 100 || operation is null)
            return Task.FromResult(false);
        if (PermissionActions.Extended.Contains(operation))
            return (from user in db.Set<User>().AsNoTracking()
                    join ur in db.Set<UserRole>() on user.UserId equals ur.UserID
                    join role in db.Set<Role>() on ur.RoleID equals role.ID
                    join grant in db.Set<RoleScreenAction>() on role.ID equals grant.RoleID
                    join screen in db.Set<Screen>() on grant.ScreenID equals screen.ID
                    where user.UserId == userId && user.Status == "ACTIVE" && screen.IsActive &&
                        screen.Code == screenCode && grant.ActionCode == operation select grant).AnyAsync(ct);
        // Database permission lookup for callers explicitly requiring current grants; API handlers use JWT snapshots.
        var grants = from user in db.Set<User>().AsNoTracking()
                     join ur in db.Set<UserRole>().AsNoTracking() on user.UserId equals ur.UserID
                     join role in db.Set<Role>().AsNoTracking() on ur.RoleID equals role.ID
                     join detail in db.Set<RoleDetail>().AsNoTracking() on role.ID equals detail.RoleID
                     join screen in db.Set<Screen>().AsNoTracking() on detail.ScreenID equals screen.ID
                     where user.UserId == userId && user.Status == "ACTIVE" && screen.Code == screenCode && screen.IsActive
                     select detail;
        return operation switch
        {
            "VIEW" => grants.AnyAsync(x => x.CanView == "Y", ct),
            "NEW" => grants.AnyAsync(x => x.CanNew == "Y", ct),
            "UPDATE" => grants.AnyAsync(x => x.CanUpdate == "Y", ct),
            "DELETE" => grants.AnyAsync(x => x.CanDelete == "Y", ct),
            "APPROVE" => grants.AnyAsync(x => x.CanApprove == "Y", ct),
            "EXPORT" => grants.AnyAsync(x => x.CanExport == "Y", ct),
            _ => Task.FromResult(false)
        };
    }
}
