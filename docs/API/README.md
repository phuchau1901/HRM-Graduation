# API Inventory

[Mục lục](../README.md) · [Quy ước HTTP](../guides/CONVENTIONS.md) · [Postman](../HRM-API.postman_collection.json)

Có **52 REST endpoint production** và **1 SignalR hub** trong phạm vi backend hiện tại. IMPLEMENTED là đã có source, không đồng nghĩa đã deploy, đã cấp grant hoặc đã áp dụng migration ở Railway.

| Module | REST endpoint | Trạng thái |
| --- | --- | --- |
| Auth | 3 | IMPLEMENTED |
| Authorization / Administration | 21 | IMPLEMENTED |
| Organization | 10 | IMPLEMENTED |
| Employees / Contracts / History | 11 | IMPLEMENTED |
| Notifications | 7 | IMPLEMENTED; FCM MISSING |
| Attendance | 0 | Model có, API MISSING |
| Leave / Overtime / Approvals | 0 | Model có, API MISSING |
| Payroll / Timesheets | 0 | Model có, API MISSING |
| Performance / KPI | 0 | Model có, API MISSING |
| System / Dashboard / Reports | 0 | Audit/model có, API độc lập MISSING |

## Toàn bộ REST endpoint

| Method | URL | Module / đặc tả | Permission |
| --- | --- | --- | --- |
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
| GET | `/api/employees` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/employees/{employeeId}` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / VIEW + data scope |
| POST | `/api/employees` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / NEW + data scope |
| PUT | `/api/employees/{employeeId}` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / UPDATE + data scope |
| DELETE | `/api/employees/{employeeId}` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / DELETE + data scope |
| PATCH | `/api/employees/{employeeId}/department` | [Employees](../modules/Employees/PROFILES_API.md) | WEB_EMPLOYEES / UPDATE + data scope |
| GET | `/api/employees/{employeeId}/history` | [Employees](../modules/Employees/HISTORY_API.md) | WEB_EMPLOYEES / VIEW + data scope |
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
| POST | `/api/users` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/NEW; thêm WEB_USERS/APPROVE nếu có RoleIds |
| PUT | `/api/users/{targetUserId}` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/UPDATE |
| PATCH | `/api/users/{targetUserId}/status` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/UPDATE |
| POST | `/api/users/{targetUserId}/reset-password` | [Authorization](../modules/Authorization/USERS_API.md) | WEB_USERS/APPROVE |
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
