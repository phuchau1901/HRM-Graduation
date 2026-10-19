// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Leave.Entities;

public class ApprovalRequest
{
    public long ID { get; set; }
    public string RequestType { get; set; } = string.Empty;
    public long ReferenceID { get; set; }
    public string RequestedByUserID { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}
