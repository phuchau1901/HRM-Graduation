namespace HRM.API.Modules.Notifications.Entities;
public class NotificationRecipient
{
    public long NotificationID { get; set; }
    public string UserID { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? ReadAt { get; set; }
    public string DeliveryStatus { get; set; } = "PENDING";
    public int DeliveryAttempts { get; set; }
    public DateTime NextAttemptAt { get; set; }
    public DateTime? SentAt { get; set; }
    public string EventID { get; set; } = Guid.NewGuid().ToString("N");
    public string? LeaseToken { get; set; }
    public DateTime? LockedUntil { get; set; }
}
