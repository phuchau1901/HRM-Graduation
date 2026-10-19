# CSV column alignment report

Current rebuild preparation supersedes the older migration/User ID assumptions below: [HRM_REBUILD_PREPARATION_20261019.md](HRM_REBUILD_PREPARATION_20261019.md).

Source: `/Users/phuchau/Downloads/HRM_DB_COLUMNS.csv`. No matching file existed in `backend/HRM.API`. The CSV was treated as schema data, never executable instructions.

220 rows cover 34 tables: 218 business columns across 33 tables, plus two EF migration-history columns. All 218 business columns have an existing Entity property. __EFMigrationsHistory.MigrationId/ProductVersion are managed by EF; no business Entity was created for them.

Full per-column property mapping, old/new type, precision, length, nullability, defaults and configuration path: [HRM_CSV_COLUMN_MAPPING.csv](HRM_CSV_COLUMN_MAPPING.csv).

## Changes

Updated 33 existing configurations with explicit HasColumnName/HasColumnType/HasMaxLength/HasPrecision/IsRequired/default mappings from CSV. Exact table/column casing is preserved, including mixed-case departments/employees columns. PK/FK/index configuration chains are unchanged.

Two entity changes: User.Salt is now string? matching varchar(44) NULL with no database default; LeaveBalance.YearNo is short matching smallint. No entity properties were removed.

Columns with material metadata differences (other mapped columns were made explicit without changing their effective facets):

| Table | Changed columns |
| --- | --- |
| `approval_requests` | `request_type`, `status` |
| `approval_steps` | `decision`, `comment` |
| `attendance_adjustments` | `reason`, `status` |
| `attendance_requests` | `request_key`, `operation` |
| `attendances` | `status` |
| `audit_logs` | `action`, `entity_type`, `entity_id`, `before_json`, `after_json` |
| `contracts` | `contract_no`, `contract_type`, `status`, `attachment_url` |
| `employee_histories` | `reason` |
| `kpi_criteria` | `code`, `name`, `weight_percent`, `max_score` |
| `kpi_results` | `self_score`, `manager_score`, `comment` |
| `kpi_targets` | `period_key`, `status` |
| `kpi_templates` | `code`, `name`, `period_type`, `status` |
| `leave_balances` | `year_no`, `entitled_days`, `used_days`, `reserved_days` |
| `leave_requests` | `requested_days`, `reason`, `status` |
| `leave_types` | `code`, `name` |
| `notifications` | `title`, `content` |
| `overtime_requests` | `requested_hours`, `approved_hours`, `status` |
| `payroll_details` | `base_salary`, `allowances`, `overtime_pay`, `kpi_bonus`, `deductions`, `net_salary`, `calculation_snapshot` |
| `payroll_periods` | `period_key`, `status` |
| `performance_reviews` | `final_score`, `rating` |
| `positions` | `code`, `name` |
| `qr_sessions` | `location_code`, `nonce_hash`, `status` |
| `refresh_tokens` | `token_hash` |
| `roles` | `code`, `name` |
| `salary_profiles` | `base_salary`, `allowance_amount`, `currency_code` |
| `shifts` | `code`, `name`, `start_time`, `end_time` |
| `timesheet_details` | `worked_days`, `paid_leave_days`, `overtime_hours` |
| `timesheet_periods` | `period_key`, `status` |
| `users` | `username`, `email`, `password_hash`, `status` |
| `work_schedules` | `status`, `unique_work_key` |

All decimal(18,2) fields use HasPrecision(18,2); the other CSV precisions 5,2 / 7,2 / 8,2 / 9,2 are mapped individually. JSON, char(64), char(7), char(3), time, datetime(6), and varchar lengths follow the CSV. varchar(255) is retained only where actually specified, such as employees.Email/users.email.

## Unresolved evidence

- screens and role_details are absent from CSV. Git HEAD and --all history have no committed Screen/RoleDetail entity/configuration originals, and existing migrations/snapshot do not include these tables. Their current entity/configuration files were preserved unchanged; no replacement schema was guessed.
- CSV lacks FK definitions, delete behavior, full index names/order/composite definitions, check constraints, charset and collation. Existing relationships/indexes are preserved, but their deployed equivalence cannot be established from this file alone.
- approval_requests.request_type and attendances.check_in_at have MUL in CSV but no model index beginning with those columns. No index was invented. A full index/schema export is needed to determine their actual definitions.
- CSV includes 33 business tables and users.salt, which differs from earlier assumptions about migration application state. It does not establish which migration IDs are applied; that requires a separate authorized migration-history check.

