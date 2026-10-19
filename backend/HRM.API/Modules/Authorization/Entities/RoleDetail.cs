
namespace HRM.API.Modules.Authorization.Entities;

public class RoleDetail
{
    public long RoleID { get; set; }
    public long ScreenID { get; set; }

    public string CanNew { get; set; } = "N";
    public string CanView { get; set; } = "N";
    public string CanUpdate { get; set; } = "N";
    public string CanDelete { get; set; } = "N";
    public string CanApprove { get; set; } = "N";
    public string CanExport { get; set; } = "N";

    public Role Role { get; set; } = null!;
    public Screen Screen { get; set; } = null!;
}
