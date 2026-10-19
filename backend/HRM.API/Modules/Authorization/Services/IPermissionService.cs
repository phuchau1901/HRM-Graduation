namespace HRM.API.Modules.Authorization.Services;

public interface IPermissionService
{
    Task<Dictionary<string, string[]>> GetSnapshotAsync(string userId, CancellationToken ct = default);
    Task<bool> HasPermissionAsync(string userId, string screenCode, string action, CancellationToken ct = default);
}

internal static class PermissionActions
{
    internal static readonly IReadOnlyDictionary<string, Func<HRM.API.Modules.Authorization.Entities.RoleDetail, string>> Columns =
        new Dictionary<string, Func<HRM.API.Modules.Authorization.Entities.RoleDetail, string>>(StringComparer.Ordinal)
        {
            ["VIEW"] = x => x.CanView, ["NEW"] = x => x.CanNew, ["UPDATE"] = x => x.CanUpdate,
            ["DELETE"] = x => x.CanDelete, ["APPROVE"] = x => x.CanApprove, ["EXPORT"] = x => x.CanExport
        };
    internal static string? Normalize(string? action)
    {
        var code = action?.Trim().ToUpperInvariant();
        return code is not null && Columns.ContainsKey(code) ? code : null;
    }
}
