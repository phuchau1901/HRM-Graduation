using System.Buffers.Binary;
using System.Globalization;
using System.Security.Cryptography;

namespace HRM.API.Modules.Auth.Services;

public enum PasswordCheck { Failed, Success, RehashNeeded }
public sealed record PasswordCredentials(string PasswordHash, string Salt);

/// <summary>All new credentials use a separate random 32-byte salt and PBKDF2-SHA256.</summary>
public sealed class PasswordService
{
    public const int DefaultIterations = 600_000;
    public const int MinimumIterations = 100_000;
    public const int MaximumIterations = 1_000_000;
    public const int MaximumPasswordLength = 1024;
    private const int KeySize = 32;
    private const string Algorithm = "PBKDF2-SHA256";

    public PasswordCredentials Hash(string password)
    {
        if (!IsValidPasswordInput(password))
            throw new ArgumentException("Password must contain 1 to 1024 characters.", nameof(password));
        var salt = RandomNumberGenerator.GetBytes(32);
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, DefaultIterations, HashAlgorithmName.SHA256, KeySize);
        try
        {
            return new($"{Algorithm}!{DefaultIterations}!{Convert.ToBase64String(key)}", Convert.ToBase64String(salt));
        }
        finally { CryptographicOperations.ZeroMemory(key); }
    }

    public PasswordCheck Verify(string? password, string? passwordHash, string? salt)
        => VerifyCore(password, passwordHash, salt, out _);

    public PasswordCheck VerifyForLogin(string? password, string? passwordHash, string? salt)
    {
        var result = VerifyCore(password, passwordHash, salt, out var performedWork);
        // Old Identity hashes may have very cheap work factors (V2 uses just 1000 rounds).
        // Pad failed legacy checks so they do not create a fast account-discovery path.
        if (!performedWork || (result == PasswordCheck.Failed &&
            passwordHash is not null && !passwordHash.StartsWith($"{Algorithm}!{DefaultIterations}!", StringComparison.Ordinal)))
            PerformDummyVerification(password);
        return result;
    }

    private PasswordCheck VerifyCore(string? password, string? passwordHash, string? salt, out bool performedWork)
    {
        performedWork = false;
        if (!IsValidPasswordInput(password) || string.IsNullOrEmpty(passwordHash) || passwordHash.Length > 256)
            return PasswordCheck.Failed;
        // Never fall back to legacy verification for a malformed custom-format credential.
        if (passwordHash.Contains('!'))
        {
            var parts = passwordHash.Split('!');
            if (parts.Length != 3 || parts[0] != Algorithm ||
                !int.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var iterations) ||
                iterations < MinimumIterations || iterations > MaximumIterations ||
                parts[1] != iterations.ToString(CultureInfo.InvariantCulture) ||
                !TryBase64(parts[2], 32, 32, out var expected) ||
                !TryBase64(salt, 32, 32, out var saltBytes))
                return PasswordCheck.Failed;
            performedWork = true;
            if (!Compare(password!, saltBytes, iterations, HashAlgorithmName.SHA256, expected))
                return PasswordCheck.Failed;
            return iterations < DefaultIterations ? PasswordCheck.RehashNeeded : PasswordCheck.Success;
        }
        return VerifyLegacy(password!, passwordHash, out performedWork);
    }

    // Identity V2/V3 include the salt inside their binary payload. They are read-only formats:
    // after a successful login AuthService replaces BOTH stored fields with new credentials.
    private static PasswordCheck VerifyLegacy(string password, string stored, out bool performedWork)
    {
        performedWork = false;
        if (!TryBase64(stored, 45, 141, out var bytes)) return PasswordCheck.Failed;
        ReadOnlySpan<byte> payload = bytes;
        if (payload[0] == 0 && payload.Length == 49)
        {
            performedWork = true;
            return Compare(password, payload.Slice(1, 16), 1000, HashAlgorithmName.SHA1, payload[17..])
                ? PasswordCheck.RehashNeeded : PasswordCheck.Failed;
        }
        if (payload[0] != 1 || payload.Length < 45) return PasswordCheck.Failed;
        var prf = BinaryPrimitives.ReadUInt32BigEndian(payload.Slice(1, 4));
        var iterations = BinaryPrimitives.ReadUInt32BigEndian(payload.Slice(5, 4));
        var saltLength = BinaryPrimitives.ReadUInt32BigEndian(payload.Slice(9, 4));
        if (iterations < 1 || iterations > MaximumIterations || saltLength < 16 || saltLength > 64 ||
            payload.Length - 13 - (int)saltLength is < 16 or > 64)
            return PasswordCheck.Failed;
        var algorithm = prf switch
        {
            0 => HashAlgorithmName.SHA1,
            1 => HashAlgorithmName.SHA256,
            2 => HashAlgorithmName.SHA512,
            _ => default
        };
        if (algorithm == default) return PasswordCheck.Failed;
        performedWork = true;
        return Compare(password, payload.Slice(13, (int)saltLength), (int)iterations, algorithm,
            payload[(13 + (int)saltLength)..]) ? PasswordCheck.RehashNeeded : PasswordCheck.Failed;
    }

    private static bool Compare(string password, ReadOnlySpan<byte> salt, int iterations,
        HashAlgorithmName algorithm, ReadOnlySpan<byte> expected)
    {
        Span<byte> actual = stackalloc byte[expected.Length];
        try
        {
            Rfc2898DeriveBytes.Pbkdf2(password.AsSpan(), salt, actual, iterations, algorithm);
            return CryptographicOperations.FixedTimeEquals(actual, expected);
        }
        finally { CryptographicOperations.ZeroMemory(actual); }
    }

    private static bool TryBase64(string? value, int min, int max, out byte[] bytes)
    {
        bytes = Array.Empty<byte>();
        if (string.IsNullOrEmpty(value) || value.Length > ((max + 2) / 3) * 4) return false;
        Span<byte> buffer = stackalloc byte[max];
        if (!Convert.TryFromBase64String(value, buffer, out var length) || length < min || length > max)
            return false;
        // Reject whitespace and noncanonical padding as well as invalid characters.
        if (Convert.ToBase64String(buffer[..length]) != value) return false;
        bytes = buffer[..length].ToArray();
        return true;
    }

    public static bool IsValidPasswordInput(string? password) => password is { Length: > 0 and <= MaximumPasswordLength };

    /// <summary>Do comparable password work for unknown/disabled accounts, without a stored password.</summary>
    public void PerformDummyVerification(string? password)
    {
        Span<byte> output = stackalloc byte[KeySize];
        var salt = RandomNumberGenerator.GetBytes(32);
        Rfc2898DeriveBytes.Pbkdf2((IsValidPasswordInput(password) ? password : "").AsSpan(), salt,
            output, DefaultIterations, HashAlgorithmName.SHA256);
        CryptographicOperations.ZeroMemory(output);
    }
}
