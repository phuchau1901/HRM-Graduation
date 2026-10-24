using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Organization.DTOs;
public sealed class OrganizationQuery : PageQuery { public bool? IsActive { get; set; } }
public sealed class DepartmentRequest
{
    [Required, MaxLength(20)] public string DepartmentCode { get; set; } = "";
    [Required, MaxLength(150)] public string DepartmentName { get; set; } = "";
    [MaxLength(500)] public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed class PositionRequest
{
    [Required, MaxLength(30)] public string Code { get; set; } = "";
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
}
public sealed record DepartmentDto(int Id, string DepartmentCode, string DepartmentName, string? Description, bool IsActive);
public sealed record PositionDto(long Id, string Code, string Name, bool IsActive);
