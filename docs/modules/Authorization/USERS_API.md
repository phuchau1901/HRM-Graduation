# Authorization — API quản trị tài khoản

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Mọi mutation dùng transaction, live-grant check và If-Match theo [chính sách quản trị](SECURITY.md).

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/users?page=1&pageSize=30` | WEB_USERS/VIEW |
| GET | `/api/users/{targetUserId}` | WEB_USERS/VIEW |
| POST | `/api/users` | WEB_USERS/NEW; thêm WEB_USERS/APPROVE nếu có RoleIds |
| PUT | `/api/users/{targetUserId}` | WEB_USERS/UPDATE |
| PATCH | `/api/users/{targetUserId}/status` | WEB_USERS/UPDATE |
| POST | `/api/users/{targetUserId}/reset-password` | SELF_CHANGE: JWT chính chủ; ADMIN_RESET: live WEB_USERS/UPDATE |
| PUT | `/api/users/{targetUserId}/roles` | WEB_USERS/APPROVE |

## GET /api/users?page=1&pageSize=30

Danh sách metadata tài khoản.

- ScreenPermission: `WEB_USERS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: page, pageSize, search (UserId/email).
- Validation/nghiệp vụ: Toàn cục theo quyền quản trị; không trả employee PII, hash, salt, password, authVersion.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 401/403; phân trang; không có trường bí mật.

Request body: không có.

Response thành công:
```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "userId": "new.account",
      "email": "new.account@example.invalid",
      "employeeId": null,
      "status": "ACTIVE",
      "createdAt": "2026-10-26T00:00:00Z",
      "roles": [],
      "version": "VERSION_64_HEX_FROM_GET",
      "employeeCode": null
    }
  ]
}
```

## GET /api/users/{targetUserId}

Chi tiết metadata và Role.

