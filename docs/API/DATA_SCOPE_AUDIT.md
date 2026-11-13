# Role action scope audit — 2026-11-13

Reviewed RoleScreenAction entity/configuration, RoleDetail, initial and Notification migrations, AuthVersion migration, model snapshot, PermissionService, AdministrationService matrix/revocation, EmployeeDataScope and EmployeeService.

Before: composite key (role_id, screen_id, action_code); six standard Y/N flags in role_details; five Notification action rows are grants. EmployeeDataScopes.Users provided manually configured per-user scopes, default SELF. JWT action snapshots contain no data scopes; auth_version checks protect revoked sessions.

After: nullable varchar(20) data_scope on the same composite-key entity; no new table, key or foreign-key change. Six flags untouched. Standard scope rows are excluded from extended action snapshots and matrix extendedActions. Scope union checks each candidate role's own same-screen/action grant before considering scope. Employee/contract operations resolve current scope from the database; missing scope denies, SELF cannot write. Matrix scopes participate in ETag, audit, transaction and existing role-user auth_version/refresh revocation.

Migration: 20261113000000_AddRoleScreenActionDataScope, with target designer and updated snapshot. Up adds one nullable column without defaults/data updates; Down drops that column. Review SQL is role-action-data-scope.review.sql. Migration operations and model snapshot are tested without applying migrations. Database conversion is deliberately deferred for approval; see ../modules/Employees/DATA_SCOPE.md. No live user mapping or production data was read.

API specification, conversion rules and endpoint mapping: ../modules/Employees/DATA_SCOPE.md. Both Postman collections include GET/PUT scope requests; JSON sample is role-permissions-data-scope.sample.json.

Validation: solution build succeeded with 0 warnings/errors; full automated suite passed 174/174, 0 skipped. Coverage includes SELF/DEPARTMENT/ALL, missing scope despite legacy ALL configuration, multi-role union without ungranted widening, immediate grant revocation, scope-only token invalidation, five Notification grants preserved, nullable migration operations and snapshot consistency. Initial sandbox test execution could not bind the test runner localhost socket; rerun with the permitted test-runner escalation passed. No EF database update, Railway or Production action was performed.
