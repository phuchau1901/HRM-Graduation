# Authorization — API ma trận quyền

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Mọi mutation dùng transaction, live-grant check và If-Match theo [chính sách quản trị](SECURITY.md).

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/roles/{roleId}/permissions` | WEB_PERMISSIONS/VIEW |
| PUT | `/api/roles/{roleId}/permissions` | WEB_PERMISSIONS/UPDATE AND WEB_PERMISSIONS/APPROVE |
| GET | `/api/authorization/actions` | WEB_PERMISSIONS/VIEW |

## `dataScopes` và `role_screen_actions`

Đây là API đọc/cập nhật `role_screen_actions`; không có endpoint CRUD riêng cho bảng này. Tạo/sửa metadata role bằng `POST /api/roles` hoặc `PUT /api/roles/{roleId}` không lưu `dataScopes`.

Mỗi phần tử `screens[]` hỗ trợ:

| Trường | Ý nghĩa | Khi bỏ qua |
| --- | --- | --- |
| `screenCode` | Mã screen có sẵn, ví dụ `WEB_EMPLOYEES`, `WEB_CONTRACTS` | Bắt buộc |
| `standard` | Dictionary grant boolean cho `VIEW`, `NEW`, `UPDATE`, `DELETE`, `APPROVE`, `EXPORT`; lưu ở `role_details` | Giữ nguyên các flag không gửi |
| `extendedActions` | Danh sách grant mở rộng đã đăng ký; lưu ở `role_screen_actions` | Giữ nguyên; gửi `[]` gỡ grant mở rộng, không gỡ metadata scope của standard action |
| `dataScopes` | Dictionary action → phạm vi tại `role_screen_actions.data_scope` | Giữ nguyên các scope không gửi |

| Giá trị scope | Ý nghĩa với bộ Nhân viên |
| --- | --- |
| `SELF` | Chỉ đọc hồ sơ/hợp đồng của nhân viên liên kết với tài khoản; không được ghi |
| `DEPARTMENT` | Đọc/ghi nhân viên cùng phòng ban hiện tại; không được chuyển phòng ban |
| `ALL` | Đọc/ghi toàn bộ nhân viên; vẫn cần grant tương ứng |
| `null` | Xóa giá trị scope của action trong role này, không đồng nghĩa `ALL` |

Action và scope chuỗi phải đúng mã uppercase. Giá trị lạ trả `400`. Chỉ lưu `dataScopes` không bật grant chuẩn: muốn cấp quyền cần gửi thêm `standard` hoặc đã có grant cùng screen/action trong role đó. `standard: { "VIEW": false }` tắt grant nhưng không tự xóa metadata scope; muốn xóa scope gửi `dataScopes: { "VIEW": null }`.

Với action mở rộng, scope khác null cần grant mở rộng tồn tại hoặc được cấp cùng request. Các row scope của standard action không xuất hiện trong `extendedActions`.

Scope hiệu lực chỉ tổng hợp từ role có grant cùng screen/action: `ALL > DEPARTMENT > SELF`. Không có scope hợp lệ thì API nhân viên trả `403`; scope `SELF` vẫn bị từ chối khi ghi dù API permissions chấp nhận lưu giá trị này. Chuyển phòng ban cần `WEB_EMPLOYEES / UPDATE` với scope `ALL`. Xem [bảng scope dùng được theo endpoint](../Employees/DATA_SCOPE.md#scope-dùng-được-theo-endpoint).

### Ví dụ cập nhật quyền nhân viên và scope

Đọc `GET /api/roles/{roleId}/permissions` trước, lấy nguyên header `ETag` để gửi trong `If-Match`:

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
      "standard": { "VIEW": true, "NEW": true, "UPDATE": true },
      "dataScopes": { "VIEW": "ALL", "NEW": "DEPARTMENT", "UPDATE": "DEPARTMENT" }
    },
    {
      "screenCode": "WEB_CONTRACTS",
      "standard": { "VIEW": true },
      "dataScopes": { "VIEW": "SELF" }
    }
  ]
}
```

Để chỉ đổi phạm vi xem, gửi `screens: [{ "screenCode": "WEB_EMPLOYEES", "dataScopes": { "VIEW": "DEPARTMENT" } }]`; grant và scope khác giữ nguyên. Muốn xóa scope xem, thay giá trị bằng `null`. Thay đổi chỉ áp dụng trong role đang sửa; user vẫn có thể nhận scope từ role khác.

Thiếu `If-Match` trả `428`; version cũ trả `412`; thiếu quyền quản trị, sửa role đang gán cho actor hoặc cấp scope vượt actor trả `403`; action/scope không hợp lệ trả `400`. Toàn bộ request permissions chạy trong một transaction. Response `200` trả ma trận cùng `version` và header `ETag` mới; scope tham gia tính version. User bị ảnh hưởng cần đăng nhập lại sau thay đổi quyền.

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
      "extendedActions": [],
      "dataScopes": { "VIEW": "DEPARTMENT" }
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
      ],
      "dataScopes": { "VIEW": "DEPARTMENT" }
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
      "extendedActions": ["SEND_USER"],
      "dataScopes": { "VIEW": "DEPARTMENT" }
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
