namespace HRM.API.Modules.Performance.Entities;
public sealed class KpiUnit
{
    public long ID { get; set; }
    public string Code { get; set; } = "";
    public string Name { get; set; } = "";
    public bool IsActive { get; set; } = true;
    public int SortOrder { get; set; }
    public long Version { get; set; } = 1;
}
