namespace HRM.API.Modules.Auth.DTOs;

public sealed class LoginRequest
{
    public string? UserId { get; init; }
    // Legacy login request alias; there is no separate Username on the User entity.
    public string? Username { get; init; }
    public string? Password { get; init; }
}
public sealed record AuthUserDto(string UserId, string Email, int? EmployeeId);
public sealed record RoleDto(long Id, string Code, string Name);
public sealed record ScreenPermissionDto(long ScreenId, string Code, string Name, string Platform,
    string? Route, string? Icon, long? ParentId, int SortOrder,
    string CanNew, string CanView, string CanUpdate, string CanDelete, string CanApprove, string CanExport);
public sealed record AuthProfileDto(AuthUserDto User, IReadOnlyList<RoleDto> Roles, IReadOnlyList<ScreenPermissionDto> Permissions);
public sealed record LoginResponse(string AccessToken, string TokenType, DateTime ExpiresAtUtc,
    AuthUserDto User, IReadOnlyList<RoleDto> Roles, IReadOnlyList<ScreenPermissionDto> Permissions);