- ScreenPermission: `WEB_USERS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: targetUserId: string<=100.
- Validation/nghiệp vụ: Chỉ các trường DTO; UserId giữ nguyên dạng chuỗi; ETag bao gồm auth version nội bộ.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 404; ETag; không hash/salt.

Request body: không có.

Response thành công:
```json
{
  "userId": "new.account",
  "email": "new.account@example.invalid",
  "employeeId": null,
  "status": "ACTIVE",
  "createdAt": "2026-10-26T00:00:00Z",
  "roles": [],
  "version": "VERSION_64_HEX_FROM_GET",
  "employeeCode": null
}
```

## POST /api/users

Tạo tài khoản; có thể tạo kèm hồ sơ nhân viên bằng createEmployee.

- ScreenPermission: `WEB_USERS/NEW; thêm WEB_USERS/APPROVE nếu có RoleIds`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: Không có.
- Validation/nghiệp vụ: UserId string max100, [A-Za-z0-9][A-Za-z0-9_.-]*; email255 unique; Employee tồn tại, chưa gán account; Role hợp lệ không trùng; password12..128, không blank; dùng PasswordService random salt32 PBKDF2. Role chỉ được gán trong quyền hiện có của actor.
- Success: `201`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 201; ID/email trùng409; employee/Role sai400; vượt quyền403; không password trong response/audit.

Request body:
```json
{
  "userId": "{{newUserId}}",
  "email": "new.account@example.invalid",
  "password": "{{newPassword}}",
  "employeeId": null,
  "roleIds": []
}
```

Response thành công:
```json
{
  "userId": "new.account",
  "email": "new.account@example.invalid",
  "employeeId": null,
  "status": "ACTIVE",
  "createdAt": "2026-10-26T00:00:00Z",
  "roles": [],
  "version": "VERSION_64_HEX_FROM_GET",
  "employeeCode": null
}
```

### Tạo User kèm Employee trong một transaction

`POST /api/users` thêm `createEmployee` boolean (mặc định false) và `employee` object tùy chọn. Giữ nguyên route, status 201 và các trường User cũ. Không dùng hai request tạo Employee rồi tạo User.

| Chế độ | Request | Hành vi |
| --- | --- | --- |
| Chỉ tạo User | createEmployee=false/bỏ qua; employeeId=null/bỏ qua | Không tạo Employee |
| Liên kết Employee hiện có | createEmployee=false/bỏ qua; employeeId là ID chưa có tài khoản | Giữ luồng cũ; không cần quyền tạo Employee |
| Tạo cả hai | createEmployee=true; employee là DTO tạo Employee | Tạo Employee, tự sinh code, gán User.EmployeeId và lưu cùng transaction |

Với createEmployee=true, không được truyền employeeId; employee bắt buộc. Khi createEmployee=false, không được gửi employee. Dữ liệu lồng dùng cùng validation hồ sơ, Department active, Position active khi gán, Team active cùng Department. employeeCode không có trong DTO và không được tin nếu client gửi field thừa.

Quyền: WEB_USERS/NEW như cũ; RoleIds không rỗng cần thêm WEB_USERS/APPROVE và nằm trong authority actor. Nếu tạo kèm Employee, bắt buộc **live WEB_EMPLOYEES/NEW** và data scope NEW có thể ghi: ALL hoặc DEPARTMENT đúng phòng ban; SELF không được ghi. Quyền tạo User không mở rộng phạm vi Employee. Không tự cấp thêm role/grant.

```json
{
  "userId": "new.employee",
  "email": "account@example.invalid",
  "password": "<new_password_12_128_chars>",
  "roleIds": [],
  "createEmployee": true,
  "employee": {
    "fullName": "Nguyen Van A",
    "email": "employee@example.invalid",
    "hireDate": "2024-01-01",
    "departmentId": 1,
    "teamId": null,
    "positionId": null,
    "employmentStatus": "ACTIVE"
  }
}
```

Employee.email và User.email là hai trường độc lập, kiểm tra unique trong bảng tương ứng. Không tự ghi đè email của hồ sơ hay tài khoản.

Response 201 mẫu (Id/code phụ thuộc dữ liệu hiện có):

```json
{
  "userId": "new.employee",
  "email": "account@example.invalid",
  "employeeId": 1,
  "employeeCode": "NV000001",
  "status": "ACTIVE",
  "createdAt": "2026-11-14T09:00:00Z",
  "roles": [],
  "version": "VERSION_64_HEX_FROM_GET"
}
```

AdminUserDto thêm `employeeCode` nullable để UI nhận mã đã cấp. GET user/list và response mutation dùng DTO này cũng trả mã liên kết, null nếu chưa gắn nhân viên. Chỉ bổ sung định danh, không trả toàn bộ hồ sơ Employee trong API Users.

Transaction dùng cùng AppDbContext và Serializable boundary hiện có của AdministrationService. User, Employee, code chính thức, UserRoles và audit EMPLOYEE_CREATED/USER_CREATE commit cùng nhau. Lỗi tạo user (duplicate, FK/DB, role/policy hoặc recovery guard) rollback cả Employee đã insert; không còn hồ sơ tạo dở. Không gọi CreateAsync có transaction riêng từ API User; dùng core tạo Employee trong transaction chung. Deadlock/lock-timeout MySQL chỉ được retry tối đa 3 lần sau rollback và kiểm tra lại quyền; không retry duplicate key hoặc lỗi commit không rõ kết quả.

Lỗi: 400 cho tổ hợp flags/body sai, dữ liệu Employee/FK nghiệp vụ sai; 403 thiếu quyền/scope hoặc vượt authority; 409 trùng user/email/constraint hoặc recovery guard; 500 lỗi DB ngoài các trường hợp được xử lý. Không đổi error envelope, PasswordService/JWT hay ETag các mutation User hiện có. Không cần If-Match cho POST tạo User.

[JSON đầy đủ tạo User + Employee](../../API/user-create-with-employee.sample.json). Các client cũ bỏ createEmployee vẫn hoạt động; client tạo Employee nên bỏ field employeeCode vì backend tự sinh và trả lại.

## PUT /api/users/{targetUserId}

Sửa email/liên kết nhân viên.

- ScreenPermission: `WEB_USERS/UPDATE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: targetUserId; If-Match.
- Validation/nghiệp vụ: Không đổi UserId qua body; email và employee unique; chặn takeover tài khoản có quyền vượt actor; thu hồi phiên.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Email trùng409; employee sai400; stale412; tài khoản đặc quyền cao hơn403.

