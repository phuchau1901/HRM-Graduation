// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Auth.Entities;

public class RefreshToken
{
    public long ID { get; set; }
    public string UserID { get; set; } = string.Empty;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
