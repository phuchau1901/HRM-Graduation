# Contract statistics — API specification and audit

[Contracts API](CONTRACTS_API.md) · [Data Scope](DATA_SCOPE.md) · [API inventory](../../API/README.md)

## Audit

- Existing controller: EmployeeContractsController, nested routes `/api/employees/{employeeId:int}/contracts` and `/{id:long}`. No global statistics route or equivalent service existed in this checkout.
- Entity: Modules/Employees/Entities/Contract; AppDbContext maps it to `contracts`. Fields: ID → id (bigint), EmployeeID → employee_id (int), ContractType → contract_type (varchar(30)), StartDate → start_date (date), EndDate → end_date (nullable date), Status → status (varchar(20)).
- ContractType references contract_types.code; contract types may be configured or retired. Statistics does not infer duration from type codes: EndDate=null denotes no fixed end date.
- There is no status enum. ContractRequest validates DRAFT/ACTIVE/EXPIRED/TERMINATED/CANCELLED, and EmployeeService enforces lifecycle rules. Statistics explicitly accepts ACTIVE/EXPIRED only; unknown legacy states are not counted.
- No existing React Contracts page or mock statistics implementation was present in this checkout. Added Contracts.jsx and the hash route `/#/hr/contracts` to the existing React workspace. No external frontend was accessed or changed.
- No schema/index change or migration is required by statistics. Existing contract date validation now uses the same VietnamBusinessDate/TimeProvider helper as statistics, avoiding a different business day near UTC/Vietnam midnight.

## GET /api/contracts/statistics

`GET /api/contracts/statistics?expiringWithinDays=30`

JWT and `WEB_CONTRACTS / VIEW` are required. Query expiringWithinDays is integer 1..365, default 30. Invalid/empty/non-numeric/out-of-range values return 400.

```json
{
  "success": true,
  "data": {
    "active": 0,
    "expiringSoon": 0,
    "expired": 0,
    "expiringWithinDays": 30,
    "asOfDate": "2026-11-16"
  }
}
```

Counts are numbers, not strings. They count contracts, not distinct employees. A permitted request with no visible contracts returns actual zeros. Failures retain the existing error format; they never masquerade as success with zero data. Response caching is disabled (no-store).

## Classification

Let T=asOfDate and cutoff=T+N calendar days. Today and cutoff are inclusive for expiringSoon: remaining days in [0,N]. All eligible contracts must have StartDate<=T.

| Group | Status | Date conditions |
| --- | --- | --- |
| active | ACTIVE | EndDate is null, or EndDate > cutoff |
| expiringSoon | ACTIVE | T <= EndDate <= cutoff |
| expired | ACTIVE or EXPIRED | EndDate < T |

DRAFT, CANCELLED and TERMINATED are excluded regardless of dates. Future StartDate is excluded from every group. EXPIRED with a missing or future EndDate is not counted. No contract can belong to more than one group. An overdue ACTIVE contract is counted as expired even before a separate lifecycle update changes its status; statistics does not mutate statuses.

asOfDate is captured once per request from injected TimeProvider.GetUtcNow converted to `Asia/Ho_Chi_Minh`. It does not use the server's local date or DateOnly.FromDateTime(DateTime.UtcNow). Audit timestamps remain UTC.

## RBAC and Data Scope

Uses the same live WEB_CONTRACTS/VIEW scope through EmployeeDataScope as the existing contract list/detail API. It does not depend on WEB_EMPLOYEES or WEB_CONTRACT_TYPES grants.

- SELF: contracts owned by the user's linked employee only.
- DEPARTMENT: contracts of employees in the linked employee's department.
- ALL: contracts of all employees.
- No linked employee under SELF/DEPARTMENT yields zeros; ALL is effective only when explicitly granted.
- Missing JWT: 401. Missing VIEW grant or live action scope: 403. There is no implicit ADMIN bypass.
- Multiple roles use the existing permission service's widest eligible granted scope. An ALL scope row on a role without CanView=Y does not broaden access. Roles are not joined to aggregate rows, so multiple grants do not duplicate counts.

## Query and routing

ContractsController declares the literal `/api/contracts/statistics` route; no root `/{id}` route exists. Existing nested detail routes have long constraints and a different prefix. API inventory checks route uniqueness.

ContractStatisticsService first applies employee scope, joins contracts to visible employees, then uses a single GroupBy/conditional Count SQL aggregate for all three numbers. Only one result row is materialized; there is no contract enumeration or per-contract query. Existing permission-resolution queries are fixed in number. Contract types and attachments are not loaded. Tests also translate the aggregate using the MySQL provider without a live database connection.

## Frontend

- Route `/#/hr/contracts` and navigation require WEB_CONTRACTS/VIEW.
- Loads `/api/contracts/statistics?expiringWithinDays=N` on entry, on window changes, on retry and after successful create/update/extension/termination.
- Shows a loading skeleton before each statistics response. On a failed or malformed response it removes stale counts and displays an error with retry; no mock values or fallback zeros are rendered.
- Existing employee-specific list and POST/PUT endpoints manage contracts. Open the page from an employee's “Hợp đồng” action or enter the employee ID. The statistics cover the full permitted scope, not only the selected employee.
- Extension edits EndDate through existing PUT. Termination uses existing PUT/TERMINATED. Closed contracts have no edit action. All writes remain subject to server lifecycle and scope validation. Successful mutations reload both the selected employee list and statistics; failed writes show the error without pretending to have succeeded.
- Optional type dropdown uses WEB_CONTRACT_TYPES/VIEW; users without that grant may enter a known type code. Contract APIs continue to validate the selected active code.

## Tests

ContractStatisticsTests covers indefinite duration, future starts, today/cutoff inclusion, past end dates, inactive lifecycle states, malformed legacy statuses, zero results, query bounds, Vietnam midnight, contract date validation, SELF/DEPARTMENT/ALL, missing grants/scope, unlinked users, multiple roles, bounded SQL aggregate queries and offline MySQL translation. Contracts.test.jsx covers skeletons, real zeros, malformed/failed responses, retries, RBAC, and refetch after all four mutation paths.

No database migration was applied and no deployment was performed.

Validation (2026-11-16): `dotnet build backend/HRM.API/HRM.sln --no-restore` succeeded with zero warnings/errors; full `dotnet test` completed with 326 passed and 9 pre-existing EmployeeCreationTests failures (NV expectations versus the unchanged TX code prefix). All 20 ContractStatisticsTests passed, including the contract-write Vietnam-date regression. React tests: 31/31 passed. `npm run build` succeeded. API/Postman JSON examples and git diff whitespace checks passed. No migration or deployment was performed.
