# Authorization — API quản trị Role

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Mutation dùng transaction và live-grant check theo [chính sách quản trị](SECURITY.md). Tạo role không cần `If-Match`; cập nhật/xóa role và cập nhật permissions cần `If-Match`.

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/roles?page=1&pageSize=30` | WEB_ROLES/VIEW |
| GET | `/api/roles/{roleId}` | WEB_ROLES/VIEW |
| POST | `/api/roles` | WEB_ROLES/NEW |
| PUT | `/api/roles/{roleId}` | WEB_ROLES/UPDATE |
| DELETE | `/api/roles/{roleId}` | WEB_ROLES/DELETE |
| GET | `/api/roles/{roleId}/users?page=1&pageSize=30` | WEB_ROLES/VIEW AND WEB_USERS/VIEW |

## Thêm/sửa role và cấu hình `dataScopes`

`POST /api/roles` và `PUT /api/roles/{roleId}` chỉ xử lý `code`, `name`; không xử lý `screens`, `standard`, `extendedActions` hoặc `dataScopes`. Role mới chưa có quyền. Cấu hình quyền và phạm vi dữ liệu qua API permissions riêng:

| Mục đích | API | Quyền quản trị |
| --- | --- | --- |
| Đọc quyền và `dataScopes` của role | `GET /api/roles/{roleId}/permissions` | `WEB_PERMISSIONS / VIEW` |
| Cập nhật quyền và `dataScopes` | `PUT /api/roles/{roleId}/permissions` | `WEB_PERMISSIONS / UPDATE` và `APPROVE` |

Không có endpoint CRUD riêng `/api/role-screen-actions`. API permissions xử lý `role_screen_actions` theo role/screen/action. Grant chuẩn nằm trong `role_details`; `role_screen_actions.data_scope` bổ sung phạm vi, không tự cấp grant chuẩn.

Luồng cho form thêm/sửa role có chọn quyền:

1. Tạo role bằng `POST /api/roles`, lấy `id`; hoặc đọc `GET /api/roles/{roleId}` lấy `ETag` rồi gọi `PUT /api/roles/{roleId}` để sửa tên/mã với header `If-Match`.
2. Đọc `GET /api/roles/{roleId}/permissions` lấy ma trận và `ETag` mới nhất.
3. Gọi `PUT /api/roles/{roleId}/permissions` với `If-Match` từ bước 2 và body ví dụ dưới đây.

```json
{
  "screens": [
    {
      "screenCode": "WEB_EMPLOYEES",
      "standard": { "VIEW": true, "UPDATE": true },
      "dataScopes": { "VIEW": "ALL", "UPDATE": "DEPARTMENT" }
    }
  ]
}
```

Ví dụ cho xem tất cả nhân viên, sửa hồ sơ trong cùng phòng ban; không cho chuyển phòng ban vì thao tác này cần `UPDATE` với scope `ALL`. Các giá trị scope là `SELF`, `DEPARTMENT`, `ALL` hoặc `null` để xóa scope. `SELF` chỉ dùng để đọc trong bộ Nhân viên.

Hai bước lưu thông tin role và lưu permissions là hai request riêng, không có transaction chung. Sau mỗi mutation, lấy `ETag` mới trước lần cập nhật tiếp theo; dùng version cũ có thể trả `412`. Cập nhật permissions không cho sửa role đang gán cho chính actor hoặc cấp quyền/phạm vi vượt actor.

Xem [chi tiết body, quy tắc patch và lỗi API permissions](PERMISSIONS_API.md#datascopes-và-role_screen_actions) và [scope theo từng API nhân viên/hợp đồng](../Employees/DATA_SCOPE.md#cấu-hình-datascopes-cho-api-nhân-viên).

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
