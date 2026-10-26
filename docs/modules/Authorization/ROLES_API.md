# Authorization — API quản trị Role

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Mọi mutation dùng transaction, live-grant check và If-Match theo [chính sách quản trị](SECURITY.md).

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/roles?page=1&pageSize=30` | WEB_ROLES/VIEW |
| GET | `/api/roles/{roleId}` | WEB_ROLES/VIEW |
| POST | `/api/roles` | WEB_ROLES/NEW |
| PUT | `/api/roles/{roleId}` | WEB_ROLES/UPDATE |
| DELETE | `/api/roles/{roleId}` | WEB_ROLES/DELETE |
| GET | `/api/roles/{roleId}/users?page=1&pageSize=30` | WEB_ROLES/VIEW AND WEB_USERS/VIEW |

## GET /api/roles?page=1&pageSize=30

Danh sách Role.

- ScreenPermission: `WEB_ROLES/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: page, pageSize, search (code/name).
- Validation/nghiệp vụ: Không hardcode quyền từ tên ADMIN/ALLROLL.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Phân trang; 401/403.

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
      "id": 5,
      "code": "REVIEWED_ROLE",
      "name": "Reviewed role",
      "version": "VERSION_64_HEX_FROM_GET"
    }
  ]
}
```

## GET /api/roles/{roleId}

Chi tiết Role.

- ScreenPermission: `WEB_ROLES/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: roleId: long.
- Validation/nghiệp vụ: ETag gồm metadata, matrix và membership của Role.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 404; lấy ETag trước cập nhật.

Request body: không có.

Response thành công:
```json
{
  "id": 5,
  "code": "REVIEWED_ROLE",
  "name": "Reviewed role",
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## POST /api/roles

Tạo Role rỗng.

- ScreenPermission: `WEB_ROLES/NEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: Không có.
- Validation/nghiệp vụ: Code30 uppercase unique; Name100; không tự thêm quyền hoặc membership, kể cả code ADMIN.
- Success: `201`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 201; code trùng409; Role mới không quyền.

Request body:
```json
{
  "code": "REVIEWED_ROLE",
  "name": "Reviewed role"
}
```

Response thành công:
```json
{
  "id": 5,
  "code": "REVIEWED_ROLE",
  "name": "Reviewed role",
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## PUT /api/roles/{roleId}

Sửa code/name Role.

- ScreenPermission: `WEB_ROLES/UPDATE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: roleId; If-Match.
- Validation/nghiệp vụ: Chỉ được quản trị Role có quyền nằm trong quyền actor; revoke phiên user thuộc Role. Không đổi grant.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 403 vượt quyền; 409 code trùng; 412 stale.

Request body:
```json
{
  "code": "REVIEWED_ROLE",
  "name": "Updated role"
}
```

Response thành công:
```json
{
  "id": 5,
  "code": "REVIEWED_ROLE",
  "name": "Updated role",
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## DELETE /api/roles/{roleId}

Xóa Role không còn tham chiếu.

- ScreenPermission: `WEB_ROLES/DELETE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: roleId; If-Match.
- Validation/nghiệp vụ: Phải gỡ UserRole, RoleDetail, RoleScreenAction tường minh trước; không cascade xóa âm thầm.
- Success: `204`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 204 khi Role rỗng; 409 nếu còn grant/membership; 428/412.

Request body: không có.

Response thành công: 204, không body.

## GET /api/roles/{roleId}/users?page=1&pageSize=30

Danh sách tài khoản của Role.

- ScreenPermission: `WEB_ROLES/VIEW AND WEB_USERS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: roleId; page, pageSize, search.
- Validation/nghiệp vụ: Không lộ user metadata chỉ bằng quyền xem Role; cần cả WEB_USERS/VIEW.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Thiếu một trong hai grant403; Role không tồn tại404; phân trang.

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
