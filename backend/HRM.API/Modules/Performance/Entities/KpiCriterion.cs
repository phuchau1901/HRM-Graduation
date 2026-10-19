// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Performance.Entities;

public class KpiCriterion
{
    public long ID { get; set; }
    public long TemplateID { get; set; }
    public string Code { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public decimal WeightPercent { get; set; }
    public decimal MaxScore { get; set; }
}
