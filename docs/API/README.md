# API Inventory

[Mục lục](../README.md) · [Quy ước HTTP](../guides/CONVENTIONS.md) · [Postman](../HRM-API.postman_collection.json)

Có **112 REST endpoint production** và **1 SignalR hub** trong phạm vi backend hiện tại. IMPLEMENTED là đã có source, không đồng nghĩa đã deploy, đã cấp grant hoặc đã áp dụng migration ở Railway.

| Module | REST endpoint | Trạng thái |
| --- | --- | --- |
| Auth | 3 | IMPLEMENTED |
| Authorization / Administration | 21 | IMPLEMENTED |
| Organization (Departments / Positions / Teams / Tree) | 18 | IMPLEMENTED |
| Employees / Contracts / Contract Types / History | 19 | IMPLEMENTED |
| Notifications | 7 | IMPLEMENTED; FCM MISSING |
| Attendance / Shifts / Schedules / QR | 15 | IMPLEMENTED qua module System; Adjustment workflow qua module Leave |
| System Settings | 4 | IMPLEMENTED |
| Leave / Overtime / Approvals / Adjustments / Workflow Settings | 23 | IMPLEMENTED |
| Payroll / Timesheets | 0 | Model có, API MISSING |
| Performance / KPI | 0 | Model có, API MISSING |
| AuditLog (System) | 2 | IMPLEMENTED; WEB_AUDIT_LOGS/VIEW |
| Dashboard / Reports | 0 | API MISSING |

## Toàn bộ REST endpoint

