# Authorization — API danh mục màn hình

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Mọi mutation dùng transaction, live-grant check và If-Match theo [chính sách quản trị](SECURITY.md). Catalog không bị giới hạn theo các màn hình cá nhân được cấp.

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/screens?platform=WEB&page=1&pageSize=30` | WEB_PERMISSIONS/VIEW |
| GET | `/api/screens/{screenId}` | WEB_PERMISSIONS/VIEW |
| POST | `/api/screens` | WEB_PERMISSIONS/NEW |
| PUT | `/api/screens/{screenId}` | WEB_PERMISSIONS/UPDATE |
| PATCH | `/api/screens/{screenId}/status` | WEB_PERMISSIONS/UPDATE |

## GET /api/screens?platform=WEB&page=1&pageSize=30

Catalog toàn bộ màn hình ACTIVE.

- ScreenPermission: `WEB_PERMISSIONS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: platform optional WEB|MOBILE, page>=1, pageSize 1..100, search<=150.
- Validation/nghiệp vụ: Không lọc theo grant màn hình của User; bỏ platform lấy WEB và MOBILE; luôn is_active=true.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 401/403; WEB/MOBILE; bỏ platform; inactive bị loại; pageSize=101 trả 400.

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
      "id": 40,
      "code": "WEB_EXAMPLE",
      "name": "Example",
      "platform": "WEB",
      "icon": null,
      "isActive": true,
      "version": "VERSION_64_HEX_FROM_GET"
    }
  ]
}
```

## GET /api/screens/{screenId}

Chi tiết màn hình kể cả inactive.

- ScreenPermission: `WEB_PERMISSIONS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: screenId: long.
- Validation/nghiệp vụ: 404 khi không tồn tại; trả ETag.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: GET lấy version trước sửa; id không tồn tại 404.

Request body: không có.

Response thành công:
```json
{
  "id": 40,
  "code": "WEB_EXAMPLE",
  "name": "Example",
  "platform": "WEB",
  "icon": null,
  "isActive": true,
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## POST /api/screens

Tạo catalog entry.

- ScreenPermission: `WEB_PERMISSIONS/NEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: Không có.
- Validation/nghiệp vụ: Code unique, max100, uppercase [A-Z][A-Z0-9_]*; Name200; Icon100; WEB/MOBILE. Không tự tạo grant.
- Success: `201`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 201; code trùng 409; platform sai 400.

Request body:
```json
{
  "code": "WEB_EXAMPLE",
  "name": "Example",
  "platform": "WEB",
  "icon": null,
  "isActive": true
}
```

Response thành công:
```json
{
  "id": 40,
  "code": "WEB_EXAMPLE",
  "name": "Example",
  "platform": "WEB",
  "icon": null,
  "isActive": true,
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## PUT /api/screens/{screenId}

Sửa catalog entry.

- ScreenPermission: `WEB_PERMISSIONS/UPDATE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: screenId; If-Match.
- Validation/nghiệp vụ: Không đổi code/platform của màn hình có Role tham chiếu hoặc 3 mã bootstrap. Kích hoạt không được hồi sinh quyền vượt người thao tác.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 428 thiếu If-Match; 412 version cũ; rename màn hình referenced 409.

Request body:
```json
{
  "code": "WEB_EXAMPLE",
  "name": "Updated example",
  "platform": "WEB",
  "icon": null,
  "isActive": true
}
```

Response thành công:
```json
{
  "id": 40,
  "code": "WEB_EXAMPLE",
  "name": "Updated example",
  "platform": "WEB",
  "icon": null,
  "isActive": true,
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## PATCH /api/screens/{screenId}/status

Bật/tắt màn hình.

- ScreenPermission: `WEB_PERMISSIONS/UPDATE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: screenId; If-Match.
- Validation/nghiệp vụ: Không xóa cứng; chặn mất quản trị cuối cùng và kích hoạt dormant grants vượt quyền; thu hồi phiên user chịu ảnh hưởng.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Tắt entry thường OK; tắt WEB_PERMISSIONS 409; dormant privilege escalation 403.

Request body:
```json
{
  "isActive": false
}
```

Response thành công:
```json
{
  "id": 40,
  "code": "WEB_EXAMPLE",
  "name": "Example",
  "platform": "WEB",
  "icon": null,
  "isActive": false,
  "version": "VERSION_64_HEX_FROM_GET"
}
```