## Migration safety

No migration/snapshot changes, migration creation, database update, SQL execution or Railway connection. Existing migrations will differ from this CSV-aligned model; a model-vs-snapshot diff must not be interpreted as proof that the real database needs ALTER operations. In particular, the existing AddUserSalt migration describes longtext NOT NULL while CSV proves varchar(44) NULL: do not blindly apply it if the column already exists.

Connection strings, JWT, controllers/services and unrelated business code were untouched. Backup: `/private/tmp/hrm-csv-alignment/before.tar.gz`.

## Validation

- dotnet build backend/HRM.API/HRM.API.csproj: passed, zero warnings/errors.
- EF Core/Pomelo model loaded entirely in memory: all 218 business columns match CSV for name/type/length/precision/scale/nullability/default/identity.
- All pre/post FK/index metadata is identical. PK/FK/index configuration chains are preserved.
- Migration/snapshot files and Screen/RoleDetail configurations are byte-identical to backup.
- No live database tests were performed.

## Source files changed

- `backend/HRM.API/Modules/Leave/Configurations/ApprovalRequestConfiguration.cs`
- `backend/HRM.API/Modules/Leave/Configurations/ApprovalStepConfiguration.cs`
- `backend/HRM.API/Modules/Attendance/Configurations/AttendanceAdjustmentConfiguration.cs`
- `backend/HRM.API/Modules/Attendance/Configurations/AttendanceRequestConfiguration.cs`
- `backend/HRM.API/Modules/Attendance/Configurations/AttendanceConfiguration.cs`
- `backend/HRM.API/Modules/System/Configurations/AuditLogConfiguration.cs`
- `backend/HRM.API/Modules/Employees/Configurations/ContractConfiguration.cs`
- `backend/HRM.API/Modules/Organization/Configurations/DepartmentConfiguration.cs`
- `backend/HRM.API/Modules/Employees/Configurations/EmployeeHistoryConfiguration.cs`
- `backend/HRM.API/Modules/Employees/Configurations/EmployeeConfiguration.cs`
- `backend/HRM.API/Modules/Performance/Configurations/KpiCriterionConfiguration.cs`
- `backend/HRM.API/Modules/Performance/Configurations/KpiResultConfiguration.cs`
- `backend/HRM.API/Modules/Performance/Configurations/KpiTargetConfiguration.cs`
- `backend/HRM.API/Modules/Performance/Configurations/KpiTemplateConfiguration.cs`
- `backend/HRM.API/Modules/Leave/Configurations/LeaveBalanceConfiguration.cs`
- `backend/HRM.API/Modules/Leave/Configurations/LeaveRequestConfiguration.cs`
- `backend/HRM.API/Modules/Leave/Configurations/LeaveTypeConfiguration.cs`
- `backend/HRM.API/Modules/System/Configurations/NotificationConfiguration.cs`
- `backend/HRM.API/Modules/Leave/Configurations/OvertimeRequestConfiguration.cs`
- `backend/HRM.API/Modules/Payroll/Configurations/PayrollDetailConfiguration.cs`
- `backend/HRM.API/Modules/Payroll/Configurations/PayrollPeriodConfiguration.cs`
- `backend/HRM.API/Modules/Performance/Configurations/PerformanceReviewConfiguration.cs`
- `backend/HRM.API/Modules/Organization/Configurations/PositionConfiguration.cs`
- `backend/HRM.API/Modules/Attendance/Configurations/QRSessionConfiguration.cs`
- `backend/HRM.API/Modules/Auth/Configurations/RefreshTokenConfiguration.cs`
- `backend/HRM.API/Modules/Authorization/Configurations/RoleConfiguration.cs`
- `backend/HRM.API/Modules/Payroll/Configurations/SalaryProfileConfiguration.cs`
- `backend/HRM.API/Modules/Attendance/Configurations/ShiftConfiguration.cs`
- `backend/HRM.API/Modules/Payroll/Configurations/TimesheetDetailConfiguration.cs`
- `backend/HRM.API/Modules/Payroll/Configurations/TimesheetPeriodConfiguration.cs`
- `backend/HRM.API/Modules/Authorization/Configurations/UserRoleConfiguration.cs`
- `backend/HRM.API/Modules/Authorization/Configurations/UserConfiguration.cs`
- `backend/HRM.API/Modules/Attendance/Configurations/WorkScheduleConfiguration.cs`
- `backend/HRM.API/Modules/Authorization/Entities/User.cs`
- `backend/HRM.API/Modules/Leave/Entities/LeaveBalance.cs`
