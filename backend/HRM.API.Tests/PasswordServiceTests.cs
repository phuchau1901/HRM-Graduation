using System.Buffers.Binary;
using System.Security.Cryptography;
using HRM.API.Modules.Auth.Services;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using Xunit;

namespace HRM.API.Tests;

public class PasswordServiceTests
{
    private readonly PasswordService _service = new();
    private static string Password() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(24));

    [Fact]
    public void HashUsesRequiredFormatAndMatchesIndependentPbkdf2()
    {
        var password = Password();
        var c = _service.Hash(password);
        var parts = c.PasswordHash.Split('!');
        Assert.Equal("PBKDF2-SHA256", parts[0]);
        Assert.Equal("600000", parts[1]);
        var salt = Convert.FromBase64String(c.Salt);
        Assert.Equal(32, salt.Length);
        Assert.Equal(32, Convert.FromBase64String(parts[2]).Length);
        var expected = Rfc2898DeriveBytes.Pbkdf2(password, salt, 600000, HashAlgorithmName.SHA256, 32);
        Assert.Equal(Convert.ToBase64String(expected), parts[2]);
        Assert.Equal(PasswordCheck.Success, _service.Verify(password, c.PasswordHash, c.Salt));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), c.PasswordHash, c.Salt));
    }

    [Fact]
    public void SamePasswordGetsDifferentSaltAndHash()
    {
        var password = Password(); var a = _service.Hash(password); var b = _service.Hash(password);
        Assert.NotEqual(a.Salt, b.Salt); Assert.NotEqual(a.PasswordHash, b.PasswordHash);
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, a.PasswordHash, b.Salt));
    }

    [Fact]
    public void TamperedHashOrSaltFails()
    {
        var password = Password(); var c = _service.Hash(password);
        var parts = c.PasswordHash.Split('!');
        var bytes = Convert.FromBase64String(parts[2]); bytes[0] ^= 1;
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, $"{parts[0]}!{parts[1]}!{Convert.ToBase64String(bytes)}", c.Salt));
        bytes = Convert.FromBase64String(c.Salt); bytes[0] ^= 1;
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, c.PasswordHash, Convert.ToBase64String(bytes)));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, c.PasswordHash.Replace("600000", "600001"), c.Salt));
    }

    [Theory]
    [InlineData(null)] [InlineData("")] [InlineData("!")] [InlineData("PBKDF2-SHA256!600000")]
    [InlineData("PBKDF2-SHA512!600000!bad")] [InlineData("PBKDF2-SHA256!2147483648!bad")]
    [InlineData("PBKDF2-SHA256!-1!bad")] [InlineData("PBKDF2-SHA256!+600000!bad")]
    [InlineData("PBKDF2-SHA256!0600000!bad")] [InlineData("PBKDF2-SHA256!600000!bad!extra")]
    public void MalformedFormatFailsWithoutThrowing(string? hash) =>
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), hash, null));

    [Theory]
    [InlineData("0")] [InlineData("99999")] [InlineData("1000001")] [InlineData("4294967295")]
    public void IterationsAreBoundedBeforeDerivation(string iterations)
    {
        var salt = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        var hash = $"PBKDF2-SHA256!{iterations}!{Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))}";
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), hash, salt));
    }

    [Theory]
    [InlineData(null)] [InlineData("")] [InlineData("not base64")] [InlineData("AA==")]
    public void InvalidSaltFails(string? salt)
    {
        var password = Password(); var c = _service.Hash(password);
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, c.PasswordHash, salt));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, c.PasswordHash, " " + c.Salt));
    }

    [Fact]
    public void HashRejectsOversizedOrEmptyInputAndVerifyFailsSafely()
    {
        Assert.Throws<ArgumentException>(() => _service.Hash(""));
        Assert.Throws<ArgumentException>(() => _service.Hash(new string('x', 1025)));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(null, "x", "x"));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), new string('x', 257), "x"));
    }

    [Theory]
    [InlineData(100000)] [InlineData(1000000)]
    public void ReadsIterationsFromStoredHash(int iterations)
    {
        var password = Password(); var salt = RandomNumberGenerator.GetBytes(32);
        var hash = Convert.ToBase64String(Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, HashAlgorithmName.SHA256, 32));
        Assert.Equal(iterations < 600000 ? PasswordCheck.RehashNeeded : PasswordCheck.Success,
            _service.Verify(password, $"PBKDF2-SHA256!{iterations}!{hash}", Convert.ToBase64String(salt)));
    }

    [Theory]
    [InlineData(PasswordHasherCompatibilityMode.IdentityV2)]
    [InlineData(PasswordHasherCompatibilityMode.IdentityV3)]
    public void AcceptsRealIdentityHashOnlyForCorrectPasswordAndRequestsUpgrade(PasswordHasherCompatibilityMode mode)
    {
        var password = Password();
        var hasher = new PasswordHasher<object>(Options.Create(new PasswordHasherOptions { CompatibilityMode = mode }));
        var hash = hasher.HashPassword(new object(), password);
        Assert.Equal(PasswordCheck.RehashNeeded, _service.Verify(password, hash, null));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), hash, null));
        var bytes = Convert.FromBase64String(hash); bytes[^1] ^= 1;
        Assert.Equal(PasswordCheck.Failed, _service.Verify(password, Convert.ToBase64String(bytes), null));
    }

    [Fact]
    public void LegacyHeadersCannotCauseUnboundedWorkOrAllocation()
    {
        var bytes = new byte[61]; bytes[0] = 1;
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(1, 4), 2);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(5, 4), uint.MaxValue);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(9, 4), 16);
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), Convert.ToBase64String(bytes), ""));
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(5, 4), 100000);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(9, 4), uint.MaxValue);
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), Convert.ToBase64String(bytes), ""));
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(9, 4), 16);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(1, 4), 99);
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), Convert.ToBase64String(bytes), ""));
    }

    [Theory]
    [InlineData(0)] [InlineData(1)] [InlineData(2)]
    public void LegacyV3AcceptsAllSupportedPrfsAndMinimumSubkeyLength(int prf)
    {
        var password = Password(); var salt = RandomNumberGenerator.GetBytes(16);
        var algorithm = prf switch { 0 => HashAlgorithmName.SHA1, 1 => HashAlgorithmName.SHA256, _ => HashAlgorithmName.SHA512 };
        var key = Rfc2898DeriveBytes.Pbkdf2(password, salt, 100000, algorithm, 16);
        var bytes = new byte[45]; bytes[0] = 1;
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(1, 4), (uint)prf);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(5, 4), 100000);
        BinaryPrimitives.WriteUInt32BigEndian(bytes.AsSpan(9, 4), 16);
        salt.CopyTo(bytes, 13); key.CopyTo(bytes, 29);
        Assert.Equal(PasswordCheck.RehashNeeded, _service.Verify(password, Convert.ToBase64String(bytes), null));
        Assert.Equal(PasswordCheck.Failed, _service.Verify(Password(), Convert.ToBase64String(bytes), null));
    }

    [Fact]
    public void RateLimitIsSharedAndRejectsSixthAttempt()
    {
        using var limiter = new LoginRateLimiter();
        for (var i = 0; i < 5; i++) Assert.True(limiter.TryAcquire("client-a"));
        Assert.False(limiter.TryAcquire("client-a"));
        Assert.True(limiter.TryAcquire("client-b"));
    }
}
