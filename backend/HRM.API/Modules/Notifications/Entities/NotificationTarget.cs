namespace HRM.API.Modules.Notifications.Entities;
public class NotificationTarget
{
    public long ID { get; set; }
    public long NotificationID { get; set; }
    public string Type { get; set; } = string.Empty;
    public string CriteriaJSON { get; set; } = "{}";
}
