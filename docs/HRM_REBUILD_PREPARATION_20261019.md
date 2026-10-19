# HRM rebuild preparation - 2026-10-19

Current identity/schema design is now string UserId; see [USERID_STRING_REFACTOR.md](USERID_STRING_REFACTOR.md). Numeric UserId and response-id statements below are historical.

Status: SOURCE AND SQL READY FOR REVIEW. NO DATABASE REBUILD OR SEED EXECUTED.

## Target verified read-only

- Configured endpoint: `reseau.proxy.rlwy.net:20769`. Database: `railway`.
- Server version: `8.4.11`. The connection was obtained through the existing AppDbContextFactory/user-secrets/environment settings. No password/connection string was printed or changed.
- Actual applied migration: `20261019072502_InitialHRMDatabase`, EF `8.0.13`. This differs from older conversation assumptions.
- Actual schema: 35 business tables plus __EFMigrationsHistory. It already contains screens/role_details, and users still has PK id. All 11 deployed user foreign keys currently reference users.id.
- TABLE_ROWS metadata reported 0 for business tables and 1 for history, but InnoDB estimates are not an exact empty-data guarantee. No business records were selected or exact counts collected.
- Full sanitized audit: [RAILWAY_READONLY_AUDIT_20261019.json](RAILWAY_READONLY_AUDIT_20261019.json).
- This confirms the currently configured endpoint, not its business label. Verify it is the intended DEV service before authorizing destruction.

## Source refactor

- Added User.UserId (long) as the sole User primary key and mapped users.user_id bigint AUTO_INCREMENT. Removed all runtime references to the obsolete User.ID. User.EmployeeId is nullable and remains mapped to employee_id.
- Updated AuthService account creation/login/change/reset, AuthProfileService, AuthSeeder and JWT ACTIVE-account validation to use UserId.
- AuthUserDto now uses the C# name UserId, with JsonPropertyName("id") to preserve the existing HTTP JSON contract. JwtService uses profile.User.UserId for sub. Role.Id/Role.ID, Screen.ID and Employee.Id were not renamed.
- Dependent FK property names (UserID, RequestedByUserID, etc.) and their column names remain stable; EF now resolves their principal key to users.user_id.
- Preserved all previously CSV-aligned lengths, numeric precision, JSON/date/time types, defaults, nullability and case. Salt remains varchar(44) nullable for supported legacy credentials. New writes through PasswordService always generate a fresh nonempty 32-byte salt.
- PasswordService and LoginRateLimiter are byte-identical to the pre-refactor backup: PBKDF2-HMAC-SHA256, 600000 rounds, bounded legacy support, random salt, fixed-time comparisons, 5/client/minute and 30/instance/minute.
- Restored the full five-account/four-role seed set requested by the task; the starting source only had admin. Removed the duplicate seed invocation from Program; the remaining call is Development + AuthSeed:Enabled only. Existing accounts/passwords/memberships/RoleDetails remain untouched.

## Backend authorization

Added Modules/Authorization/Policies/ScreenPermission.cs: dynamic policy provider, RequireScreenPermission attribute, ScreenAction enum and database-backed handler for New/View/Update/Delete/Approve/Export. Grants remain additive Y across assigned roles, absent/invalid flags deny, inactive users/screens deny, and there is no implicit ADMIN bypass. Role changes/revocations are read from the database on each protected request instead of relying on stale JWT role claims.

GET /api/departments now requires DEPARTMENTS/View on the backend. Anonymous calls get 401, authenticated users without Y get 403. Auth /me routes still require a valid active account without an extra screen permission. Future business endpoints can use:

```csharp
[RequireScreenPermission("EMPLOYEES", ScreenAction.Update)]
```

Only this existing business controller was protected; no unrequested employee/payroll APIs were created. Screen SupportedActions remains metadata for the current six permission flags; no additional arbitrary function-permission schema was invented.

## Migration and SQL

The source initially contained an already regenerated 20261019072502_InitialHRMDatabase and snapshot. Both were backed up before replacement. Backend build passed before old migration C# sources were removed. A new migration and snapshot were scaffolded with EF, without manually editing the generated snapshot.

- New migration: `20261019073549_InitialHRMDatabase`.
- Exactly one migration in backend/HRM.API/Migrations, with its designer and one model snapshot.
- 35 CreateTable, 66 CreateIndex, 50 FK definitions. No duplicate table names, longtext columns or decimal(65,30).
- Model snapshot matches current model: has-pending-model-changes reports no changes.
- New SQL: [initial_hrm.sql](../backend/HRM.API/initial_hrm.sql).
- SQL SHA256: `3dc7720b599a8d034e18e45dafa793ba409cec800bd8de0b9f76bcd001d02a0f`.
- SQL creates the 35 business tables plus EF migration history and inserts the new migration ID into history. It contains no DROP/TRUNCATE/DELETE/UPDATE statement; ON DELETE clauses only declare FK behavior. It was generated, not executed.
- SQL and the new initial migration target an EMPTY schema. Do not run them over the existing Railway schema: matching table names and a different applied initial migration ID would cause collisions. New source also requires users.user_id and is intentionally incompatible with the still-unmodified users.id database until the approved rebuild.

