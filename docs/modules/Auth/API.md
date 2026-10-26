# Auth — API

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| POST | `/api/auth/login` | Anonymous + LoginRateLimiter |
| GET | `/api/auth/me` | JWT, User ACTIVE, session version hợp lệ |
| GET | `/api/auth/me/permissions` | JWT, User ACTIVE, session version hợp lệ |

## POST /api/auth/login

Đăng nhập bằng UserId chuỗi, giữ alias username.

- Role/Permission: **Anonymous; LoginRateLimiter**.
- Query/Path/Header: Body userId hoặc username; password.
- HTTP errors: 400, 401, 429, 500.
- Validation/nghiệp vụ: Không gửi hai alias khác tài khoản. Không ghi log password/token. Giữ PasswordService và JWT hiện tại.

JSON Request mẫu:

```json
{
  "userId": "{{userId}}",
  "password": "{{loginPassword}}"
}
```

JSON Response thành công — HTTP 200:

```json
{
  "accessToken": "<JWT sinh lúc chạy>",
  "tokenType": "Bearer",
  "expiresAtUtc": "2026-10-24T10:15:00Z",
  "user": {
    "userId": "{{userId}}",
    "email": "demo@example.invalid",
    "employeeId": 1
  },
  "roles": [
    {
      "id": 1,
      "code": "EXPLICITLY_GRANTED_ROLE",
      "name": "Role được cấp quyền"
    }
  ],
  "permissions": [
    {
      "screenId": 1,
      "code": "WEB_EMPLOYEES",
      "name": "Employees",
      "platform": "WEB",
      "icon": null,
      "canNew": "N",
      "canView": "Y",
      "canUpdate": "N",
      "canDelete": "N",
      "canApprove": "N",
      "canExport": "N"
    }
  ]
}
```

### Kiểm thử endpoint

Đăng nhập đúng trả200; sai/không tồn tại trả401 cùng thông điệp; alias xung đột bị từ chối; vượt rate limit trả429; response không có hash/salt.

## GET /api/auth/me

Profile hiện tại.

- Role/Permission: **JWT + User ACTIVE**.
- Query/Path/Header: Không có query/path/body.
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Không phụ thuộc quyền màn hình; giữ nguyên JSON.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "user": {
    "userId": "{{userId}}",
    "email": "demo@example.invalid",
    "employeeId": 1
  },
  "roles": [
    {
      "id": 1,
      "code": "EXPLICITLY_GRANTED_ROLE",
      "name": "Role được cấp quyền"
    }
  ],
  "permissions": [
    {
      "screenId": 1,
      "code": "WEB_EMPLOYEES",
      "name": "Employees",
      "platform": "WEB",
      "icon": null,
      "canNew": "N",
      "canView": "Y",
      "canUpdate": "N",
      "canDelete": "N",
      "canApprove": "N",
      "canExport": "N"
    }
  ]
}
```

### Kiểm thử endpoint

JWT hợp lệ trả200; không JWT/JWT sai/hết hạn/phiên bị thu hồi trả401; User bị khóa không được truy cập; kiểm tra quyền nhiều Role được OR và không trùng Screen.

## GET /api/auth/me/permissions

Danh sách màn hình xem được.

- Role/Permission: **JWT + User ACTIVE**.
- Query/Path/Header: Không có query/path/body.
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: OR nhiều Role, chỉ CanView=Y, không tự bypass ADMIN.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
[
  {
    "screenId": 1,
    "code": "WEB_EMPLOYEES",
    "name": "Employees",
    "platform": "WEB",
    "icon": null,
    "canNew": "N",
    "canView": "Y",
    "canUpdate": "N",
    "canDelete": "N",
    "canApprove": "N",
    "canExport": "N"
  }
]
```

### Kiểm thử endpoint

JWT hợp lệ trả200; không JWT/JWT sai/hết hạn/phiên bị thu hồi trả401; User bị khóa không được truy cập; kiểm tra quyền nhiều Role được OR và không trùng Screen.
