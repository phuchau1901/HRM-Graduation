# Employee data scope

Scope is resolved from active user + assigned Role + active Screen + Action. The six standard grants remain Y/N in role_details. role_screen_actions.data_scope is metadata for those actions, never a grant. Extended Notification actions retain their existing explicit row grants; NULL scope is permitted when the operation does not use scoped data.

Only roles granting the same screen/action contribute scope. Effective union is ALL > DEPARTMENT > SELF. Missing/NULL/unknown scope contributes nothing; if no eligible scope remains the service returns 403. No ADMIN bypass or UserId configuration fallback exists.

SELF reads only the linked employee; all writes are forbidden until field-level rules exist. DEPARTMENT reads/writes employees in the actor's current linked department. Missing employee/department fails closed. ALL allows cross-department work; department transfer additionally requires ALL.

Employees list/detail/history use WEB_EMPLOYEES/VIEW. Create uses NEW; profile update and transfer use UPDATE; deactivate uses DELETE. Contract reads use WEB_CONTRACTS/VIEW; create uses NEW and update uses UPDATE, independently of employee-screen permissions.

## Cấu hình `dataScopes` cho API nhân viên

`dataScopes` được gửi trong `screens[]` của `PUT /api/roles/{roleId}/permissions`, không nằm trong body tạo/sửa role hoặc body API nhân viên. Backend lưu metadata phạm vi theo role/screen/action tại `role_screen_actions.data_scope`. Với standard action, cần bật grant tương ứng trong `standard`; chỉ đặt scope không cấp quyền thực hiện action.

### Các giá trị được hỗ trợ

| Giá trị | Ý nghĩa | Giới hạn |
| --- | --- | --- |
| `SELF` | Chỉ hồ sơ của nhân viên liên kết với tài khoản đang đăng nhập | Chỉ đọc; mọi thao tác ghi bị từ chối |
| `DEPARTMENT` | Nhân viên thuộc phòng ban hiện tại của nhân viên liên kết với tài khoản | Đọc/ghi trong phòng ban; không được chuyển phòng ban |
| `ALL` | Tất cả nhân viên, kể cả khác phòng ban | Vẫn phải có grant của action; chuyển phòng ban yêu cầu scope này |
| `null` | Xóa scope đã cấu hình cho action trong role này | Không phải quyền xem tất cả; nếu không còn scope hợp lệ từ role khác thì API trả `403` |

Giá trị chuỗi phải viết hoa chính xác. Chuỗi rỗng, `NONE`, `TEAM` hoặc giá trị khác trả `400` khi lưu quyền. Bỏ qua `dataScopes` hoặc bỏ qua một key sẽ giữ scope cũ. `SELF` cần liên kết `EmployeeId`; `DEPARTMENT` cần liên kết nhân viên và phòng ban để truy cập dữ liệu, không tự mở rộng sang `ALL` khi thiếu liên kết.

### Scope dùng được theo endpoint

| Endpoint | Screen / action | Scope thực thi được |
| --- | --- | --- |
| `GET /api/employees` | `WEB_EMPLOYEES / VIEW` | `SELF`, `DEPARTMENT`, `ALL` |
| `GET /api/employees/unlinked` | `WEB_EMPLOYEES / VIEW` | `SELF`, `DEPARTMENT`, `ALL`; chỉ nhân viên chưa được user nào liên kết |
| `GET /api/employees/{employeeId}` | `WEB_EMPLOYEES / VIEW` | `SELF`, `DEPARTMENT`, `ALL` |
| `GET /api/employees/{employeeId}/history` | `WEB_EMPLOYEES / VIEW` | `SELF`, `DEPARTMENT`, `ALL` |
| `POST /api/employees` | `WEB_EMPLOYEES / NEW` | `DEPARTMENT` (departmentId phải thuộc phòng ban của actor), `ALL` |
| `PUT /api/employees/{employeeId}` | `WEB_EMPLOYEES / UPDATE` | `DEPARTMENT`, `ALL` |
| `DELETE /api/employees/{employeeId}` | `WEB_EMPLOYEES / DELETE` | `DEPARTMENT`, `ALL` |
| `PATCH /api/employees/{employeeId}/department` | `WEB_EMPLOYEES / UPDATE` | Chỉ `ALL` |
| `GET /api/employees/{employeeId}/contracts` | `WEB_CONTRACTS / VIEW` | `SELF`, `DEPARTMENT`, `ALL` |
| `GET /api/employees/{employeeId}/contracts/{contractId}` | `WEB_CONTRACTS / VIEW` | `SELF`, `DEPARTMENT`, `ALL` |
| `POST /api/employees/{employeeId}/contracts` | `WEB_CONTRACTS / NEW` | `DEPARTMENT`, `ALL` |
| `PUT /api/employees/{employeeId}/contracts/{contractId}` | `WEB_CONTRACTS / UPDATE` | `DEPARTMENT`, `ALL` |

