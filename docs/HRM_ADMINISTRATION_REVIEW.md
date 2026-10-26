# Administration implementation — review before Railway

Source audit: 2026-10-26. Backend: `backend/HRM.API`. No database updates, seed, reset, deploy or grant writes were executed. A read-only DEV catalog/history/column audit used SELECT only, without retrieving password hashes, salt or connection strings in output. Local tests use isolated SQLite databases.

## Implemented

21 additional REST endpoints: Screens 5, Users 7, Roles 6, permission matrix 2, action catalog 1. Total production REST routes:52; route uniqueness and JWT/permission attributes are tested. Existing31 endpoints retained. Full per-endpoint method/path, permissions, request/response, errors, validations and test cases: [HRM_API_SPEC.md](HRM_API_SPEC.md), [HRM_API_EXAMPLES.md](HRM_API_EXAMPLES.md). Collection: [HRM-API.postman_collection.json](HRM-API.postman_collection.json).

Actual DEV catalog: WEB_USERS id8, WEB_ROLES id9, WEB_PERMISSIONS id10; all ACTIVE/WEB. No WEB_SCREENS. The Screens API, action catalog and matrix use WEB_PERMISSIONS. No catalog rows or grants were created. Actual DEV applied migration history at audit time: `20261019074710_InitialHRMDatabase`, `20261019145341_AddNotificationCenter`.

Administration metadata lists are global only with explicit management VIEW grants, do not return employee personal details and never return password/hash/salt/authVersion. Employee SELF/DEPARTMENT/ALL configuration and query scope remain in their existing service. Grant changes are bounded by the actor's live database capabilities, including extended actions and indirect target privileges. No Role-name bypass.

## Files created

- `backend/HRM.API/Modules/Authorization/DTOs/AdministrationDtos.cs`: bounded input, safe DTOs, catalog filters, version fields, matrix patch request.
- `backend/HRM.API/Modules/Authorization/Controllers/AdministrationControllers.cs`: ScreensController, UsersController, RolesController, AuthorizationActionsController; no public account endpoint; existing modules reused.
- `backend/HRM.API/Modules/Authorization/Services/AdministrationService.cs`: transaction, shared row lock, live permission checks, delegation bounds, last-admin invariant, strong ETag checks, audit, CRUD, password reset and token revocation.
- `backend/HRM.API/Security/AuthSessionVersion.cs`: JWT session-version validation and server-owned SignalR group key.
- `backend/HRM.API/Migrations/20261026065757_AddUserAuthVersion.cs` and `.Designer.cs`.
- `backend/HRM.API.Tests/AdministrationApiTests.cs`: functional security and CRUD tests.
- `backend/HRM.API.Tests/AdministrationRealtimeTests.cs`: transport version fence and locked account suppression.
- `backend/HRM.API.Tests/AdministrationMigrationTests.cs`: only the intended migration column is added/dropped.
- `docs/HRM_API_EXAMPLES.md`, this report and `docs/administration-auth-version-migration.sql`.

## Files edited

- `Common/BusinessApi.cs`: distinguish administrative PERMISSION_DENIED from employee DATA_SCOPE_DENIED without changing existing scope errors.
- `Modules/Authorization/Entities/User.cs`, `Configurations/UserConfiguration.cs`, `Migrations/AppDbContextModelSnapshot.cs`: map `auth_version`, hidden from JSON; UserId remains varchar100, no schema changes to existing keys/columns.
- `Modules/Auth/Services/AuthService.cs`: return the session version captured during password verification; trusted password-change/reset primitives also increment it. PasswordService/PBKDF2 unchanged.
- `Modules/Auth/Services/JwtService.cs`, `Controllers/AuthController.cs`: issue internal av claim; public Login response remains unchanged; same JWT signing configuration.
- `Program.cs`: management DI, reset rate limiter, ACTIVE + auth_version validation on JWT; middleware authentication → authorization → rate limiting.
- `Modules/Notifications/Realtime/NotificationHub.cs`: session-version group membership and delivery fence so revoked sockets stop receiving subsequent notifications. Same SignalR event and payload; durable/outbox/worker/target resolution unchanged.
- `HRM.API.Tests/AuthenticationApiTests.cs`: include RefreshToken in SQLite fixture for revocation tests.
- `HRM.API.Tests/ApiInventoryTests.cs`: assert52 routes and permission coverage including Administration.
- `HRM.API.Tests/AuthSeederTests.cs`: align stale assertions with existing admin-only Seeder; retain idempotency and preservation of edited password/role/grants. Runtime Seeder not changed.
- `docs/HRM_API_INVENTORY.md`, `docs/HRM_API_SPEC.md`, `docs/HRM-API.postman_collection.json`.

Three documentation deletions seen during implementation were left untouched: `HRM-Authentication.postman_collection.json`, `notification-center-migration.sql`, `notification-center-preflight.sql`. Backup of pre-edit source is outside repository at `/private/tmp/hrm-administration/before.tar.gz`.

## Schema and bootstrap needing approval

Migration `20261026065757_AddUserAuthVersion` adds only:

```sql
ALTER TABLE `users` ADD `auth_version` bigint NOT NULL DEFAULT 0;
```

[Exported SQL](administration-auth-version-migration.sql) also records the migration in __EFMigrationsHistory. No new table/index/FK; no screen/role/employee/notification schema changes. Down removes only auth_version. This is a review artifact, not an instruction to run it now. MySQL DDL may implicitly commit despite the generated transaction wrappers; review backup/rollout separately. Do not deploy this binary before the approved column addition, because Login/token validation now read it. Multi-instance rollout should complete before granting/revoking rights; an old binary will not enforce av checks. Rollback to old binary also removes immediate session revocation guarantees.

