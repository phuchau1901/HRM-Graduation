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
| POST | `/api/users/{targetUserId}/reset-password` | WEB_USERS/APPROVE |
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
      "version": "VERSION_64_HEX_FROM_GET"
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
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## POST /api/users

Tạo tài khoản quản trị nội bộ.

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
  "version": "VERSION_64_HEX_FROM_GET"
}
```

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
  "version": "VERSION_64_HEX_FROM_GET"
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
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## POST /api/users/{targetUserId}/reset-password

Reset bởi quản trị viên đã xác thực lại.

- ScreenPermission: `WEB_USERS/APPROVE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: targetUserId; If-Match.
- Validation/nghiệp vụ: currentPassword là mật khẩu hiện tại của ACTOR, không phải của target; từ chối tự reset, sai xác thực và target vượt quyền; 5 lần/phút/actor; newPassword12..128; audit không chứa credential; revoke access và refresh; không Notification mật khẩu. Không tự tạo mật khẩu.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Sai reauth403; thiếu quyền403; lần6=429; thành công200; token cũ401; password cũ login401.

Request body:
```json
{
  "currentPassword": "{{reauthPassword}}",
  "newPassword": "{{newPassword}}"
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
  "version": "VERSION_64_HEX_FROM_GET"
}
```

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
  "version": "VERSION_64_HEX_FROM_GET"
}
```
