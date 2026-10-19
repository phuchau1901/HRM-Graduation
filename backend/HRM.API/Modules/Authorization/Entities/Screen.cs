
namespace HRM.API.Modules.Authorization.Entities;

public class Screen
{
    public long ID { get; set; }

    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;

    public string Platform { get; set; } = "WEB";
    public string? Icon { get; set; }

    public bool IsActive { get; set; } = true;


    public ICollection<RoleDetail> RoleDetails { get; set; }
        = new List<RoleDetail>();
}
