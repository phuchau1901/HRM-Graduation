using System.ComponentModel.DataAnnotations;
namespace HRM.API.Modules.System.DTOs;
public sealed class PasswordPolicyRequest : IValidatableObject
{
    [Range(1, 1024)] public int MinimumLength { get; set; } = 12;
    [Range(1, 1024)] public int MaximumLength { get; set; } = 128;
    public bool RequireUppercase { get; set; }
    public bool RequireLowercase { get; set; }
    public bool RequireDigit { get; set; }
    public bool RequireSpecialCharacter { get; set; }
    public bool DisallowUsernameInPassword { get; set; }
    [Range(0, 100)] public int PasswordHistoryCount { get; set; }
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if (MinimumLength > MaximumLength) yield return new("MinimumLength cannot exceed MaximumLength.");
        if (MaximumLength < new[] { RequireUppercase, RequireLowercase, RequireDigit, RequireSpecialCharacter }.Count(x => x))
            yield return new("MaximumLength cannot satisfy the required character categories.");
    }
}
public sealed class AttendanceLocation
{
    [Required, MaxLength(50), RegularExpression("^[A-Z0-9][A-Z0-9_-]*$")] public string Code { get; set; } = "";
    [Required, MaxLength(150)] public string Name { get; set; } = "";
    [Range(-90d, 90d)] public double Latitude { get; set; }
    [Range(-180d, 180d)] public double Longitude { get; set; }
    [Range(10, 10000)] public int RadiusMeters { get; set; } = 100;
}
public static class MissingPunchRules { public const string Incomplete = "INCOMPLETE", Reject = "REJECT_CHECKOUT_WITHOUT_CHECKIN"; }
public sealed class AttendanceSettingsRequest : IValidatableObject
{
    [Required, MaxLength(100)] public string Timezone { get; set; } = "Asia/Ho_Chi_Minh";
    [Range(0, 1440)] public int CheckInBeforeStartMinutes { get; set; } = 60;
    [Range(0, 1440)] public int CheckInAfterStartMinutes { get; set; } = 240;
    [Range(0, 1440)] public int CheckOutBeforeEndMinutes { get; set; } = 240;
    [Range(0, 1440)] public int CheckOutAfterEndMinutes { get; set; } = 120;
    [Range(0, 240)] public int LateGraceMinutes { get; set; } = 5;
    [Range(0, 240)] public int EarlyLeaveGraceMinutes { get; set; } = 5;
    [Required, MinLength(1), MaxLength(7)] public int[] WorkingDays { get; set; } = [1, 2, 3, 4, 5];
    public bool RequireQr { get; set; }
    public bool RequireGps { get; set; }
    public bool AllowOvernightShifts { get; set; } = true;
    [Required] public string MissingPunchRule { get; set; } = MissingPunchRules.Reject;
    [Required, MaxLength(20)] public AttendanceLocation[] Locations { get; set; } = [];
    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        var zoneValid = true;
        try { TimeZoneInfo.FindSystemTimeZoneById(Timezone ?? ""); } catch (Exception e) when (e is TimeZoneNotFoundException or InvalidTimeZoneException or ArgumentException) { zoneValid = false; }
        if (!zoneValid) yield return new("Timezone must be a valid system timezone ID.");
        if (WorkingDays is null || WorkingDays.Any(x => x < 1 || x > 7) || WorkingDays.Distinct().Count() != WorkingDays.Length) yield return new("WorkingDays must contain unique ISO weekdays 1..7.");
        if (MissingPunchRule is not (MissingPunchRules.Incomplete or MissingPunchRules.Reject)) yield return new("Invalid missing-punch rule.");
        if (Locations is null || Locations.Any(x => x is null) || Locations.Select(x => x.Code).Distinct(StringComparer.Ordinal).Count() != Locations.Length) yield return new("Location codes must be unique and locations non-null.");
        if ((RequireQr || RequireGps) && (Locations is null || Locations.Length == 0)) yield return new("QR/GPS requires at least one valid location.");
    }
}
public sealed record SettingsView<T>(T Settings, long Version, DateTime UpdatedAtUtc);
