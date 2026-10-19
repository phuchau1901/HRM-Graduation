namespace HRM.API.Modules.Authorization.Entities;
// Explicit grants for new actions; existing RoleDetail flags remain authoritative for the six legacy actions.
public class RoleScreenAction
{
    public long RoleID { get; set; }
    public long ScreenID { get; set; }
    public string ActionCode { get; set; } = string.Empty;
}
