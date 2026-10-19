
namespace HRM.API.Modules.Authorization.Entities;

public class Screen
{
    public long ID { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public string Platform { get; set; } = "WEB";
    public string Route { get; set; } = string.Empty;
    public string? Icon { get; set; }

    public long? ParentID { get; set; }
    public int SortOrder { get; set; }
    public bool IsActive { get; set; } = true;

    // JSON: ["VIEW","CREATE","UPDATE",...]
    public string SupportedActions { get; set; } = "[]";

    public ICollection<RoleDetail> RoleDetails { get; set; }
        = new List<RoleDetail>();
}
