using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using HRM.API.Common;
using HRM.API.Modules.System.DTOs;
namespace HRM.API.Modules.System.Services;
public static class SettingsDefaults
{
    public const string PasswordKey = "PASSWORD_POLICY", AttendanceKey = "ATTENDANCE";
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    public const string PasswordJson = "{\"minimumLength\":12,\"maximumLength\":128,\"requireUppercase\":false,\"requireLowercase\":false,\"requireDigit\":false,\"requireSpecialCharacter\":false,\"disallowUsernameInPassword\":false,\"passwordHistoryCount\":0}";
    public const string AttendanceJson = "{\"timezone\":\"Asia/Ho_Chi_Minh\",\"checkInBeforeStartMinutes\":60,\"checkInAfterStartMinutes\":240,\"checkOutBeforeEndMinutes\":240,\"checkOutAfterEndMinutes\":120,\"lateGraceMinutes\":5,\"earlyLeaveGraceMinutes\":5,\"workingDays\":[1,2,3,4,5],\"requireQr\":false,\"requireGps\":false,\"allowOvernightShifts\":true,\"missingPunchRule\":\"REJECT_CHECKOUT_WITHOUT_CHECKIN\",\"locations\":[]}";
    public static T Read<T>(string json) => JsonSerializer.Deserialize<T>(json, Json) ?? throw BusinessException.Conflict("Invalid stored settings.");
    public static void Validate(object value)
    {
        var results = new List<ValidationResult>();
        if (!Validator.TryValidateObject(value, new ValidationContext(value), results, true)) throw BusinessException.Invalid(string.Join(" ", results.Select(x => x.ErrorMessage)));
        if (value is AttendanceSettingsRequest a) foreach (var location in a.Locations) Validate(location);
    }
}
