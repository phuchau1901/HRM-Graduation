using System.ComponentModel.DataAnnotations;
namespace HRM.API.Modules.Employees.DTOs;

public sealed class ContractStatisticsQuery
{
    [Range(1, 365)] public int ExpiringWithinDays { get; set; } = 30;
}
public sealed record ContractStatisticsDto(int Active, int ExpiringSoon, int Expired, int ExpiringWithinDays, DateOnly AsOfDate);
public sealed record ContractStatisticsResponse(bool Success, ContractStatisticsDto Data);
