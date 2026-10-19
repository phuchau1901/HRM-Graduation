// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Performance.Entities;

public class PerformanceReview
{
    public long ID { get; set; }
    public long TargetID { get; set; }
    public decimal FinalScore { get; set; }
    public string Rating { get; set; } = string.Empty;
    public string ReviewedByUserID { get; set; } = string.Empty;
    public DateTime ReviewedAt { get; set; }
}
