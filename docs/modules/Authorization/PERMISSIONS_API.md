# Authorization — API ma trận quyền

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Mọi mutation dùng transaction, live-grant check và If-Match theo [chính sách quản trị](SECURITY.md).

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/roles/{roleId}/permissions` | WEB_PERMISSIONS/VIEW |
| PUT | `/api/roles/{roleId}/permissions` | WEB_PERMISSIONS/UPDATE AND WEB_PERMISSIONS/APPROVE |
| GET | `/api/authorization/actions` | WEB_PERMISSIONS/VIEW |

## GET /api/roles/{roleId}/permissions

Đọc ma trận của Role.

- ScreenPermission: `WEB_PERMISSIONS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: roleId: long.
- Validation/nghiệp vụ: Các Screen đã có RoleDetail/extended grant, gồm inactive; giữ đầy đủ extended actions; catalog toàn bộ đọc qua /api/screens; ETag chung aggregate Role.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Nhiều screen không trùng; Role rỗng screens[]; ETag.

Request body: không có.

Response thành công:
```json
{
  "roleId": 5,
  "screens": [
    {
      "screenId": 40,
      "screenCode": "WEB_EXAMPLE",
      "name": "Example",
      "platform": "WEB",
      "isActive": true,
      "standard": {
        "VIEW": true,
        "NEW": false,
        "UPDATE": false,
        "DELETE": false,
        "APPROVE": false,
        "EXPORT": false
      },
      "extendedActions": []
    }
  ],
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## PUT /api/roles/{roleId}/permissions

Patch các quyền đã được phê duyệt.

- ScreenPermission: `WEB_PERMISSIONS/UPDATE AND WEB_PERMISSIONS/APPROVE`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: roleId; If-Match.
- Validation/nghiệp vụ: Chỉ 6 standard action chính xác uppercase. Omit flag giữ giá trị cũ. Omit extendedActions giữ nguyên, [] gỡ các extended đã đăng ký cho screen đó; cung cấp array thay các extended đã đăng ký; action lạ đã lưu giữ nguyên/read-only. Screen không có trong request không đổi. Không sửa Role đang gán cho actor. Quyền cũ/mới không vượt actor; toàn bộ transaction; audit before/after; phiên user ảnh hưởng hết hiệu lực.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: 401/403; Screen/action sai400; request có screen trùng400; stale412; lỗi một mục rollback toàn bộ; không mất extended.

Request body:
```json
{
  "screens": [
    {
      "screenCode": "WEB_EXAMPLE",
      "standard": {
        "VIEW": true,
        "NEW": false
      },
      "extendedActions": [
        "SEND_USER"
      ]
    }
  ]
}
```

Response thành công:
```json
{
  "roleId": 5,
  "screens": [
    {
      "screenId": 40,
      "screenCode": "WEB_EXAMPLE",
      "name": "Example",
      "platform": "WEB",
      "isActive": true,
      "standard": {
        "VIEW": true,
        "NEW": false,
        "UPDATE": false,
        "DELETE": false,
        "APPROVE": false,
        "EXPORT": false
      },
      "extendedActions": ["SEND_USER"]
    }
  ],
  "version": "VERSION_64_HEX_FROM_GET"
}
```

## GET /api/authorization/actions

Catalog action được Backend cho phép.

- ScreenPermission: `WEB_PERMISSIONS/VIEW`. Role: tài khoản có grant tương ứng; không có bypass theo tên Role.
- Parameters: Không có.
- Validation/nghiệp vụ: Không nhận ActionCode mới tùy ý từ client. Mở rộng sau này phải thêm registry PermissionActions và kiểm thử handler/service trước khi cấp quyền.
- Success: `200`; errors: 400, 401, 403, 404 khi có path resource, 409 khi xung đột, 412/428 khi cần If-Match, 429 cho reset, 413 khi quá body limit, 500 khi hạ tầng lỗi.
- Test cases: Đủ6 standard+5 extended; 401/403.

Request body: không có.

Response thành công:
```json
{
  "standard": [
    "APPROVE",
    "DELETE",
    "EXPORT",
    "NEW",
    "UPDATE",
    "VIEW"
  ],
  "extended": [
    "CANCEL",
    "SCHEDULE",
    "SEND_ALL",
    "SEND_GROUP",
    "SEND_USER"
  ]
}
```
