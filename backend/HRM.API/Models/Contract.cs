// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Models;

public class Contract
{
    public long ID { get; set; }
    public int EmployeeID { get; set; }
    public string ContractNo { get; set; } = string.Empty;
    public string ContractType { get; set; } = string.Empty;
    public DateOnly StartDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? AttachmentURL { get; set; }
}
