// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class PerformanceReview
{
    public long ID { get; set; }
    public long TargetID { get; set; }
    public decimal FinalScore { get; set; }
    public string Rating { get; set; } = string.Empty;
    public long ReviewedByUserID { get; set; }
    public DateTime ReviewedAt { get; set; }
}
