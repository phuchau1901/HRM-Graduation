// Generated from HRM_Schema_Reference.sql (proposed schema, not deployed).
namespace HRM.API.Modules.Authorization.Entities;

public class User
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public int? EmployeeId { get; set; }

    [global::System.Text.Json.Serialization.JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;
    [global::System.Text.Json.Serialization.JsonIgnore]
    public string? Salt { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    [global::System.Text.Json.Serialization.JsonIgnore]
    public long AuthVersion { get; set; }
}
