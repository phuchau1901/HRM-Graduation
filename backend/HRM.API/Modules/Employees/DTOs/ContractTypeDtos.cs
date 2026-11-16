using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Employees.DTOs;

public sealed class ContractTypeQuery : PageQuery { public bool? IsActive { get; set; } }
public class ContractTypeUpdateRequest
{
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [MaxLength(500)] public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    [Range(0, int.MaxValue)] public int SortOrder { get; set; }
}
public sealed record ContractTypeDto(string Code, string Name, string? Description, bool IsActive, int SortOrder);

public sealed class ContractTypeRequest : ContractTypeUpdateRequest
{
    [Required, MaxLength(30), RegularExpression(@"^[A-Za-z0-9][A-Za-z0-9_-]*$")]
    public string Code { get; set; } = "";
}
