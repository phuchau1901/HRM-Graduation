// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class ApprovalRequest
{
    public long ID { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public long ReferenceID { get; set; }
    public long RequestedByUserID { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
