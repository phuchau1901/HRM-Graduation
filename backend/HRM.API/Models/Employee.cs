namespace HRM.API.Models;

public class Employee
{
    public int Id { get; set; }
    public string EmployeeCode { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? PhoneNumber { get; set; }
    public DateOnly HireDate { get; set; }
    public int DepartmentId { get; set; }
    public Department Department { get; set; } = null!;
    public string EmploymentStatus { get; set; } = "ACTIVE";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
