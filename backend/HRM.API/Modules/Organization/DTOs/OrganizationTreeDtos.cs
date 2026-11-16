namespace HRM.API.Modules.Organization.DTOs;

public sealed record OrganizationPerson(int Id, string EmployeeCode, string FullName, string? PositionName = null);
public sealed record OrganizationTeam(int Id, string TeamName, OrganizationPerson? Lead, int EmployeeCount);
public sealed record OrganizationDepartment(int Id, string DepartmentName, OrganizationPerson? Manager,
    int EmployeeCount, int TeamCount, int UnassignedCount, IReadOnlyList<OrganizationTeam> Teams);
public sealed record OrganizationMember(int Id, string EmployeeCode, string FullName, string? PositionName, string EmploymentStatus);

public sealed class OrganizationMembersQuery : HRM.API.Common.PageQuery
{
    public OrganizationMembersQuery() { PageSize = 20; }
}
