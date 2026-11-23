# API Inventory

[Mục lục](../README.md) · [Quy ước HTTP](../guides/CONVENTIONS.md) · [Postman](../HRM-API.postman_collection.json)

Có **155 REST endpoint production** và **1 SignalR hub** trong phạm vi backend hiện tại. IMPLEMENTED là đã có source, không đồng nghĩa đã deploy, đã cấp grant hoặc đã áp dụng migration ở Railway.

| Module | REST endpoint | Trạng thái |
| --- | --- | --- |
| Auth | 3 | IMPLEMENTED |
| Authorization / Administration | 21 | IMPLEMENTED |
| Organization (Departments / Positions / Teams / Tree) | 18 | IMPLEMENTED |
| Employees / Contracts / Contract Types / History | 19 | IMPLEMENTED |
| Notifications | 7 | IMPLEMENTED; FCM MISSING |
| Attendance / Shifts / Schedules / QR | 15 | IMPLEMENTED qua module System; Adjustment workflow qua module Leave |
| System Settings | 7 | IMPLEMENTED |
| Leave / Overtime / Adjustments / Balances | 20 | IMPLEMENTED |
| Approvals / Workflow Settings | 7 | IMPLEMENTED; module cha với các module con |
| Payroll / Timesheets | 0 | Model có, API MISSING |
| Performance / KPI | 25 | IMPLEMENTED; Migration mới chưa apply |
| AuditLog (System) | 2 | IMPLEMENTED; WEB_AUDIT_LOGS/VIEW |
| Dashboard / Reports | 0 | API MISSING |

## Toàn bộ REST endpoint