Request body:
```json
{
  "email": "updated@example.invalid",
  "employeeId": null
}
```

Response thành công:
```json
{
  "userId": "new.account",
  "email": "updated@example.invalid",
  "employeeId": null,
  "status": "ACTIVE",
  "createdAt": "2026-10-26T00:00:00Z",
  "roles": [],
  "version": "VERSION_64_HEX_FROM_GET",
  "employeeCode": null
}
```

## PATCH /api/users/{targetUserId}/status

Thay trạng thái tài khoản.

- ScreenPermission: `WEB_USERS/UPDATE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: targetUserId; If-Match.
- Validation/nghiệp vụ: ACTIVE|LOCKED|INACTIVE; không khóa tài khoản quản trị cuối cùng; revoke access/refresh token.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Root cuối409; khóa user thường200; token cũ401.

Request body:
```json
{
  "status": "LOCKED"
}
```

Response thành công:
```json
{
  "userId": "new.account",
  "email": "new.account@example.invalid",
  "employeeId": null,
  "status": "LOCKED",
  "createdAt": "2026-10-26T00:00:00Z",
  "roles": [],
  "version": "VERSION_64_HEX_FROM_GET",
  "employeeCode": null
}
```

## POST /api/users/{targetUserId}/reset-password

Cùng một endpoint cho đổi mật khẩu chính mình và reset bởi quản trị viên. Không thêm route mới, không đổi PasswordService/JWT. Không yêu cầu `If-Match` cho thao tác này; các API quản trị khác giữ cơ chế ETag cũ.

### Request contract

Header: `Authorization: Bearer <access_token>`, `Content-Type: application/json`.

| Trường | Kiểu | Quy tắc |
| --- | --- | --- |
| type | string, bắt buộc | Chính xác `SELF_CHANGE` hoặc `ADMIN_RESET`; constants `PasswordResetTypes` ở backend |
| oldPassword | string/null | Bắt buộc với SELF_CHANGE, tối đa 1024; không bắt buộc và không dùng xác thực trong ADMIN_RESET |
| newPassword | string, bắt buộc | Policy quản trị hiện có: 12..128 ký tự, không blank; không thêm quy tắc mới vào PasswordService |

Không gửi `confirmPassword` lên backend. UI tự so khớp trước khi gọi API.

### SELF_CHANGE

Target phải trùng UserId JWT; không yêu cầu WEB_USERS/VIEW/UPDATE/APPROVE, không yêu cầu bootstrap quyền quản trị. Không thể dùng type này để đổi mật khẩu người khác, kể cả actor là admin. Mật khẩu cũ được kiểm tra bằng PasswordService hiện tại, chấp nhận credential legacy được verifier hỗ trợ.

```json
{
  "type": "SELF_CHANGE",
  "oldPassword": "{{oldPassword}}",
  "newPassword": "{{newPassword}}"
}
```

Sai mật khẩu cũ trả `401` theo envelope Auth hiện tại: `success=false`, `code=HRM_AUTH_001`, `error=INVALID_CREDENTIALS`, message `Invalid credentials.`, traceId. Không thay đổi credential/session version; người dùng có thể thử lại trong giới hạn rate limit. Target khác actor trả `403` trước khi tra tài khoản đích.

### ADMIN_RESET

Actor phải khác tài khoản đích. Backend kiểm tra `WEB_USERS/UPDATE` trực tiếp qua PermissionService tại thời điểm request; chỉ có APPROVE không đủ. Type do client gửi không cấp quyền. Kiểm tra danh tính tài khoản thực tế trong DB để không vượt rule tự reset qua cách viết hoa/thường của URL trên MySQL.

```json
{
  "type": "ADMIN_RESET",
  "newPassword": "{{newPassword}}"
}
```

Không cần mật khẩu cũ của actor hoặc target. Target phải tồn tại và toàn bộ capabilities của các role đích phải nằm trong authority hiện tại của actor theo `Dominates` hiện có, kể cả các quyền dormant/inactive mà chính sách quản trị bảo vệ. Giữ catalog lock, bootstrap và guard còn tài khoản phục hồi quản trị như các admin mutation hiện tại. Không suy quyền từ tên role.

### Response, transaction và bảo mật

Thành công: **204 No Content**, không trả user/version/ETag hoặc credential.

| HTTP | Ý nghĩa |
| --- | --- |
| 400 | Type thiếu/sai, oldPassword thiếu với SELF_CHANGE, password policy/DTO sai |
| 401 | Thiếu/sai/hết hiệu lực JWT; hoặc xác thực mật khẩu cũ thất bại với message chung |
| 403 | SELF_CHANGE nhắm tài khoản khác; ADMIN_RESET tự reset, thiếu live UPDATE hoặc target vượt authority; chưa đủ điều kiện bootstrap |
| 404 | Target ADMIN_RESET không tồn tại, sau khi actor đã vượt kiểm tra quyền |
| 409 | Guard phục hồi quản trị hiện có ngăn thao tác; transaction rollback |
| 429 | Vượt 5 request/phút/actor/API instance, quota chung cả hai type |
| 413 / 500 | Body quá giới hạn / lỗi hạ tầng |

Update hash/salt bằng PasswordService, tăng `users.auth_version` đúng một lần, revoke refresh token còn hiệu lực và ghi audit thành công trong cùng Serializable transaction. Không gửi Notification chứa password. Token cũ không còn dùng được ở request tiếp theo; SELF_CHANGE cần đăng nhập lại, ADMIN_RESET giữ phiên actor và vô hiệu phiên target.

Audit `PASSWORD_RESET` chỉ chứa `actorUserId`, `targetUserId`, `type`, `timestamp`, `result`, `traceId`; không serialize DTO, oldPassword, newPassword, hash hoặc salt. Các thất bại đi tới action/resource filter được audit sau rollback bằng context riêng. Rate limiting xảy ra trước model binding nên audit 429 có `type=UNKNOWN`; type không hợp lệ được chuẩn hóa thành `INVALID`/`UNKNOWN`, không ghi giá trị tùy ý của client. Request bị JWT middleware từ chối trước action vẫn theo access log/Auth hiện có. Nếu hạ tầng không ghi được audit thất bại, log lỗi vận hành chỉ chứa traceId, giữ nguyên response gốc.

### Compatibility và callers đã audit

Contract cũ yêu cầu `currentPassword` của actor, WEB_USERS/APPROVE và If-Match, trả 200 AdminUserDto. Contract này được thay bằng type tường minh và 204. Request cũ thiếu type trả 400, không âm thầm đoán mode.

Source callers tìm thấy: AdministrationApiTests và hai Postman Collection; chưa có runtime frontend caller cũ trong web-admin. Frontend mới thêm Mật khẩu & bảo mật: SELF_CHANGE có old/new/confirm; ADMIN_RESET có new/confirm và tài khoản đích, chỉ hiển thị khi có UPDATE. Không gửi confirm; thành công SELF_CHANGE xóa phiên local để đăng nhập lại. Client tích hợp ngoài repo cần cập nhật cùng contract.

Tests chi tiết: [PasswordResetApiTests](../../../backend/HRM.API.Tests/PasswordResetApiTests.cs) và [chính sách quản trị](SECURITY.md).

## PUT /api/users/{targetUserId}/roles

Thay toàn bộ Role assignments.

- ScreenPermission: `WEB_USERS/APPROVE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: targetUserId; If-Match.
- Validation/nghiệp vụ: Role tồn tại, unique, positive; [] xóa membership; không sửa Role chính mình; cả quyền cũ của target và quyền mới phải nằm trong quyền actor; transaction/audit/revoke.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Role sai400; tự gán403; nâng quyền403; nhiều Role OR; token cũ401.

Request body:
```json
{
  "roleIds": [
    "{{roleId}}"
  ]
}
```

Response thành công:
```json
{
  "userId": "new.account",
  "email": "new.account@example.invalid",
  "employeeId": null,
  "status": "ACTIVE",
  "createdAt": "2026-10-26T00:00:00Z",
  "roles": [
    {
      "id": 5,
      "code": "REVIEWED_ROLE",
      "name": "Reviewed role"
    }
  ],
  "version": "VERSION_64_HEX_FROM_GET",
  "employeeCode": null
}
```
