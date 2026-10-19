// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Attendance.Entities;

public class QRSession
{
    public long ID { get; set; }
    public string LocationCode { get; set; } = string.Empty;
    public string NonceHash { get; set; } = string.Empty;
    public DateTime ValidFrom { get; set; }
    public DateTime ExpiresAt { get; set; }
    public string Status { get; set; } = string.Empty;
}
