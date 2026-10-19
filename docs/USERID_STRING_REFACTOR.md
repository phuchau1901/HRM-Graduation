# UserId string account-key refactor

This report supersedes the numeric-UserId design in previous migration/rebuild reports. No Railway read/write, database drop, database update or seed was performed in this task.

## Identity and login contract

- User.UserId is the account/login code (admin, hr01, manager01, employee01, employee02). CLR string; users.user_id varchar(100), primary key, ValueGeneratedNever, no AUTO_INCREMENT.
- User.Username and users.username are removed. The separate uq_users_username index is removed; the primary key already guarantees account-code uniqueness. Unique email and optional employee linkage remain.
- AuthService creates/returns string keys and queries by UserId for login/change/reset. AuthProfileService, JWT sub/name, ACTIVE validation and backend screen-policy authorization consume string IDs without long.TryParse.
- New request: `{"userId":"admin","password":"<enter locally>"}`. Legacy request `{"username":"admin","password":"<enter locally>"}` remains accepted. If both aliases are supplied, they must match exactly; otherwise the same generic credential failure is returned and counts toward the rate limit. User IDs are not silently trimmed or normalized.
- Response user DTO now has userId (string), email and employeeId. It no longer has the former numeric id or separate username. Clients reading those response fields must switch to user.userId. Role IDs and Screen IDs remain numeric.

## Dependent foreign keys

All 11 User FK properties are string/string? and have varchar(100)/HasMaxLength(100); prior nullability, column names, constraint names and Restrict delete behavior are retained:

| Entity property | Database column | Nullable |
| --- | --- | --- |
| UserRole.UserID | `user_roles.user_id` | No |
| RefreshToken.UserID | `refresh_tokens.user_id` | No |
| Notification.UserID | `notifications.user_id` | No |
| AuditLog.ActorUserID | `audit_logs.actor_user_id` | Yes |
| ApprovalRequest.RequestedByUserID | `approval_requests.requested_by_user_id` | No |
| ApprovalStep.ApproverUserID | `approval_steps.approver_user_id` | No |
| EmployeeHistory.ChangedByUserID | `employee_histories.changed_by_user_id` | Yes |
| KpiTarget.AssignedByUserID | `kpi_targets.assigned_by_user_id` | No |
| PerformanceReview.ReviewedByUserID | `performance_reviews.reviewed_by_user_id` | No |
| PayrollPeriod.ApprovedByUserID | `payroll_periods.approved_by_user_id` | Yes |
| TimesheetPeriod.ClosedByUserID | `timesheet_periods.closed_by_user_id` | Yes |

All reference users.user_id. UserRole composite PK remains (user_id, role_id). Other entity PKs, Role/Employee/Screen IDs, relations and CSV-aligned types/lengths/precisions are unchanged.

## Authentication and seed

PasswordService, salt handling (including legacy nullable salt), PBKDF2-HMAC-SHA256 600000 rounds, SigningKey configuration, LoginRateLimiter and Y/N permission aggregation are preserved. JWT sub now directly contains the stored string UserId; no numeric conversion is performed. Authorization still reads current database permissions and enforces DEPARTMENTS/View on the backend.

AuthSeeder assigns the five account codes directly as UserId and the same ADMIN/HR/MANAGER/EMPLOYEE roles. Existing account codes are checked for idempotence, and passwords/memberships/RoleDetails are not overwritten. Password secret keys remain AuthSeed:Passwords:admin, hr01, manager01, employee01, employee02. Development + AuthSeed:Enabled gates remain unchanged; no seed was run.

## Initial migration and SQL

- New EF-scaffolded migration: `20261019074710_InitialHRMDatabase`.
- One active migration + designer + EF-generated snapshot. No manual snapshot edits.
- 35 tables, 50 foreign keys, 65 explicit indexes. The previous numeric version had 66 indexes; only the redundant username index was removed.
- All 11 User FKs and the User PK are varchar(100). No username column or user_id AUTO_INCREMENT.
- [Generated SQL](../backend/HRM.API/initial_hrm.sql). SHA256: `9863e2932c22b7b724119b8102cac6221a6d499798251d686f4dc63f43a61f2b`.
- SQL contains schema creation and migration-history insertion, not a data conversion or reset script. No DROP/TRUNCATE/DELETE/UPDATE statement is emitted.
- Existing database still needs an explicitly reviewed empty-schema rebuild plan; this initial migration must not be applied over pre-existing tables. No approval to execute that plan was assumed.