| Method | URL | Module / đặc tả | Permission |
| --- | --- | --- | --- |
| GET | `/api/audit-logs` | [System](../modules/System/API.md#auditlog) | WEB_AUDIT_LOGS/VIEW |
| GET | `/api/audit-logs/{id}` | [System](../modules/System/API.md#auditlog) | WEB_AUDIT_LOGS/VIEW |
| GET | `/api/system-settings/password-policy` | [System](../modules/System/API.md) | JWT đăng nhập; không ScreenPermission, không Scope |
| PUT | `/api/system-settings/password-policy` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/UPDATE + If-Match |
| GET | `/api/system-settings/attendance` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/VIEW |
| PUT | `/api/system-settings/attendance` | [System](../modules/System/API.md) | WEB_SYSTEM_SETTINGS/UPDATE + If-Match |
| GET | `/api/shifts` | [Work](../modules/Work/API.md) | WEB_SHIFTS/VIEW |
| GET | `/api/shifts/{id}` | [Work](../modules/Work/API.md) | WEB_SHIFTS/VIEW |
| POST | `/api/shifts` | [Work](../modules/Work/API.md) | WEB_SHIFTS/NEW |
| PUT | `/api/shifts/{id}` | [Work](../modules/Work/API.md) | WEB_SHIFTS/UPDATE + If-Match |
| GET | `/api/work-schedules` | [Work](../modules/Work/API.md) | WEB_WORK_SCHEDULES/VIEW + scope |
| GET | `/api/work-schedules/{id}` | [Work](../modules/Work/API.md) | WEB_WORK_SCHEDULES/VIEW + scope |
| POST | `/api/work-schedules` | [Work](../modules/Work/API.md) | WEB_WORK_SCHEDULES/NEW + write scope |
| PUT | `/api/work-schedules/{id}` | [Work](../modules/Work/API.md) | WEB_WORK_SCHEDULES/UPDATE + write scope + If-Match |
| PATCH | `/api/work-schedules/{id}/cancel` | [Work](../modules/Work/API.md) | WEB_WORK_SCHEDULES/DELETE + write scope + If-Match |
| POST | `/api/work-schedules/{id}/close` | [Work](../modules/Work/API.md) | WEB_ATTENDANCE/APPROVE + scope |
| GET | `/api/attendances` | [Attendance](../modules/Attendance/API.md) | WEB_ATTENDANCE/VIEW + scope |
| POST | `/api/attendances/check-in` | [Attendance](../modules/Attendance/API.md) | WEB_MY_ATTENDANCE/UPDATE, không Scope, own Employee |
| POST | `/api/attendances/check-out` | [Attendance](../modules/Attendance/API.md) | WEB_MY_ATTENDANCE/UPDATE, không Scope, own Employee |
| GET | `/api/qr-sessions` | [Attendance](../modules/Attendance/API.md) | WEB_QR_SESSIONS/VIEW |
| POST | `/api/qr-sessions` | [Attendance](../modules/Attendance/API.md) | WEB_QR_SESSIONS/NEW |
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

Không có public registration/forgot-password API, refresh-token HTTP endpoint, Data Scope management API, MFA/two-person approval, FCM, Payroll/Dashboard HTTP workflow trong source hiện tại. Không ghi route dự kiến như route đang tồn tại. Endpoint Login anonymous có chủ đích; các endpoint inbox/profile yêu cầu JWT nhưng không đòi quyền xem một màn hình.

Data Scope API extension: [specification and conversion rules](../modules/Employees/DATA_SCOPE.md), [audit](DATA_SCOPE_AUDIT.md), [review SQL](role-action-data-scope.review.sql), [JSON example](role-permissions-data-scope.sample.json).

Employee GET list/detail giữ routes, quyền và pagination; EmployeeDto thêm departmentName/positionName nullable cùng teamName hiện có. [Contract và audit schema](../modules/Employees/EMPLOYEE_READ.md). Không thêm endpoint hoặc migration.

## Organization Tree

[API specification and audit](../modules/Organization/TREE_API.md): scoped tree, lazy paginated Team members and unassigned members.

## Leave, Overtime và Approval Workflow

| Method | URL | Module / đặc tả | Permission |
| --- | --- | --- | --- |
| GET | `/api/leave-types` | [Leave](../modules/Leave/API.md) | VIEW trên một trong WEB_LEAVE_TYPES, WEB_LEAVE_REQUESTS, WEB_OVERTIME_REQUESTS, WEB_ATTENDANCE_ADJUSTMENTS |
| POST | `/api/leave-types` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_TYPES / NEW |
| PUT | `/api/leave-types/{id:long}` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_TYPES / UPDATE |
| GET | `/api/leave-balances` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_MANAGEMENT / VIEW + scope |
| PUT | `/api/leave-balances` | [Leave](../modules/Leave/API.md) | WEB_LEAVE_MANAGEMENT / UPDATE + scope DEPARTMENT/ALL |
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
| GET | `/api/approvals` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVALS / VIEW + scope |
| GET | `/api/approvals/{id:long}` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVALS / VIEW + scope |
| POST | `/api/approvals/{id:long}/approve` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVALS / APPROVE + scope + assigned current step |
| POST | `/api/approvals/{id:long}/reject` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVALS / APPROVE + scope + assigned current step |
| GET | `/api/approvals/{id:long}/history` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVALS / VIEW + scope |
| GET | `/api/approval-workflow-settings` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVAL_SETTINGS / VIEW |
| PUT | `/api/approval-workflow-settings` | [Approvals](../modules/Approvals/API.md) | WEB_APPROVAL_SETTINGS / UPDATE |

Hướng dẫn [Approval Workflow Settings](../modules/Leave/WORKFLOW_SETTINGS.md): TEAM_LEAD/DEPARTMENT_MANAGER tự lấy quản lý; USER chọn employeeId, kiểm tra lại liên kết User khi duyệt. [Payload mẫu](approval-workflow-settings.sample.json).

## Leave Balance Management

| Method | URL | Permission |
| --- | --- | --- |
| POST | `/api/leave-balances/grants` | WEB_LEAVE_MANAGEMENT / UPDATE + DEPARTMENT/ALL |
| POST | `/api/leave-balances/{id:long}/adjustments` | WEB_LEAVE_MANAGEMENT / UPDATE + DEPARTMENT/ALL |
| GET | `/api/leave-balances/{id:long}/history` | WEB_LEAVE_MANAGEMENT / VIEW + scope |

[Đặc tả số dư phép](../modules/Leave/BALANCES_API.md); GET/PUT balances hiện có được mở rộng, không thêm route trùng.

## My balance và Leave Accrual Settings

| Method | URL | Permission |
| --- | --- | --- |
| GET | `/api/leave-balances/me` | WEB_LEAVE_BALANCES VIEW + own Employee |
| GET | `/api/system-settings/leave-accrual` | WEB_SYSTEM_SETTINGS VIEW |
| PUT | `/api/system-settings/leave-accrual` | WEB_SYSTEM_SETTINGS UPDATE (không áp dụng Data Scope) |
| POST | `/api/system-settings/leave-accrual/run` | Cùng quyền PUT, chỉ xử lý lịch đến hạn |

[Đặc tả chính sách hệ thống và worker](../modules/Leave/ACCRUAL_SETTINGS.md).

## Approvals — module cha

Các7 endpoint /api/approvals* và /api/approval-workflow-settings chuyển sang ApprovalsController, giữ URL và quyền hiện có; việc tách Approvals không làm tăng số route; inventory hiện tại là124 sau khi thêm5 API phân ca. GET /api/approvals hỗ trợ module=LEAVE/OVERTIME/ATTENDANCE, lọc trước count/paging và trong scope. [Đặc tả Approvals](../modules/Approvals/API.md) · [Kiến trúc mở rộng](../modules/Approvals/ARCHITECTURE.md).

Cấp phép tự động version2: `settings.defaultDaysPerCycle` mặc định1 ngày/chu kỳ; `rules: []` hợp lệ. Không khớp chức vụ dùng mức mặc định ANNUAL, khớp thì dùng mức riêng và không cộng cả hai. Chi tiết: [Leave Accrual Settings](../modules/Leave/ACCRUAL_SETTINGS.md).

GET `/api/leave-types` chấp nhận VIEW trên bất kỳ một màn hình: WEB_LEAVE_TYPES, WEB_LEAVE_REQUESTS, WEB_OVERTIME_REQUESTS, WEB_ATTENDANCE_ADJUSTMENTS. Không yêu cầu đồng thời và không áp Data Scope cho danh mục loại phép. NEW đơn thuần không thay thế VIEW. POST/PUT loại phép vẫn cần WEB_LEAVE_TYPES / NEW hoặc UPDATE tương ứng; quyền đọc danh mục không cấp quyền ghi.

POST `/api/leave-requests`: cần `WEB_LEAVE_REQUESTS / NEW`, không yêu cầu cấu hình Data Scope cho action NEW. Backend lấy nhân viên từ user đăng nhập; user và nhân viên phải ACTIVE, có liên kết hợp lệ. Không nhận employeeId để tạo thay người khác. Vẫn kiểm tra quyền NEW hiện hành, trùng lịch, số dư phép và quy trình duyệt. Quyền/scope của GET, hủy đơn và các loại phiếu khác giữ nguyên.

POST `/api/overtime-requests`: chỉ cần `WEB_OVERTIME_REQUESTS / NEW`, không kiểm tra Data Scope NEW. Backend dùng nhân viên liên kết ACTIVE của user đăng nhập ACTIVE; employeeId gửi kèm không cho tạo thay. Thiếu quyền NEW trả403 HRM_AUTH_003; thiếu liên kết hoặc nhân viên không ACTIVE trả403 HRM_AUTH_006. Giữ kiểm tra thời gian, trùng lịch và khởi tạo workflow. GET, chi tiết, hủy và duyệt vẫn kiểm tra quyền/Scope như hiện tại.

POST `/api/attendance-adjustments`: cần `WEB_ATTENDANCE_ADJUSTMENTS / NEW`, không kiểm tra Data Scope NEW. Backend lấy nhân viên ACTIVE liên kết với tài khoản ACTIVE đăng nhập; chỉ nhận bản ghi Attendance có WorkSchedule thuộc nhân viên đó. Không cho tạo thay bằng employeeId trong payload. Vẫn kiểm tra giờ đề xuất, snapshot lịch và trùng phiếu pending. GET, hủy và duyệt giữ quyền/Scope hiện có.

## Phân ca hàng loạt và lịch tuần/tháng

Chi tiết audit, quyền theo action, payload preview/bulk/copy/export, ngày lễ và transaction tại [Work Schedule Management](../modules/Work/WORK_SCHEDULES.md). Dùng bảng hiện có, không có Migration mới.

| Method | API | Quyền |
| --- | --- | --- |
| GET | /api/work-schedules/calendar | WEB_WORK_SCHEDULES VIEW + Scope |
| POST | /api/work-schedules/bulk/preview | WEB_WORK_SCHEDULES NEW + Scope; overwrite thêm UPDATE |
| POST | /api/work-schedules/bulk | Như preview, cần previewToken |
| POST | /api/work-schedules/copy | Như bulk, thêm VIEW + Scope nguồn |
| GET | /api/work-schedules/export | WEB_WORK_SCHEDULES EXPORT + Scope; CSV trang đang chọn |

Tự động phân lịch hàng tuần: cấu hình `autoScheduleEnabled` trong GET/PUT `/api/system-settings/attendance` (mặc định true). Job Work đầu Chủ nhật giờ Việt Nam sao chép tuần có lịch gần nhất của từng nhân viên ACTIVE còn hợp đồng ACTIVE, chỉ điền ngày trống và không ghi đè. [Chi tiết lịch chạy, hợp đồng và retry](../modules/Work/WORK_SCHEDULES.md).

## Attendance Management và My Attendance

[Đặc tả daily, statistics, Excel, drawer và phiếu điều chỉnh](../modules/Attendance/MANAGEMENT.md). Các endpoint mới dùng WEB_ATTENDANCE VIEW/EXPORT với Scope theo action, cùng bộ lọc dữ liệu. Không tạo Attendance giả cho người chưa chấm công.

| Method | API | Quyền |
| --- | --- | --- |
| GET | /api/attendances/daily | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/statistics | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/filters | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/daily/detail | VIEW trên WEB_MY_ATTENDANCE (chỉ chính mình, không Scope) hoặc WEB_ATTENDANCE (Scope quản lý) |
| GET | /api/attendances/me | WEB_MY_ATTENDANCE VIEW, không Scope; chỉ nhân viên đăng nhập |
| GET | /api/attendances/export | WEB_ATTENDANCE EXPORT + Scope, file .xlsx |

GET `/api/attendances/me` chỉ cần `WEB_MY_ATTENDANCE / VIEW`, không đọc Data Scope và không yêu cầu WEB_ATTENDANCE / VIEW. Backend lấy EmployeeId từ tài khoản ACTIVE đăng nhập, có hồ sơ nhân viên tồn tại; không liên kết trả HRM_AUTH_006. employeeId trong query không thay được người xem. Quyền quản lý daily/statistics/filters/export vẫn theo WEB_ATTENDANCE; check-in/check-out dùng WEB_MY_ATTENDANCE / UPDATE không Scope; WEB_MY_ATTENDANCE VIEW không cấp quyền ghi hoặc xem người khác. Frontend My Attendance hiển thị theo screen mới; drawer hỗ trợ WEB_MY_ATTENDANCE VIEW cho chính mình hoặc WEB_ATTENDANCE VIEW theo Scope. Cần cấp screen mới active và VIEW qua API phân quyền hiện có, không tự chuyển grant hoặc sửa DB.

Check-in và check-out: POST `/api/attendances/check-in` và `/api/attendances/check-out` chỉ cần `WEB_MY_ATTENDANCE / UPDATE`, không đọc Data Scope, không cần WEB_ATTENDANCE NEW/UPDATE. Server bắt buộc user ACTIVE có nhân viên liên kết hợp lệ và ca thuộc đúng nhân viên đó; ca của người khác trả404. API punch không bắt buộc VIEW, nhưng màn My Attendance cần thêm VIEW để tải danh sách. Giữ cửa sổ snapshot, QR/GPS, kỳ công khóa, requestKey/idempotency, transaction và audit. Các API quản lý vẫn giữ Scope theo action.

GET `/api/attendances/daily/detail` chấp nhận VIEW trên **một trong** WEB_MY_ATTENDANCE hoặc WEB_ATTENDANCE, không yêu cầu cả hai. Với WEB_MY_ATTENDANCE VIEW, chỉ xem employee liên kết user đăng nhập và không đọc Scope; employeeId/scheduleId người khác trả404. Với WEB_ATTENDANCE VIEW, xem theo Scope VIEW hiện hành. Nếu có cả hai, chi tiết chính mình ưu tiên nhánh cá nhân; dữ liệu người khác vẫn phải nằm trong Scope quản lý. Thay đổi này chỉ cấp quyền đọc, không cấp quyền punch hoặc điều chỉnh.

GET `/api/system-settings/password-policy` chỉ cần user đăng nhập/JWT hợp lệ, không yêu cầu WEB_SYSTEM_SETTINGS VIEW hoặc Data Scope, không cần liên kết EmployeeId. Giữ response `{settings,version,updatedAtUtc}` và ETag. Chưa đăng nhập trả401. PUT password-policy vẫn cần WEB_SYSTEM_SETTINGS UPDATE và If-Match; GET/PUT Attendance Settings giữ quyền hiện tại. Quyền đọc API này không tự cấp quyền vào màn hình quản trị hoặc chỉnh chính sách.

## Performance Management — KPI

25 endpoint mới, source đã triển khai; [API Specification](../modules/Performance/API.md), [audit / quyền / Migration](../modules/Performance/README.md). Screen WEB_KPI_CONFIGURATION (VIEW, NEW, UPDATE), WEB_KPI_EVALUATION (VIEW, UPDATE, APPROVE, EXPORT), scope theo action. Approvals dùng requestType KPI_EVALUATION/module PERFORMANCE qua engine hiện có. Migration 20261123090752_CompletePerformanceManagement chưa apply; đăng ký screen không tự cấp grant. Hai Postman Collection đã có folder Performance với25 request mẫu.
