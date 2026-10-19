using System.ComponentModel.DataAnnotations;
namespace HRM.API.Modules.Notifications.DTOs;

public sealed class NotificationTargetRequest
{
    [Required, MaxLength(20)] public string Type { get; set; } = "USER";
    public string[] UserIds { get; set; } = [];
    public long[] RoleIds { get; set; } = [];
    public int[] DepartmentIds { get; set; } = [];
    public string? FilterCode { get; set; }
}
public sealed class CreateNotificationRequest
{
    [Required, StringLength(200, MinimumLength = 1)] public string Title { get; set; } = "";
    [Required, StringLength(1000, MinimumLength = 1)] public string Content { get; set; } = "";
    [Required, MinLength(1), MaxLength(50)] public NotificationTargetRequest[] Targets { get; set; } = [];
    public DateTimeOffset? ScheduledAt { get; set; }
    [MaxLength(60)] public string? ReferenceType { get; set; }
    [MaxLength(100)] public string? ReferenceId { get; set; }
}
public sealed record NotificationItem(long Id, string Title, string Content, string Source, DateTime CreatedAt,
    DateTime? PublishedAt, DateTime? ReadAt, string? ReferenceType, string? ReferenceId);
public sealed record NotificationPage(IReadOnlyList<NotificationItem> Items, long? NextBeforeId);
public sealed record NotificationReceipt(long Id, string Status, DateTime? ScheduledAt, int RecipientCount);
public sealed class NotificationException(int status, string code, string message) : Exception(message)
{
    public int Status { get; } = status;
    public string Code { get; } = code;
}