| Method | URL | Module / đặc tả | Permission |
| --- | --- | --- | --- |
| GET | `/api/audit-logs` | [System](../modules/System/API.md#auditlog) | WEB_AUDIT_LOGS/VIEW |
| GET | `/api/audit-logs/{id}` | [System](../modules/System/API.md#auditlog) | WEB_AUDIT_LOGS/VIEW |
| GET | `/api/system-settings/password-policy` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/VIEW |
| PUT | `/api/system-settings/password-policy` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/UPDATE + If-Match |
| GET | `/api/system-settings/attendance` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/VIEW |
| PUT | `/api/system-settings/attendance` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/UPDATE + If-Match |
| GET | `/api/shifts` | [System](../modules/System/API.md) | WEB_SHIFTS/VIEW |
| GET | `/api/shifts/{id}` | [System](../modules/System/API.md) | WEB_SHIFTS/VIEW |
| POST | `/api/shifts` | [System](../modules/System/API.md) | WEB_SHIFTS/NEW |
| PUT | `/api/shifts/{id}` | [System](../modules/System/API.md) | WEB_SHIFTS/UPDATE + If-Match |
| GET | `/api/work-schedules` | [System](../modules/System/API.md) | WEB_WORK_SCHEDULES/VIEW + scope |
| GET | `/api/work-schedules/{id}` | [System](../modules/System/API.md) | WEB_WORK_SCHEDULES/VIEW + scope |
| POST | `/api/work-schedules` | [System](../modules/System/API.md) | WEB_WORK_SCHEDULES/NEW + write scope |
| PUT | `/api/work-schedules/{id}` | [System](../modules/System/API.md) | WEB_WORK_SCHEDULES/UPDATE + write scope + If-Match |
| PATCH | `/api/work-schedules/{id}/cancel` | [System](../modules/System/API.md) | WEB_WORK_SCHEDULES/DELETE + write scope + If-Match |
| POST | `/api/work-schedules/{id}/close` | [System](../modules/System/API.md) | WEB_ATTENDANCE/APPROVE + scope |
| GET | `/api/attendances` | [System](../modules/System/API.md) | WEB_ATTENDANCE/VIEW + scope |
| POST | `/api/attendances/check-in` | [System](../modules/System/API.md) | WEB_ATTENDANCE/NEW + scope + own Employee |
| POST | `/api/attendances/check-out` | [System](../modules/System/API.md) | WEB_ATTENDANCE/UPDATE + scope + own Employee |
| GET | `/api/qr-sessions` | [System](../modules/System/API.md) | WEB_QR_SESSIONS/VIEW |
| POST | `/api/qr-sessions` | [System](../modules/System/API.md) | WEB_QR_SESSIONS/NEW |
| POST | `/api/auth/login` | [Auth](../modules/Auth/API.md) | Anonymous + LoginRateLimiter |
| GET | `/api/auth/me` | [Auth](../modules/Auth/API.md) | JWT, User ACTIVE, session version hợp lệ |
| GET | `/api/auth/me/permissions` | [Auth](../modules/Auth/API.md) | JWT, User ACTIVE, session version hợp lệ |
| GET | `/api/notifications` | [Notifications](../modules/Notifications/API.md) | JWT + recipient ownership |
| GET | `/api/notifications/unread-count` | [Notifications](../modules/Notifications/API.md) | JWT + recipient ownership |
| PATCH | `/api/notifications/{notificationId}/read` | [Notifications](../modules/Notifications/API.md) | JWT + recipient ownership |
| PATCH | `/api/notifications/read-all` | [Notifications](../modules/Notifications/API.md) | JWT + recipient ownership |
| POST | `/api/notifications/announcements` | [Notifications](../modules/Notifications/API.md) | WEB_NOTIFICATIONS / action theo target; CANCEL cho hủy |
| POST | `/api/notifications/{notificationId}/publish` | [Notifications](../modules/Notifications/API.md) | WEB_NOTIFICATIONS / action theo target; CANCEL cho hủy |
| POST | `/api/notifications/{notificationId}/cancel` | [Notifications](../modules/Notifications/API.md) | WEB_NOTIFICATIONS / action theo target; CANCEL cho hủy |
| GET | `/api/organization/tree` | [Organization Tree](../modules/Organization/TREE_API.md) | WEB_ORGANIZATION / VIEW; employee facts use WEB_EMPLOYEES scope |
| GET | `/api/teams/{teamId}/members` | [Organization Tree](../modules/Organization/TREE_API.md) | WEB_ORGANIZATION + WEB_EMPLOYEES / VIEW; WEB_EMPLOYEES scope |
| GET | `/api/departments/{departmentId}/unassigned-members` | [Organization Tree](../modules/Organization/TREE_API.md) | WEB_ORGANIZATION + WEB_EMPLOYEES / VIEW; WEB_EMPLOYEES scope |
| GET | `/api/departments` | [Organization](../modules/Organization/DEPARTMENTS_API.md) | WEB_DEPARTMENTS / VIEW |
| GET | `/api/departments/{departmentId}` | [Organization](../modules/Organization/DEPARTMENTS_API.md) | WEB_DEPARTMENTS / VIEW |
| POST | `/api/departments` | [Organization](../modules/Organization/DEPARTMENTS_API.md) | WEB_DEPARTMENTS / NEW |
| PUT | `/api/departments/{departmentId}` | [Organization](../modules/Organization/DEPARTMENTS_API.md) | WEB_DEPARTMENTS / UPDATE |
| DELETE | `/api/departments/{departmentId}` | [Organization](../modules/Organization/DEPARTMENTS_API.md) | WEB_DEPARTMENTS / DELETE |
| GET | `/api/positions` | [Organization](../modules/Organization/POSITIONS_API.md) | WEB_POSITIONS / VIEW |
| GET | `/api/positions/{positionId}` | [Organization](../modules/Organization/POSITIONS_API.md) | WEB_POSITIONS / VIEW |
| POST | `/api/positions` | [Organization](../modules/Organization/POSITIONS_API.md) | WEB_POSITIONS / NEW |
| PUT | `/api/positions/{positionId}` | [Organization](../modules/Organization/POSITIONS_API.md) | WEB_POSITIONS / UPDATE |
| DELETE | `/api/positions/{positionId}` | [Organization](../modules/Organization/POSITIONS_API.md) | WEB_POSITIONS / DELETE |
| GET | `/api/teams` | [Teams](../modules/Organization/TEAMS_API.md) | WEB_TEAMS / VIEW |
| GET | `/api/teams/{id}` | [Teams](../modules/Organization/TEAMS_API.md) | WEB_TEAMS / VIEW |
| POST | `/api/teams` | [Teams](../modules/Organization/TEAMS_API.md) | WEB_TEAMS / NEW |
| PUT | `/api/teams/{id}` | [Teams](../modules/Organization/TEAMS_API.md) | WEB_TEAMS / UPDATE |
| DELETE | `/api/teams/{id}` | [Teams](../modules/Organization/TEAMS_API.md) | WEB_TEAMS / DELETE |
| GET | `/api/employees` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/employees/unlinked` | [Employees](../modules/Employees/PROFILES_API.md#get-apiemployeesunlinked) | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/employees/{employeeId}` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / VIEW + data scope |
| POST | `/api/employees` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / NEW + data scope |
| PUT | `/api/employees/{employeeId}` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / UPDATE + data scope |
| DELETE | `/api/employees/{employeeId}` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / DELETE + data scope |
| PATCH | `/api/employees/{employeeId}/department` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / UPDATE + data scope |
| GET | `/api/employees/{employeeId}/history` | [Employees](../modules/Employees/HISTORY_API.md) | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/contract-types` | [Contract types](../modules/Employees/CONTRACT_TYPES_API.md) | WEB_CONTRACT_TYPES / VIEW; global catalog |
| GET | `/api/contract-types/{code}` | [Contract types](../modules/Employees/CONTRACT_TYPES_API.md) | WEB_CONTRACT_TYPES / VIEW; global catalog |
| POST | `/api/contract-types` | [Contract types](../modules/Employees/CONTRACT_TYPES_API.md) | WEB_CONTRACT_TYPES / NEW; global catalog |
| PUT | `/api/contract-types/{code}` | [Contract types](../modules/Employees/CONTRACT_TYPES_API.md) | WEB_CONTRACT_TYPES / UPDATE; global catalog |
| DELETE | `/api/contract-types/{code}` | [Contract types](../modules/Employees/CONTRACT_TYPES_API.md) | WEB_CONTRACT_TYPES / DELETE; global catalog |
| POST | `/api/contracts` | [Contract numbering](../modules/Employees/CONTRACT_NUMBERING.md) | WEB_CONTRACTS / NEW + data scope |
| GET | `/api/contracts/statistics` | [Contract statistics](../modules/Employees/CONTRACT_STATISTICS_API.md) | WEB_CONTRACTS / VIEW + data scope |
| GET | `/api/employees/{employeeId}/contracts` | [Employees](../modules/Employees/CONTRACTS_API.md) | WEB_CONTRACTS / VIEW + data scope |
| GET | `/api/employees/{employeeId}/contracts/{contractId}` | [Employees](../modules/Employees/CONTRACTS_API.md) | WEB_CONTRACTS / VIEW + data scope |
| POST | `/api/employees/{employeeId}/contracts` | [Employees](../modules/Employees/CONTRACTS_API.md) | WEB_CONTRACTS / NEW + data scope |
| PUT | `/api/employees/{employeeId}/contracts/{contractId}` | [Employees](../modules/Employees/CONTRACTS_API.md) | WEB_CONTRACTS / UPDATE + data scope |
| GET | `/api/screens?platform=WEB&page=1&pageSize=30` | [Authorization](../modules/Authorization/SCREENS_API.md) | WEB_PERMISSIONS/VIEW |
| GET | `/api/screens/{screenId}` | [Authorization](../modules/Authorization/SCREENS_API.md) | WEB_PERMISSIONS/VIEW |
| POST | `/api/screens` | [Authorization](../modules/Authorization/SCREENS_API.md) | WEB_PERMISSIONS/NEW |
| PUT | `/api/screens/{screenId}` | [Authorization](../modules/Authorization/SCREENS_API.md) | WEB_PERMISSIONS/UPDATE |
| PATCH | `/api/screens/{screenId}/status` | [Authorization](../modules/Authorization/SCREENS_API.md) | WEB_PERMISSIONS/UPDATE |
| GET | `/api/users?page=1&pageSize=30` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/VIEW |
| GET | `/api/users/{targetUserId}` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/VIEW |
| POST | `/api/users` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/NEW; createEmployee cần live WEB_EMPLOYEES/NEW + scope; thêm WEB_USERS/APPROVE nếu có RoleIds |
| PUT | `/api/users/{targetUserId}` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/UPDATE |
| PATCH | `/api/users/{targetUserId}/status` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/UPDATE |
| POST | `/api/users/{targetUserId}/reset-password` | [Authorization](../modules/Authorization/USERS_API.md) | SELF_CHANGE: JWT chính chủ; ADMIN_RESET: live WEB_USERS/UPDATE |
| PUT | `/api/users/{targetUserId}/roles` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/APPROVE |
| GET | `/api/roles?page=1&pageSize=30` | [Authorization](../modules/Authorization/ROLES_API.md) | WEB_ROLES/VIEW |
| GET | `/api/roles/{roleId}` | [Authorization](../modules/Authorization/ROLES_API.md) | WEB_ROLES/VIEW |
| POST | `/api/roles` | [Authorization](../modules/Authorization/ROLES_API.md) | WEB_ROLES/NEW |
| PUT | `/api/roles/{roleId}` | [Authorization](../modules/Authorization/ROLES_API.md) | WEB_ROLES/UPDATE |
| DELETE | `/api/roles/{roleId}` | [Authorization](../modules/Authorization/ROLES_API.md) | WEB_ROLES/DELETE |
| GET | `/api/roles/{roleId}/users?page=1&pageSize=30` | [Authorization](../modules/Authorization/ROLES_API.md) | WEB_ROLES/VIEW AND WEB_USERS/VIEW |
| GET | `/api/roles/{roleId}/permissions` | [Authorization](../modules/Authorization/PERMISSIONS_API.md) | WEB_PERMISSIONS/VIEW |
| PUT | `/api/roles/{roleId}/permissions` | [Authorization](../modules/Authorization/PERMISSIONS_API.md) | WEB_PERMISSIONS/UPDATE AND WEB_PERMISSIONS/APPROVE |
| GET | `/api/authorization/actions` | [Authorization](../modules/Authorization/PERMISSIONS_API.md) | WEB_PERMISSIONS/VIEW |

## Realtime

`/hubs/notifications` dùng JWT và group session version; không tính là REST endpoint. Event notification.available và đồng bộ offline: [Notifications Architecture](../modules/Notifications/ARCHITECTURE.md).

## Chưa triển khai

Không có public registration/forgot-password API, refresh-token HTTP endpoint, Data Scope management API, MFA/two-person approval, FCM, Attendance/Leave/Payroll/KPI/Dashboard HTTP workflow trong source hiện tại. Không ghi route dự kiến như route đang tồn tại. Endpoint Login anonymous có chủ đích; các endpoint inbox/profile yêu cầu JWT nhưng không đòi quyền xem một màn hình.

Data Scope API extension: [specification and conversion rules](../modules/Employees/DATA_SCOPE.md), [audit](DATA_SCOPE_AUDIT.md), [review SQL](role-action-data-scope.review.sql), [JSON example](role-permissions-data-scope.sample.json).

Employee GET list/detail giữ routes, quyền và pagination; EmployeeDto thêm departmentName/positionName nullable cùng teamName hiện có. [Contract và audit schema](../modules/Employees/EMPLOYEE_READ.md). Không thêm endpoint hoặc migration.

## Organization Tree

[API specification and audit](../modules/Organization/TREE_API.md): scoped tree, lazy paginated Team members and unassigned members.

## Leave, Overtime và Approval Workflow

| Method | URL | Module / đặc tả | Permission |
| --- | --- | --- | --- |
| GET | `/api/leave-types` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_TYPES / VIEW |
| POST | `/api/leave-types` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_TYPES / NEW |
| PUT | `/api/leave-types/{id:long}` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_TYPES / UPDATE |
| GET | `/api/leave-balances` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_BALANCES / VIEW + scope |
| PUT | `/api/leave-balances` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_BALANCES / UPDATE + scope DEPARTMENT/ALL |
| GET | `/api/leave-requests` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_REQUESTS / VIEW + scope |
| GET | `/api/leave-requests/{id:long}` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_REQUESTS / VIEW + scope |
| POST | `/api/leave-requests` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_REQUESTS / NEW + own employee |
| POST | `/api/leave-requests/{id:long}/cancel` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_REQUESTS / UPDATE + own request |
| GET | `/api/overtime-requests` | [Leave](../modules/Leave/API.md) | WEB_OVERTIME_REQUESTS / VIEW + scope |
| GET | `/api/overtime-requests/{id:long}` | [Leave](../modules/Leave/API.md) | WEB_OVERTIME_REQUESTS / VIEW + scope |
| POST | `/api/overtime-requests` | [Leave](../modules/Leave/API.md) | WEB_OVERTIME_REQUESTS / NEW + own employee |
| POST | `/api/overtime-requests/{id:long}/cancel` | [Leave](../modules/Leave/API.md) | WEB_OVERTIME_REQUESTS / UPDATE + own request |
| GET | `/api/attendance-adjustments` | [Leave](../modules/Leave/API.md) | WEB_ATTENDANCE_ADJUSTMENTS / VIEW + scope |
| POST | `/api/attendance-adjustments` | [Leave](../modules/Leave/API.md) | WEB_ATTENDANCE_ADJUSTMENTS / NEW + own employee |
| POST | `/api/attendance-adjustments/{id:long}/cancel` | [Leave](../modules/Leave/API.md) | WEB_ATTENDANCE_ADJUSTMENTS / UPDATE + own request |
| GET | `/api/approvals` | [Leave](../modules/Leave/API.md) | WEB_APPROVALS / VIEW + scope |
| GET | `/api/approvals/{id:long}` | [Leave](../modules/Leave/API.md) | WEB_APPROVALS / VIEW + scope |
| POST | `/api/approvals/{id:long}/approve` | [Leave](../modules/Leave/API.md) | WEB_APPROVALS / APPROVE + scope + assigned current step |
| POST | `/api/approvals/{id:long}/reject` | [Leave](../modules/Leave/API.md) | WEB_APPROVALS / APPROVE + scope + assigned current step |
| GET | `/api/approvals/{id:long}/history` | [Leave](../modules/Leave/API.md) | WEB_APPROVALS / VIEW + scope |
| GET | `/api/approval-workflow-settings` | [Leave](../modules/Leave/API.md) | WEB_APPROVAL_SETTINGS / VIEW |
| PUT | `/api/approval-workflow-settings` | [Leave](../modules/Leave/API.md) | WEB_APPROVAL_SETTINGS / UPDATE |
