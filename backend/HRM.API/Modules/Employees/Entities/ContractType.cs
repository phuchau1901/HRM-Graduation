namespace HRM.API.Modules.Employees.Entities;

public sealed class ContractType
{
    public string Code { get; set; } = "";
    public string? Prefix { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
}
