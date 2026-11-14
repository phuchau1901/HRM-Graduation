namespace HRM.API.Modules.System.Entities;
public sealed class SystemSetting
{
    public string Key { get; set; } = "";
    public string JsonValue { get; set; } = "";
    public long Version { get; set; } = 1;
    public DateTime UpdatedAtUtc { get; set; }
}
public sealed class PasswordHistory
{
    public long Id { get; set; }
    public string UserId { get; set; } = "";
    [global::System.Text.Json.Serialization.JsonIgnore] public string PasswordHash { get; set; } = "";
    [global::System.Text.Json.Serialization.JsonIgnore] public string Salt { get; set; } = "";
    public DateTime CreatedAtUtc { get; set; }
}
