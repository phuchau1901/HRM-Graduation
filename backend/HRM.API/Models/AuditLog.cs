// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class AuditLog
{
    public long ID { get; set; }
    public long? ActorUserID { get; set; }
    public string Action { get; set; } = string.Empty;
    public string EntityType { get; set; } = string.Empty;
    public string EntityID { get; set; } = string.Empty;
    public string? BeforeJSON { get; set; }
    public string? AfterJSON { get; set; }
    public DateTime CreatedAt { get; set; }
}
