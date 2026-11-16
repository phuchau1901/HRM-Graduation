namespace HRM.API.Modules.Employees.Entities;
public sealed class DocumentSequence
{
    public string DocumentType { get; set; } = "";
    public int DocumentYear { get; set; }
    public long LastNumber { get; set; }
}
