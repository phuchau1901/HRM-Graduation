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

Missing If-Match returns 428; stale version returns 412. Missing live WEB_PERMISSIONS UPDATE/APPROVE authority or granting an inactive screen returns 403. Invalid action/scope returns 400. Own-role permission edits are allowed, subject to authority and recovery checks. Scope changes are transactional and revoke affected sessions.

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
- Validation: live WEB_PERMISSIONS/UPDATE+APPROVE, If-Match, active-screen/action validation and recovery protection. Own-role permission edits are allowed. Writes are atomic, audited and revoke affected sessions.
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
  ],
  "dataScopes": [
    "SELF",
    "DEPARTMENT",
    "ALL"
  ]
}
```

## Generic data scopes for every screen/action

Live WEB_PERMISSIONS/UPDATE+APPROVE authorizes configuration of SELF/DEPARTMENT/ALL for any existing active screen and registered action, independently of the administrator's personal data scope. No Contract/Employee screen names are hardcoded in scope validation. For matrix edits, live UPDATE+APPROVE replace personal target-screen action/role dominance checks; If-Match, active-screen/action validation and recovery protection still apply. Standard or extended action grants remain distinct from scope metadata; setting a scope does not grant an action.

The dataScopes dictionary is optional. Omitted dictionaries or keys preserve current values; explicit null clears a scope. Unknown scope/action returns 400. A non-null scope on an inactive screen is denied. Extended scope metadata requires an existing or simultaneously granted extended action. New modules can use the same storage, matrix and permission resolver without adding special cases here.

GET /api/authorization/actions now also returns dataScopes: ["SELF", "DEPARTMENT", "ALL"]. Frontends can obtain the choices from this shared discovery API, and send an optional dataScopes dictionary for a screen that needs row filtering. It does not automatically impose employee filtering on global configuration screens; each business API must explicitly apply its appropriate scope filter.

Permission administrators may update permissions of a role assigned to themselves. Removing the last recovery administrator returns 409 and rolls back. Changing one's own role membership through /api/users/{userId}/roles remains separate with its existing rules. Successful permission edits return 200/new ETag and revoke affected sessions, including the actor's session when their role changed; sign in again.

Runtime data access remains unchanged. For Employee-related APIs, SELF uses users.employee_id, DEPARTMENT uses the linked employee's department, and ALL covers all permitted records. Missing scope still denies data access where required. Configuring another role does not change the actor's own data visibility.

Validation: 105 related administration, permission, contract-statistics, Employee and Team tests passed, including generic Web/Mobile screen codes, standard/extended scopes, invalid and inactive configuration, null clearing, recovery and session invalidation. No migration or deployment was performed.

## Granting newly registered screens

PUT /api/roles/{id}/permissions requires live WEB_PERMISSIONS UPDATE and APPROVE. It can grant standard/registered extended actions on any active screen, including WEB_APPROVAL_SETTINGS, even when the administrator has no personal grants for that screen and the target role already has such grants. No screen-name exceptions or implicit role-name privileges. Unknown actions/inactive screens are rejected; If-Match, atomic audit/revocation and the last recovery administrator guard remain. User/role assignment and reset-password authority are unchanged. No migration needed.