| Module | Tables in new initial migration |
| --- | --- |
| Attendance | `attendance_adjustments`, `attendance_requests`, `attendances`, `qr_sessions`, `shifts`, `work_schedules` |
| Auth | `refresh_tokens` |
| Authorization | `role_details`, `roles`, `screens`, `user_roles`, `users` |
| Employees | `contracts`, `employee_histories`, `employees` |
| Leave | `approval_requests`, `approval_steps`, `leave_balances`, `leave_requests`, `leave_types`, `overtime_requests` |
| Organization | `departments`, `positions` |
| Payroll | `payroll_details`, `payroll_periods`, `salary_profiles`, `timesheet_details`, `timesheet_periods` |
| Performance | `kpi_criteria`, `kpi_results`, `kpi_targets`, `kpi_templates`, `performance_reviews` |
| System | `audit_logs`, `notifications` |

## Keys, indexes and relationships

- users: PK user_id; unique username, email, employee_id (nullable). The unique employee FK enforces at most one account per employee.
- user_roles: composite PK (user_id, role_id), two Restrict FKs; supports many roles per user.
- role_details: composite PK (role_id, screen_id); Cascade FKs to roles/screens; six varchar(1) flags default N.
- screens: unique code, self parent FK Restrict, index parent_id, supported_actions JSON.
- employees.DepartmentId -> departments.Id: Restrict; their lower-case table names and mixed-case columns remain unchanged.
- attendances.schedule_id and performance_reviews.target_id have unique indexes, enforcing one attendance/review per referenced schedule/target. Other existing 1:N relationships and delete behavior are retained.
- All 11 FKs to users use principal column user_id and Restrict. Their dependent columns are:

- `approval_requests.requested_by_user_id` -> `users.user_id` (deployed schema currently uses id).
- `approval_steps.approver_user_id` -> `users.user_id` (deployed schema currently uses id).
- `audit_logs.actor_user_id` -> `users.user_id` (deployed schema currently uses id).
- `employee_histories.changed_by_user_id` -> `users.user_id` (deployed schema currently uses id).
- `kpi_targets.assigned_by_user_id` -> `users.user_id` (deployed schema currently uses id).
- `notifications.user_id` -> `users.user_id` (deployed schema currently uses id).
- `payroll_periods.approved_by_user_id` -> `users.user_id` (deployed schema currently uses id).
- `performance_reviews.reviewed_by_user_id` -> `users.user_id` (deployed schema currently uses id).
- `refresh_tokens.user_id` -> `users.user_id` (deployed schema currently uses id).
- `timesheet_periods.closed_by_user_id` -> `users.user_id` (deployed schema currently uses id).
- `user_roles.user_id` -> `users.user_id` (deployed schema currently uses id).

## Backups and files

Persistent backups (outside the compiled project):

- [Migration source archive](backups/migrations-before-rebuild-20261019.tar.gz).
- [Previous initial SQL](backups/initial_hrm-before-rebuild-20261019.sql).
- [Previous pending SQL](backups/pending_migrations-before-rebuild-20261019.sql).

Full source-before archive: `/private/tmp/hrm-rebuild-preparation/source.before.tar.gz` (temporary). Existing user-created backend/Migrations_backup_20261019_142445 was left intact. Backups are not a database data backup.

Created/modified source, tests and SQL:

- EDITED: `backend/HRM.API/Data/Seeders/AuthSeeder.cs`
- NEW: `backend/HRM.API/Migrations/20261019073549_InitialHRMDatabase.Designer.cs`
- NEW: `backend/HRM.API/Migrations/20261019073549_InitialHRMDatabase.cs`
- EDITED: `backend/HRM.API/Migrations/AppDbContextModelSnapshot.cs`
- EDITED: `backend/HRM.API/Modules/Auth/DTOs/AuthDtos.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Services/AuthProfileService.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Services/AuthService.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Services/JwtService.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Configurations/UserConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Entities/User.cs`
- NEW: `backend/HRM.API/Modules/Authorization/Policies/ScreenPermission.cs`
- EDITED: `backend/HRM.API/Modules/Organization/Controllers/DepartmentsController.cs`
- EDITED: `backend/HRM.API/Program.cs`
- EDITED: `backend/HRM.API/initial_hrm.sql`
- EDITED: `backend/HRM.API.Tests/AuthSeederTests.cs`
- EDITED: `backend/HRM.API.Tests/AuthServiceTests.cs`
- EDITED: `backend/HRM.API.Tests/AuthenticationApiTests.cs`
- NEW: `backend/HRM.API.Tests/SqliteTestModel.cs`

