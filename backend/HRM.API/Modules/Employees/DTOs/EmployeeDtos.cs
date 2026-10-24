using System.ComponentModel.DataAnnotations;
using HRM.API.Common;
namespace HRM.API.Modules.Employees.DTOs;
public sealed class EmployeeQuery : PageQuery
{
    [Range(1, int.MaxValue)] public int? DepartmentId { get; set; }
    [MaxLength(20)] public string? EmploymentStatus { get; set; }
}
public class EmployeeProfileRequest
{
    [Required, MaxLength(150)] public string FullName { get; set; } = "";
    [Required, EmailAddress, MaxLength(255)] public string Email { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    [MaxLength(20)] public string? PhoneNumber { get; set; }
    [Required, RegularExpression("^(ACTIVE|INACTIVE|TERMINATED)$")] public string EmploymentStatus { get; set; } = "ACTIVE";
}
public sealed class EmployeeCreateRequest : EmployeeProfileRequest
{
    [Required, MaxLength(20)] public string EmployeeCode { get; set; } = "";
    public DateOnly HireDate { get; set; }
    [Range(1, int.MaxValue)] public int DepartmentId { get; set; }
}
public sealed class DepartmentTransferRequest
{
    [Range(1, int.MaxValue)] public int DepartmentId { get; set; }
    public DateOnly EffectiveDate { get; set; }
    [Required, MaxLength(500)] public string Reason { get; set; } = "";
}
public sealed class ContractRequest
{
    [Required, MaxLength(50)] public string ContractNo { get; set; } = "";
    [Required, MaxLength(30)] public string ContractType { get; set; } = "";
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    [Required, RegularExpression("^(DRAFT|ACTIVE|EXPIRED|TERMINATED|CANCELLED)$")] public string Status { get; set; } = "DRAFT";
    [MaxLength(500)] public string? AttachmentUrl { get; set; }
}
public sealed record EmployeeDto(int Id, string EmployeeCode, string FullName, string Email, DateOnly? DateOfBirth,
    string? PhoneNumber, DateOnly HireDate, int DepartmentId, string EmploymentStatus, DateTime CreatedAt);
public sealed record ContractDto(long Id, int EmployeeId, string ContractNo, string ContractType,
    DateOnly StartDate, DateOnly? EndDate, string Status, string? AttachmentUrl);
public sealed record EmployeeHistoryDto(long Id, int EmployeeId, int? OldDepartmentId, int? NewDepartmentId,
    long? OldPositionId, long? NewPositionId, DateOnly EffectiveDate, string? Reason, string? ChangedByUserId);