Operator must independently approve initial grants on the three existing management screens. At least one ACTIVE account with nonempty stored credential must have the following union of grants, possibly across multiple Roles:

| Screen | Minimum recovery capability |
| --- | --- |
| WEB_USERS | VIEW, UPDATE, APPROVE |
| WEB_ROLES | VIEW, UPDATE |
| WEB_PERMISSIONS | VIEW, UPDATE, APPROVE |

Creation additionally needs the relevant NEW, deletion needs DELETE. Delegating grants requires the actor to already possess each requested screen/action. No bootstrap API, automatic seed or role-name superuser was added. If no recovery account already exists, administration writes fail closed. Bootstrap/recovery is an out-of-band, separately reviewed operator action; select a second custodian, approve exact screen/actions, review changes and retain an audit/change record. Do not grant everything merely because a Role is named ADMIN or ALLROLL. API cannot edit the caller's own assigned Role matrix or own Role membership; use a different authorized custodian. Unknown stored extended actions are retained/read-only until implemented in the central registry; any Role containing them is deliberately not delegatable through this release.

## Session revocation and concurrency

All administration mutations run in a Serializable transaction and lock the existing WEB_PERMISSIONS screen row with a no-op UPDATE before reading permissions/version. ETags are SHA256 of canonical non-secret resource aggregates; GET and mutations return quoted ETag plus version in DTO. Missing If-Match428; stale/wildcard/weak/multiple values412. Concurrent writers using this service cannot overwrite each other's snapshots. Deadlocks/network failures are infrastructure errors requiring a fresh GET and deliberate retry, never blind replay of password reset.

User profile/status/Role/reset changes increment that User's auth_version and revoke unrevoked RefreshToken rows. Matrix/Role/catalog changes do so for affected users, including users of either standard or extended grants. Existing JWTs then fail401 on next request; login returns a new snapshot. Claims missing av accepted only while database version=0. Database grant edits outside these APIs do not automatically bump version: business JWT snapshot can remain valid for up to15 minutes, while administration reads/writes use live grant checks. Direct SQL/other services must adopt the same approved revocation protocol. In-flight requests already authenticated cannot be retroactively cancelled.

SignalR retains canonical sub as UserIdentifier, but delivery targets server-created groups scoped by UserId and session version. An old connection may remain open until normal expiry, but subsequent sends address the current version. Reconnect with fresh token, then resync durable inbox API. FCM remains the existing future phase.

Password reset uses explicit Users/APPROVE, current actor password reauthentication, target capability bound, If-Match, 5 attempts/minute/actor per API instance, audit and access/refresh revocation. New password12..128 characters; no generation or Notification delivery. No MFA, forced-change flag or two-person approval workflow exists in current schema; adding these is a separate review if organizational policy requires them. Do not treat this endpoint as a self-service forgot-password flow.

## Validation performed

Commands run locally:

```sh
dotnet build backend/HRM.API/HRM.API.csproj
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj
dotnet ef migrations has-pending-model-changes --project HRM.API.csproj --startup-project HRM.API.csproj --no-build
dotnet ef migrations script 20261019145341_AddNotificationCenter 20261026065757_AddUserAuthVersion --project HRM.API.csproj --startup-project HRM.API.csproj --no-build --output ../../docs/administration-auth-version-migration.sql
```

EF tooling used a dummy localhost design connection and explicit MySQL8 server version, without connecting to Railway. Final results: **build succeeded, 0 warnings/errors; 167 tests passed, 0 failed/skipped; no pending model changes**. Postman contains52 unique production requests including21 new administration requests. The pre-existing Seeder test failed before alignment with the admin-only source; production Seeder was not changed.

Model and snapshot agree. Tests use SQLite rather than Railway/MySQL; real InnoDB concurrent lock behavior, production role assignments and large-user performance still require an approved DEV integration pass. Reset hashing remains intentionally expensive and bounded by its endpoint rate limiter.

Tests cover missing/invalid JWT, missing/live-revoked grants with old snapshot, ACTIVE/WEB/MOBILE catalog and paging, duplicate screen code, referenced code protection, valid account hash/salt, duplicate ID/email, invalid employee/Role, ETag428/412, audit sanitization, last-admin lock protection, self escalation denial, all6 standard and5 extended actions independently, preserving extended during standard patch, unknown codes, multiple screens/Roles, assignment/reset/matrix revocation, refresh-token revocation, reset reauthentication/rate limit, no reset Notification, rollback on invalid batch, dormant grant reactivation protection, empty Role creation and referenced deletion rejection.

All production endpoints remain under existing JWT/ScreenPermission conventions; only Login is intentionally anonymous. This change introduces no unprotected administrative endpoint.

Reset rate limiting is in-process. A multi-replica deployment needs a reviewed shared/edge rate limit to enforce a cluster-wide quota; no new Redis/database dependency was introduced.

Cross-origin Web: existing CORS policy remains scoped to Notification. Administration works with a same-origin proxy. A separate frontend origin needs an approved CORS policy covering administration routes, PUT/PATCH/DELETE, Authorization/Content-Type/If-Match and exposed ETag; no origin allowlist was invented or changed. Clients may also build quoted If-Match from the safe DTO version field.
