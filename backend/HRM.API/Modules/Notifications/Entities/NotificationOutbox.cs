namespace HRM.API.Modules.Notifications.Entities;
public class NotificationOutbox
{
    public long NotificationID { get; set; }
    public string Status { get; set; } = "PENDING";
    public DateTime AvailableAt { get; set; }
    public int Attempts { get; set; }
    public string? LeaseToken { get; set; }
    public DateTime? LockedUntil { get; set; }
    public string? LastErrorCode { get; set; }
}
