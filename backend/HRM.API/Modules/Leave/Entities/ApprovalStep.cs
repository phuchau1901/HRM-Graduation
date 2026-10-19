// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Leave.Entities;

public class ApprovalStep
{
    public long ID { get; set; }
    public long ApprovalRequestID { get; set; }
    public int StepNo { get; set; }
    public string ApproverUserID { get; set; } = string.Empty;
    public string Decision { get; set; } = string.Empty;
    public string? Comment { get; set; }
    public DateTime? DecidedAt { get; set; }
}
