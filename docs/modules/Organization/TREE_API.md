# Organization Tree — audit and API specification

## Audit (2026-11-16)

- `Department` → `Team` → `Employee` already exists. Employee.DepartmentId is required; TeamId and PositionId are nullable. Position uses a bigint key; other entities use int keys.
- Employee's composite `(TeamId, DepartmentId)` FK references Team `(Id, DepartmentId)`, preventing cross-department team assignment. Existing CRUD: `/api/departments`, `/api/teams`, `/api/positions`, `/api/employees`; employee detail already enforces scope.
- No existing manager/lead columns. New nullable `departments.ManagerEmployeeId` and `teams.LeadEmployeeId` reference employees.Id with RESTRICT deletion. The EF migration must be reviewed and applied separately by an operator. No database update or Railway deployment is part of this change.
- React source in this checkout is `web-admin` with Employees, Settings and Attendance pages; it does **not** contain the described Intelex Organization screen or its three tabs. Added Organization using existing workspace CSS/components, with Phòng ban, Teams and Chức vụ tabs. Existing pages stay available. Exact parity with an external Intelex frontend cannot be verified from this checkout.

## Authorization and visibility

Tree requires only `WEB_ORGANIZATION / VIEW` plus JWT. It returns all Department/Team metadata without Organization or Team DataScope filtering. Employee counts, manager/lead identities and unassigned counts use the live `WEB_EMPLOYEES / VIEW` scope, matching member lists. Missing Employee access/scope yields zero employee counts and null manager/lead identities, while structural nodes remain visible.

Team members and unassigned members require `WEB_ORGANIZATION / VIEW` and `WEB_EMPLOYEES / VIEW`, with configured `WEB_EMPLOYEES / VIEW` DataScope (SELF/DEPARTMENT/ALL). No Organization/Team DataScope or WEB_DEPARTMENTS/WEB_TEAMS grant is required. Employee filtering happens before counts and pagination. Existing CRUD and full employee profiles retain their own permissions.

Department and Team metadata is visible with WEB_ORGANIZATION/VIEW, regardless of employee membership. Departments with no teams and teams with no employees remain in the tree. Employee Data Scope applies to identities and employee counts:

- ALL: all employees.
- DEPARTMENT: employees in the linked employee's department.
- SELF: only the linked employee; without a linked employee, visible employee counts are zero.
- Managers/leads outside employee scope or without an assignment return null; the frontend leaves their names blank.
- TeamCount includes all real teams under a department; it excludes the virtual unassigned group. EmployeeCount and UnassignedCount count only scoped employees.
- Existing member groups return 200 with an empty page when no employees are visible. Unknown group IDs return 404. Invalid paging returns 400. Responses use Cache-Control no-store. Profile links use the existing scoped employee detail endpoint.

## GET /api/organization/tree

200 JSON array, no employee member collections:

```json
[{"id":1,"departmentName":"Engineering","manager":{"id":10,"employeeCode":"E10","fullName":"Manager","positionName":"Engineering Manager"},"employeeCount":21,"teamCount":1,"unassignedCount":1,"teams":[{"id":2,"teamName":"Backend","lead":null,"employeeCount":20}]}]
```

Manager and lead are nullable. Counts describe visible employees, not organization-wide totals. TeamCount excludes the virtual unassigned group. Two SQL projections fetch all structural departments and teams independently of employee membership, with scoped SQL count/manager subqueries; query count does not grow with node count. No employee lists, email or personal detail fields are loaded.

## GET /api/teams/{teamId}/members?page=1&pageSize=20
## GET /api/departments/{departmentId}/unassigned-members?page=1&pageSize=20

Page defaults to 1, pageSize to 20; max pageSize 100. Stable order: EmployeeCode, Id. Unassigned means TeamId is null.

```json
{"success":true,"total":1,"page":1,"pageSize":20,"data":[{"id":10,"employeeCode":"E10","fullName":"Employee","positionName":"Developer","employmentStatus":"ACTIVE"}]}
```

No members returns data `[]` and total 0. PositionName can be null. Employees in inactive teams/departments remain visible according to scope.

## Manager assignments

POST/PUT departments accept nullable `managerEmployeeId`; POST/PUT teams accept nullable `leadEmployeeId`. Omitted fields preserve existing assignments; explicit null clears them. An assigned employee must already belong to the target department/team; invalid assignment is 400. A new group cannot initially have a manager/lead (create it, assign members, then update it). Manager/lead assignments must be removed before transferring the employee out of the department/team (409). Validation and reassignment use serializable transactions.

## Frontend and verification

Department and Team expansion use accessible buttons with aria-expanded. Team members load only on expansion and are paginated 20 at a time. Requests abort on collapse/navigation; pending/error/empty states and retry are provided. The virtual “Chưa phân nhóm” group appears only when its scoped count is positive. Tree RBAC denial never triggers tree fetching. The frontend gate checks only WEB_ORGANIZATION / VIEW.

Tests: OrganizationTreeTests (scope, no identity/count leakage, pagination, missing grants/scope, membership validation, query count); Organization.test.jsx (lazy loading, paging, profile navigation, retry, empty and denied states). TeamMigrationTests also checks snapshot consistency and offline MySQL script generation.

Validation run: frontend production build succeeded; React 15/15 tests passed. Full backend run: 262 passed, 9 failed (271 total). The nine existing EmployeeCreationTests expect NV-prefixed codes whereas the unchanged HEAD EmployeeCodeGenerator.Format produces TX-prefixed codes; the legacy occupied-code test also uses NV. This Organization change does not alter that policy. No database migration was applied.

Final focused backend run after the additional hidden-team/omitted-assignment regression test: 44/44 passed (Organization, Teams, Employee read/API, inventory and migration tests).

## Department and Team SQL (no Data Scope)

The structure is loaded without employee scope predicates, including for an account without a linked employee or configured DataScope. Only employee projections (counts, manager/lead identities, member lists) use scope.

```sql
SELECT Id, DepartmentName FROM departments ORDER BY DepartmentName, Id;
SELECT Id, TeamName, DepartmentId FROM teams ORDER BY TeamName, Id;
```

These show the structural selection only; the actual projections also include scoped employee counts and nullable manager/lead information.

Count regression: Tree employeeCount matches Members total under SELF/DEPARTMENT/ALL even when Organization DataScope is absent. Department employeeCount equals the sum of Team employeeCounts plus unassignedCount.

Manager and lead objects include nullable `positionName`, resolved from employees.PositionId → positions.id/name in the existing SQL projection (no extra query per node). No position returns null. Out-of-scope employees still return a null manager/lead object.