Removed from active source after backup: 20261019072502_InitialHRMDatabase.cs, its designer and the old snapshot (the snapshot path now contains the EF-generated replacement). pending_migrations.sql was archived to docs/backups to prevent using obsolete SQL. Other pre-existing Git changes were preserved.

## Validation

- dotnet restore HRM.API.csproj: passed.
- dotnet build HRM.API.csproj: passed, 0 warnings, 0 errors.
- dotnet ef migrations list --no-connect: exactly the new initial migration. This offline listing does not claim applied status; the separate read-only Railway query established the applied old ID above.
- dotnet ef migrations has-pending-model-changes: exit 0, no changes.
- dotnet ef migrations script --output initial_hrm.sql: passed.
- 53 tests passed, 0 failed/skipped: hashing, legacy upgrade/concurrent reset, account lifecycle, seed guards/idempotence, JWT/ACTIVE validation, current role permissions, backend grant/revoke, and full MySQL migration metadata.
- SQLite tests override only auto-generated integer PK SQL spelling to INTEGER because SQLite cannot AUTOINCREMENT bigint. The production MySQL migration/types are validated separately, unchanged by this test-only adaptation.
- EF CLI host discovery times out in this environment and falls back to the existing AppDbContextFactory. Commands completed successfully. Offline EF commands used a temporary localhost dummy connection, random temporary JWT key and Production/seed-disabled process settings; actual secrets/configuration were not rewritten.
- No server DDL/DML, migration application or AuthSeeder invocation was performed. Railway access consisted solely of SELECT queries against database/version metadata, table metadata, migration history, users column metadata and FK metadata.

## Next steps - ONLY after explicit rebuild confirmation

1. Review this report, the generated initial SQL and the exact DEV endpoint above. Take a real database backup including data, schema, history and any routines/triggers outside the EF model.
2. Approve the destruction scope: the 35 existing business tables listed above plus __EFMigrationsHistory in this configured DEV database. None have been deleted now.
3. After approval, execute a separately reviewed reset plan leaving an empty target schema. Rebuild from the NEW initial migration or its SQL, not both. Do not attempt to upgrade the existing applied initial migration by simply running database update against its current tables.
4. Commands for the already-approved empty target (not executed during this task):

```sh
dotnet ef database update --project backend/HRM.API/HRM.API.csproj --startup-project backend/HRM.API/HRM.API.csproj
```

5. Verify all 35 tables, 11 users.user_id FKs and new migration history; coordinate JWT key rotation/session invalidation before re-enabling old clients because regenerated numeric user IDs might be reused. No key was changed in this task.
6. Configure five AuthSeed:Passwords:<username> values in user-secrets and the existing JWT options. Never commit or print the values. Then, after approval to seed the rebuilt DEV database:

```sh
ASPNETCORE_ENVIRONMENT=Development AuthSeed__Enabled=true dotnet run --no-launch-profile --project backend/HRM.API
```

7. Disable the seed flag for normal starts. Test /api/auth/login, /me, /me/permissions and the protected Departments endpoint with the existing Postman collection.

## Separate screen-permission seed proposal

No screen/RoleDetail seed exists yet; AuthSeeder does not grant permissions. Therefore demo users may log in but get all N/empty permissions and 403 on Departments until rights are explicitly configured. Proposed next step, requiring matrix review: a separate AuthorizationSeeder, gated by Development + its own opt-in flag, adding only missing screens/details and never overwriting edited Y/N values.

Suggested DEV-only starting matrix (proposal, NOT written to database):

| Screen | ADMIN | HR | MANAGER | EMPLOYEE |
| --- | --- | --- | --- | --- |
| DEPARTMENTS | all six actions Y | View Y | View Y | all N |
| EMPLOYEES | all six actions Y | View/New/Update/Export Y | all N pending team scope | all N pending own-data scope |
| ATTENDANCE, LEAVE, PAYROLL, PERFORMANCE | all supported actions Y | all N pending business matrix | all N pending team scope | all N pending own-data scope |

Keep only actions actually supported by each screen. Department/team/own-record filtering is a separate requirement before broad manager/employee grants. Current handler enforces screen/action rights but does not introduce unrequested row-level HR business rules.

Rebuild is paused at the requested review boundary. No approval for database destruction or writes is inferred from this source-preparation task.