API lưu quyền chấp nhận `SELF` như một giá trị scope, nhưng service nhân viên vẫn từ chối ghi với `SELF` (`403`). `APPROVE`/`EXPORT` không có endpoint thực thi trong bộ API nhân viên hiện tại. Danh sách trả về đã lọc scope; truy cập hồ sơ/hợp đồng ngoài scope trả `404` sau khi đã vượt qua kiểm tra quyền và scope.

### Ví dụ lưu quyền của role

1. Gọi `GET /api/roles/{roleId}/permissions` với Bearer token có `WEB_PERMISSIONS / VIEW`, lấy header `ETag`.
2. Gọi `PUT /api/roles/{roleId}/permissions` với Bearer token có cả `WEB_PERMISSIONS / UPDATE` và `APPROVE`; truyền nguyên giá trị `ETag` vào header `If-Match`.

```http
PUT /api/roles/5/permissions
Authorization: Bearer <access_token>
Content-Type: application/json
If-Match: "<ETag lấy từ GET>"
```

```json
{
  "screens": [
    {
      "screenCode": "WEB_EMPLOYEES",
      "standard": { "VIEW": true, "NEW": true, "UPDATE": true, "DELETE": false },
      "dataScopes": { "VIEW": "DEPARTMENT", "NEW": "DEPARTMENT", "UPDATE": "DEPARTMENT" }
    },
    {
      "screenCode": "WEB_CONTRACTS",
      "standard": { "VIEW": true },
      "dataScopes": { "VIEW": "SELF" }
    }
  ]
}
```

Ví dụ trên cho phép xem/thêm/sửa hồ sơ trong phòng ban, không cho chuyển phòng ban; hợp đồng chỉ được xem của bản thân. Nếu user có nhiều role, scope hiệu lực lấy mức rộng nhất trong các role cùng cấp screen/action (`ALL > DEPARTMENT > SELF`).

Không được sửa role đang gán cho chính actor hoặc cấp phạm vi vượt quyền actor. Thiếu `If-Match` trả `428`, version cũ trả `412`. Sau thay đổi quyền, user bị ảnh hưởng cần đăng nhập lại. Xem thêm [API ma trận quyền](../Authorization/PERMISSIONS_API.md).

## Permission API specification

GET /api/roles/{id}/permissions returns existing screen properties plus `dataScopes`, a dictionary from action code to SELF, DEPARTMENT, ALL or null. `extendedActions` contains only the five extended codes, never standard scope rows. Version/ETag includes scopes.

PUT uses existing authentication, UPDATE + APPROVE permissions, If-Match concurrency, audit and anti-self-edit rules. Each screen patch accepts optional `dataScopes`. Omitted dictionary/keys retain old values; explicit null clears the scope. Invalid action/scope is 400. Actor must possess at least the requested scope for the same action; broadening beyond the actor is 403. Extended scope metadata requires an existing or simultaneously granted extended action. Omitted extendedActions preserves Notification grants; supplying it explicitly replaces extended grants only. Scope changes revoke refresh tokens and increment auth_version for all assigned users in the same transaction.

Example: [JSON sample](../../API/role-permissions-data-scope.sample.json).

## Review and conversion

No runtime database or deployed configuration was inspected or changed. Old EmployeeDataScopes.Users is configuration, not a database table; no automatic safe migration can infer per-action role grants from it. The new runtime ignores this mapping.

Before rollout, export the approved legacy mapping, current user-role assignments, employee links/departments and per-screen grants in a controlled environment. Produce proposals per role/screen/action and compare every affected user, including users without an explicit legacy entry (previously SELF). Shared roles may include users with different scopes; assigning the maximum would widen their access. Split roles or obtain explicit approval instead. An ALL legacy user is not approval to give every user in their roles ALL. Missing employee links and department changes also need review. Keep all proposed ALL grants pending explicit approval.

The schema migration adds nullable metadata only and copies no grants. Existing scoped employee endpoints will deny until approved scopes are configured. Plan a coordinated rollout; do not silently default scopes. Re-login is required after permission changes. Direct SQL permission backfills must also revoke refresh tokens and increment auth_version in a reviewed transaction; prefer the permission API.

Review SQL: [schema SQL](../../API/role-action-data-scope.review.sql). No migration has been applied. MySQL DDL may auto-commit; schedule separately from data backfill. Rollback drops metadata and requires coordinated application rollback; it does not restore legacy configuration automatically.

## Teams không mở rộng scope

Team là cấu trúc tổ chức, không phải giá trị `dataScopes` mới. `SELF`/`DEPARTMENT`/`ALL` và screen/action hiện có giữ nguyên. Filter `teamId` trên Employee chỉ thu hẹp query đã áp scope. Quyền catalog `WEB_TEAMS` không cấp quyền đọc/ghi Employee.
