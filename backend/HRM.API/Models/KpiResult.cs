// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class KpiResult
{
    public long ID { get; set; }
    public long TargetID { get; set; }
    public long CriterionID { get; set; }
    public decimal? SelfScore { get; set; }
    public decimal? ManagerScore { get; set; }
    public string? Comment { get; set; }
}
