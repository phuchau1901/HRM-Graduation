using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using HRM.API.Common;
namespace HRM.API.Modules.System.DTOs;

public sealed class AuditLogQuery : PageQuery
{
    [MaxLength(100)] public string? ActorUserId { get; set; }
    [MaxLength(100)] public string? Action { get; set; }
    [MaxLength(100)] public string? EntityType { get; set; }
    [MaxLength(60)] public string? EntityId { get; set; }
    public DateTimeOffset? FromUtc { get; set; }
    public DateTimeOffset? ToUtc { get; set; }
}
public sealed record AuditLogSummary(long Id, string? ActorUserId, string Action, string EntityType, string EntityId, DateTime CreatedAt);
public sealed record AuditLogDetail(long Id, string? ActorUserId, string Action, string EntityType, string EntityId,
    DateTime CreatedAt, JsonElement? BeforeJson, JsonElement? AfterJson);
