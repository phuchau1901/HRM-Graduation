# Auth password implementation

Historical report of the password-service change. The subsequent Authentication API/JWT/seeder implementation and current setup instructions are in [AUTHENTICATION_SETUP.md](AUTHENTICATION_SETUP.md). Statements below about absent HTTP/JWT flows describe the earlier baseline.

The source inspected for this change contained User, RefreshToken, JWT package references and permission entities, but no AuthService, AuthController, login endpoint, JWT issuer, account creation flow, change-password endpoint or reset-token flow. This implementation adds the reusable AuthService and registers it in DI. It does not invent JWTs or expose unauthenticated account-management endpoints. Existing Role/RoleDetail Y/N rules are unchanged.

## Credentials

`Modules/Auth/Services/PasswordService.cs` creates a cryptographically random 32-byte salt and a 32-byte PBKDF2-HMAC-SHA256 key with 600,000 iterations. The salt is canonical Base64 in `users.salt`; the key is stored as `PBKDF2-SHA256!600000!BASE64_HASH` in `users.password_hash`.

Verification reads the stored algorithm and work factor. New-format iteration counts must be between 100,000 and 1,000,000, with canonical decimal formatting. Salt/key lengths must both be 32 bytes. Unsupported algorithms, oversized values, bad Base64, whitespace/padding variants and malformed fields fail closed. Input passwords are bounded to 1–1024 characters and are never trimmed, normalized, persisted or logged. Derived comparison buffers are cleared and comparisons use `CryptographicOperations.FixedTimeEquals`. User credential fields are excluded from JSON serialization.

Legacy ASP.NET Core Identity V2 and V3 payloads are parsed with bounded lengths and work factors, using the embedded salt and PRF, without using PasswordHasher in production. V2 SHA1 and V3 SHA1/SHA256/SHA512 are supported. Legacy V3 rounds must be 1–1,000,000, salts 16–64 bytes, subkeys 16–64 bytes. Unsupported/out-of-bounds hashes require the existing account recovery process; they are not treated as plaintext passwords. A successful legacy login replaces both fields with fresh credentials. Valid custom hashes with fewer than 600,000 rounds are upgraded too. Failed logins never rewrite credentials. Compare-and-swap updates prevent a concurrent password change/reset being overwritten by an upgrade. Format behavior was checked against [Microsoft's PasswordHasher implementation](https://source.dot.net/Microsoft.Extensions.Identity.Core/PasswordHasher.cs.html).

## Service integration

- `LoginAsync`: checks rate limits first, reads fresh database credentials with `AsNoTracking`, validates ACTIVE status, verifies, and upgrades when needed. Returns only status and user ID. An existing/future HTTP controller should map InvalidCredentials to the same generic 401 response for all credential failures, and RateLimited to 429. JWT issuance may run only after Success, using the existing token/role flow when supplied.
- `CreateAccountAsync`: uses PasswordService and persists hash/salt together. Account creation authorization belongs to the caller. Database unique constraints enforce existing username/email rules.
- `ChangePasswordAsync`: checks the current credential and uses an atomic compare-and-swap update of hash/salt. The user ID must come from a trusted authenticated principal.
- `ResetPasswordAsync`: a trusted server-side primitive. The caller MUST validate a single-use recovery token or administrator permission first. No public endpoint has been added for it.

There is no existing token/session implementation to integrate in this checkout; no reset-token consumption, JWT issuance, refresh-token revocation or HTTP response contract is invented here. These must be connected when that source is available.

## Login limits and failure handling

A singleton LoginRateLimiter limits attempts to 5/minute per server-resolved client address and 30/minute for the application instance, with no queue. Requests without a context/address share the `unknown` bucket. All attempts count, including successful ones. AuthService enforces the limiter so a controller cannot accidentally omit it. Unknown/disabled accounts and malformed stored credentials still perform default-cost password work; failed older/low-cost hashes receive additional work. Full request timings are not guaranteed to be identical across different hash work factors.

The limiter is process-local. Multiple Railway replicas need a shared limiter or gateway policy for deployment-wide limits. Behind Railway's proxy, the remote address may be the proxy address, causing users to share a bucket until trusted forwarded-header configuration is supplied. Raw X-Forwarded-For is intentionally not trusted, and Railway configuration was not changed. The instance limit still bounds attempts. ASP.NET rate limiter primitives follow [Microsoft's rate limiting documentation](https://learn.microsoft.com/aspnet/core/performance/rate-limit?view=aspnetcore-8.0).

## Migration review

`20261019080000_AddUserSalt` adds ONLY `users.salt` as required longtext. Existing rows get an empty string so embedded Identity salts remain valid until successful login; it never tries to derive a hash from an old hash. The existing Salt CLR property is explicitly mapped to lowercase `salt` without changing existing column types. Its old convention-based column name would have been `Salt`.

The migration designer and snapshot include only this addition to the existing migration model. Pre-existing pending `screens`/`role_details` changes are not bundled. No database update or migration application was run. Before applying, review the migration and verify whether the deployed users table already has a salt/Salt column; deployed schema was not inspected. Apply the reviewed schema change before enabling code that reads this field. Mixed old/new application versions may not understand the custom format, so avoid mixed-version password writes during rollout.

## Validation

Run from the repository root:

```sh
dotnet build backend/HRM.API/HRM.sln
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj
```

Tests generate actual test passwords/salts at runtime. They cover the required format, independent PBKDF2 derivation, right/wrong passwords, fresh salts, tampering, malformed inputs, iteration bounds, real Identity V2/V3 compatibility, account lifecycle, disabled/unknown accounts, rate limiting, JSON protection, stale tracking, concurrent reset vs. login upgrade, and migration SQL generation. Relational service tests use disposable in-memory SQLite only; the migration test generates MySQL SQL without opening a MySQL connection.

Backup before edits: `/private/tmp/hrm-password-audit/source.before.tar.gz` (temporary storage).

Validation result: 39 tests passed, 0 failed, 0 skipped. Test execution required permission to run outside the sandbox because VSTest opens a local socket. No Railway database was accessed. The backend build passed with 0 warnings and 0 errors.
