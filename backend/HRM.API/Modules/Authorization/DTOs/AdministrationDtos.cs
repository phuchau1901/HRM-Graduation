using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Authorization.DTOs;
public sealed class ScreenCatalogQuery : PageQuery
{
    [RegularExpression("^(WEB|MOBILE)$")] public string? Platform { get; set; }
}
public sealed class ScreenRequest
{
    [Required, MaxLength(100), RegularExpression("^[A-Z][A-Z0-9_]*$")] public string Code { get; set; } = "";
    [Required, MaxLength(200)] public string Name { get; set; } = "";
    [Required, RegularExpression("^(WEB|MOBILE)$")] public string Platform { get; set; } = "WEB";
    [MaxLength(100)] public string? Icon { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed class ScreenStatusRequest { [Required] public bool? IsActive { get; set; } }
public sealed class UserUpdateRequest : UserUpdateRequestBase { }
public sealed class UserCreateRequest : UserUpdateRequestBase
{
    [Required, MaxLength(100), RegularExpression("^[A-Za-z0-9][A-Za-z0-9_.-]*$")] public string UserId { get; set; } = "";
    [Required, StringLength(128, MinimumLength = 12)] public string Password { get; set; } = "";
    [Required, MaxLength(100)] public long[] RoleIds { get; set; } = [];
}
public class UserUpdateRequestBase
{
    [Required, EmailAddress, MaxLength(255)] public string Email { get; set; } = "";
    [Range(1, int.MaxValue)] public int? EmployeeId { get; set; }
}
public sealed class UserStatusRequest
{
    [Required, RegularExpression("^(ACTIVE|LOCKED|INACTIVE)$")] public string Status { get; set; } = "";
}
public sealed class ResetPasswordRequest
{
    [Required, MaxLength(1024)] public string CurrentPassword { get; set; } = "";
    [Required, StringLength(128, MinimumLength = 12)] public string NewPassword { get; set; } = "";
}
public sealed class UserRolesRequest { [Required, MaxLength(100)] public long[] RoleIds { get; set; } = []; }
public sealed class RoleRequest
{
    [Required, MaxLength(30), RegularExpression("^[A-Z][A-Z0-9_]*$")] public string Code { get; set; } = "";
    [Required, MaxLength(100)] public string Name { get; set; } = "";
}
public sealed class ScreenPermissionPatch
{
    [Required, MaxLength(100)] public string ScreenCode { get; set; } = "";
    // Omitted flags retain their old values; omitted ExtendedActions retains every extended grant.
    public Dictionary<string, bool>? Standard { get; set; }
    [MaxLength(100)] public string[]? ExtendedActions { get; set; }
}
public sealed class PermissionMatrixRequest : IValidatableObject
{
    [Required, MinLength(1), MaxLength(100)] public ScreenPermissionPatch[] Screens { get; set; } = [];
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (Screens?.Any(x => x is null) == true)
            yield return new ValidationResult("Screen entries cannot be null.", [nameof(Screens)]);
    }
}
public sealed record AdminScreenDto(long Id, string Code, string Name, string Platform, string? Icon, bool IsActive, string Version);
public sealed record AdminRoleDto(long Id, string Code, string Name);
public sealed record AdminRoleView(long Id, string Code, string Name, string Version);
public sealed record AdminUserDto(string UserId, string Email, int? EmployeeId, string Status, DateTime CreatedAt,
    IReadOnlyList<AdminRoleDto> Roles, string Version);
public sealed record MatrixScreenDto(long ScreenId, string ScreenCode, string Name, string Platform, bool IsActive,
    Dictionary<string, bool> Standard, string[] ExtendedActions);
public sealed record RoleMatrixDto(long RoleId, IReadOnlyList<MatrixScreenDto> Screens, string Version);
