# Employee data scope

Scope is resolved from active user + assigned Role + active Screen + Action. The six standard grants remain Y/N in role_details. role_screen_actions.data_scope is metadata for those actions, never a grant. Extended Notification actions retain their existing explicit row grants; NULL scope is permitted when the operation does not use scoped data.

Only roles granting the same screen/action contribute scope. Effective union is ALL > DEPARTMENT > SELF. Missing/NULL/unknown scope contributes nothing; if no eligible scope remains the service returns 403. No ADMIN bypass or UserId configuration fallback exists.

SELF reads only the linked employee; all writes are forbidden until field-level rules exist. DEPARTMENT reads/writes employees in the actor's current linked department. Missing employee/department fails closed. ALL allows cross-department work; department transfer additionally requires ALL.

Employees list/detail/history use WEB_EMPLOYEES/VIEW. Create uses NEW; profile update and transfer use UPDATE; deactivate uses DELETE. Contract reads use WEB_CONTRACTS/VIEW; create uses NEW and update uses UPDATE, independently of employee-screen permissions.

## Permission API specification

GET /api/roles/{id}/permissions returns existing screen properties plus `dataScopes`, a dictionary from action code to SELF, DEPARTMENT, ALL or null. `extendedActions` contains only the five extended codes, never standard scope rows. Version/ETag includes scopes.

PUT uses existing authentication, UPDATE + APPROVE permissions, If-Match concurrency, audit and anti-self-edit rules. Each screen patch accepts optional `dataScopes`. Omitted dictionary/keys retain old values; explicit null clears the scope. Invalid action/scope is 400. Actor must possess at least the requested scope for the same action; broadening beyond the actor is 403. Extended scope metadata requires an existing or simultaneously granted extended action. Omitted extendedActions preserves Notification grants; supplying it explicitly replaces extended grants only. Scope changes revoke refresh tokens and increment auth_version for all assigned users in the same transaction.

Example: [JSON sample](../../API/role-permissions-data-scope.sample.json).

## Review and conversion

No runtime database or deployed configuration was inspected or changed. Old EmployeeDataScopes.Users is configuration, not a database table; no automatic safe migration can infer per-action role grants from it. The new runtime ignores this mapping.

Before rollout, export the approved legacy mapping, current user-role assignments, employee links/departments and per-screen grants in a controlled environment. Produce proposals per role/screen/action and compare every affected user, including users without an explicit legacy entry (previously SELF). Shared roles may include users with different scopes; assigning the maximum would widen their access. Split roles or obtain explicit approval instead. An ALL legacy user is not approval to give every user in their roles ALL. Missing employee links and department changes also need review. Keep all proposed ALL grants pending explicit approval.

The schema migration adds nullable metadata only and copies no grants. Existing scoped employee endpoints will deny until approved scopes are configured. Plan a coordinated rollout; do not silently default scopes. Re-login is required after permission changes. Direct SQL permission backfills must also revoke refresh tokens and increment auth_version in a reviewed transaction; prefer the permission API.

Review SQL: [schema SQL](../../API/role-action-data-scope.review.sql). No migration has been applied. MySQL DDL may auto-commit; schedule separately from data backfill. Rollback drops metadata and requires coordinated application rollback; it does not restore legacy configuration automatically.