Backups outside the compiled project: [previous numeric migration](backups/migrations-before-string-userid-20261019.tar.gz) and [previous SQL](backups/initial_hrm-before-string-userid-20261019.sql). Full pre-edit source backup: /private/tmp/hrm-string-userid/before.tar.gz (temporary).

## Validation

- dotnet build HRM.API.csproj: passed, 0 warnings/errors.
- dotnet test: 54 passed, 0 failed/skipped. Tests cover string UserId login, username compatibility, conflicting aliases, sub round-trip through /me and backend permissions, account lifecycle, seed, and MySQL migration metadata for all 11 FK lengths/types. SQLite/TestServer only; no Railway access.
- dotnet ef migrations has-pending-model-changes: exit 0, no changes.
- dotnet ef migrations script --output initial_hrm.sql: passed.
- EF CLI host discovery warns about its 5-second timeout in this environment and then uses AppDbContextFactory; commands complete successfully. Temporary process-only dummy localhost/JWT settings disable seed during offline EF work and do not modify actual configuration/secrets.
- PasswordService, LoginRateLimiter and appsettings files are byte-identical to backup.

## Changed/new source files

- EDITED: `backend/HRM.API/Controllers/Auth/AuthController.cs`
- EDITED: `backend/HRM.API/Data/Seeders/AuthSeeder.cs`
- NEW: `backend/HRM.API/Migrations/20261019074710_InitialHRMDatabase.Designer.cs`
- NEW: `backend/HRM.API/Migrations/20261019074710_InitialHRMDatabase.cs`
- EDITED: `backend/HRM.API/Migrations/AppDbContextModelSnapshot.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Configurations/RefreshTokenConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Auth/DTOs/AuthDtos.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Entities/RefreshToken.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Services/AuthProfileService.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Services/AuthService.cs`
- EDITED: `backend/HRM.API/Modules/Auth/Services/JwtService.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Configurations/UserConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Configurations/UserRoleConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Entities/User.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Entities/UserRole.cs`
- EDITED: `backend/HRM.API/Modules/Authorization/Policies/ScreenPermission.cs`
- EDITED: `backend/HRM.API/Modules/Employees/Configurations/EmployeeHistoryConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Employees/Entities/EmployeeHistory.cs`
- EDITED: `backend/HRM.API/Modules/Leave/Configurations/ApprovalRequestConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Leave/Configurations/ApprovalStepConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Leave/Entities/ApprovalRequest.cs`
- EDITED: `backend/HRM.API/Modules/Leave/Entities/ApprovalStep.cs`
- EDITED: `backend/HRM.API/Modules/Payroll/Configurations/PayrollPeriodConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Payroll/Configurations/TimesheetPeriodConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Payroll/Entities/PayrollPeriod.cs`
- EDITED: `backend/HRM.API/Modules/Payroll/Entities/TimesheetPeriod.cs`
- EDITED: `backend/HRM.API/Modules/Performance/Configurations/KpiTargetConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Performance/Configurations/PerformanceReviewConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/Performance/Entities/KpiTarget.cs`
- EDITED: `backend/HRM.API/Modules/Performance/Entities/PerformanceReview.cs`
- EDITED: `backend/HRM.API/Modules/System/Configurations/AuditLogConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/System/Configurations/NotificationConfiguration.cs`
- EDITED: `backend/HRM.API/Modules/System/Entities/AuditLog.cs`
- EDITED: `backend/HRM.API/Modules/System/Entities/Notification.cs`
- EDITED: `backend/HRM.API/Program.cs`
- EDITED: `backend/HRM.API/initial_hrm.sql`
- EDITED: `backend/HRM.API.Tests/AuthSeederTests.cs`
- EDITED: `backend/HRM.API.Tests/AuthServiceTests.cs`
- EDITED: `backend/HRM.API.Tests/AuthenticationApiTests.cs`

The previous 20261019073549 numeric migration/designer were removed from active source only after backup and successful build; their snapshot was replaced by EF scaffolding. The Postman collection now uses userId as the primary request field; username remains supported for existing clients.

## Review boundary

Review this report, new migration and SQL first. No database destruction/application or seeding will be performed until the user explicitly confirms. For existing data, mapping old numeric IDs to account codes would require a separately designed data migration; the prepared artifact is an empty-database initial schema.
