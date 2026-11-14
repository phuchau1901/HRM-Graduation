using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Organization.DTOs;

public sealed class TeamQuery : PageQuery
{
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    public bool? IsActive { get; set; }
}
public sealed class TeamRequest
{
    [Required, MaxLength(30), RegularExpression(@"^[A-Za-z0-9][A-Za-z0-9_-]*$")]
    public string TeamCode { get; set; } = "";
    [Required, MaxLength(150)] public string TeamName { get; set; } = "";
    [Range(1, int.MaxValue)] public int DepartmentId { get; set; }
    [MaxLength(500)] public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
}
public sealed record TeamDto(int Id, string TeamCode, string TeamName, int DepartmentId,
    string DepartmentName, string? Description, bool IsActive, DateTime CreatedAt);
