namespace HRM.API.Modules.System.Entities;

// Content is stored once. Recipient state belongs to NotificationRecipient.
public class Notification
{
    public long ID { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
    public string Source { get; set; } = "SYSTEM";
    public string Status { get; set; } = "DRAFT";
    public string? CreatedByUserID { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? ScheduledAt { get; set; }
    public DateTime? PublishedAt { get; set; }
    public DateTime? CancelledAt { get; set; }
    public string? ReferenceType { get; set; }
    public string? ReferenceID { get; set; }
    public string DeduplicationKey { get; set; } = string.Empty;
    public string RequestHash { get; set; } = string.Empty;
    public string TraceID { get; set; } = string.Empty;
    public int RecipientCount { get; set; }
}
