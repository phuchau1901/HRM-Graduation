# HRM API Examples — Administration

Các ví dụ không chứa mật khẩu/token thật. Import `HRM-API.postman_collection.json`; cấu hình baseUrl, userId, loginPassword bằng giá trị local/Vault; không export secret hoặc commit chúng. Đăng nhập như request Auth hiện có, token được lưu tạm để gọi API. Không chạy toàn bộ collection trên Railway vì request có mutation.

Trình tự an toàn: (1) operator duyệt và áp dụng migration ở bước riêng; (2) operator xác minh 3 catalog entries và bootstrap grant được duyệt; (3) login; (4) GET catalog/actions; (5) tạo Role rỗng; (6) GET matrix lấy ETag; (7) chỉ gửi các quyền đã duyệt và actor đang có; (8) tạo tài khoản/assign Role; (9) login bằng tài khoản test và xác minh 403; (10) revoke qua API, token cũ phải401, login mới nhận quyền mới.

Trong Postman có biến screenEtag/userEtag/roleEtag chứa nguyên quoted ETag, script đọc từ response. GET đúng resource trước từng mutation; roleId/screenId lấy từ resource thực, không tự giả định ID. Nhập newPassword và reauthPassword tại môi trường local/Vault; trường reauthPassword là password của actor. newUserId phải là tài khoản demo được phê duyệt, không dùng tài khoản production. Nếu action/key chuẩn dùng uppercase chính xác VIEW, NEW, UPDATE, DELETE, APPROVE, EXPORT.

## GET /api/screens?platform=WEB&page=1&pageSize=30

Catalog toàn bộ màn hình ACTIVE. Quyền `WEB_PERMISSIONS/VIEW`. Parameters: platform optional WEB|MOBILE, page>=1, pageSize 1..100, search<=150.

Request không body.

Success 200:
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

Validation: Không lọc theo grant màn hình của User; bỏ platform lấy WEB và MOBILE; luôn is_active=true.

Kiểm thử: 401/403; WEB/MOBILE; bỏ platform; inactive bị loại; pageSize=101 trả 400. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/screens/{screenId}

Chi tiết màn hình kể cả inactive. Quyền `WEB_PERMISSIONS/VIEW`. Parameters: screenId: long.

Request không body.

Success 200:
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

Validation: 404 khi không tồn tại; trả ETag.

Kiểm thử: GET lấy version trước sửa; id không tồn tại 404. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## POST /api/screens

Tạo catalog entry. Quyền `WEB_PERMISSIONS/NEW`. Parameters: Không có.

Request:
```json
{
  "code": "WEB_EXAMPLE",
  "name": "Example",
  "platform": "WEB",
  "icon": null,
  "isActive": true
}
```

Success 201:
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

Validation: Code unique, max100, uppercase [A-Z][A-Z0-9_]*; Name200; Icon100; WEB/MOBILE. Không tự tạo grant.

Kiểm thử: 201; code trùng 409; platform sai 400. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PUT /api/screens/{screenId}

Sửa catalog entry. Quyền `WEB_PERMISSIONS/UPDATE`. Parameters: screenId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{screenEtag}}
```

Request:
```json
{
  "code": "WEB_EXAMPLE",
  "name": "Updated example",
  "platform": "WEB",
  "icon": null,
  "isActive": true
}
```

Success 200:
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

Validation: Không đổi code/platform của màn hình có Role tham chiếu hoặc 3 mã bootstrap. Kích hoạt không được hồi sinh quyền vượt người thao tác.

Kiểm thử: 428 thiếu If-Match; 412 version cũ; rename màn hình referenced 409. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PATCH /api/screens/{screenId}/status

Bật/tắt màn hình. Quyền `WEB_PERMISSIONS/UPDATE`. Parameters: screenId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{screenEtag}}
```

Request:
```json
{
  "isActive": false
}
```

Success 200:
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

Validation: Không xóa cứng; chặn mất quản trị cuối cùng và kích hoạt dormant grants vượt quyền; thu hồi phiên user chịu ảnh hưởng.

Kiểm thử: Tắt entry thường OK; tắt WEB_PERMISSIONS 409; dormant privilege escalation 403. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/users?page=1&pageSize=30

Danh sách metadata tài khoản. Quyền `WEB_USERS/VIEW`. Parameters: page, pageSize, search (UserId/email).

Request không body.

Success 200:
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

Validation: Toàn cục theo quyền quản trị; không trả employee PII, hash, salt, password, authVersion.

Kiểm thử: 401/403; phân trang; không có trường bí mật. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/users/{targetUserId}

Chi tiết metadata và Role. Quyền `WEB_USERS/VIEW`. Parameters: targetUserId: string<=100.

Request không body.

Success 200:
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

Validation: Chỉ các trường DTO; UserId giữ nguyên dạng chuỗi; ETag bao gồm auth version nội bộ.

Kiểm thử: 404; ETag; không hash/salt. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## POST /api/users

Tạo tài khoản quản trị nội bộ. Quyền `WEB_USERS/NEW; thêm WEB_USERS/APPROVE nếu có RoleIds`. Parameters: Không có.

Request:
```json
{
  "userId": "{{newUserId}}",
  "email": "new.account@example.invalid",
  "password": "{{newPassword}}",
  "employeeId": null,
  "roleIds": []
}
```

Success 201:
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

Validation: UserId string max100, [A-Za-z0-9][A-Za-z0-9_.-]*; email255 unique; Employee tồn tại, chưa gán account; Role hợp lệ không trùng; password12..128, không blank; dùng PasswordService random salt32 PBKDF2. Role chỉ được gán trong quyền hiện có của actor.

Kiểm thử: 201; ID/email trùng409; employee/Role sai400; vượt quyền403; không password trong response/audit. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PUT /api/users/{targetUserId}

Sửa email/liên kết nhân viên. Quyền `WEB_USERS/UPDATE`. Parameters: targetUserId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{userEtag}}
```

Request:
```json
{
  "email": "updated@example.invalid",
  "employeeId": null
}
```

Success 200:
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

Validation: Không đổi UserId qua body; email và employee unique; chặn takeover tài khoản có quyền vượt actor; thu hồi phiên.

Kiểm thử: Email trùng409; employee sai400; stale412; tài khoản đặc quyền cao hơn403. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PATCH /api/users/{targetUserId}/status

Thay trạng thái tài khoản. Quyền `WEB_USERS/UPDATE`. Parameters: targetUserId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{userEtag}}
```

Request:
```json
{
  "status": "LOCKED"
}
```

Success 200:
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

Validation: ACTIVE|LOCKED|INACTIVE; không khóa tài khoản quản trị cuối cùng; revoke access/refresh token.

Kiểm thử: Root cuối409; khóa user thường200; token cũ401. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## POST /api/users/{targetUserId}/reset-password

Reset bởi quản trị viên đã xác thực lại. Quyền `WEB_USERS/APPROVE`. Parameters: targetUserId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{userEtag}}
```

Request:
```json
{
  "currentPassword": "{{reauthPassword}}",
  "newPassword": "{{newPassword}}"
}
```

Success 200:
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

Validation: currentPassword là mật khẩu hiện tại của ACTOR, không phải của target; từ chối tự reset, sai xác thực và target vượt quyền; 5 lần/phút/actor; newPassword12..128; audit không chứa credential; revoke access và refresh; không Notification mật khẩu. Không tự tạo mật khẩu.

Kiểm thử: Sai reauth403; thiếu quyền403; lần6=429; thành công200; token cũ401; password cũ login401. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PUT /api/users/{targetUserId}/roles

Thay toàn bộ Role assignments. Quyền `WEB_USERS/APPROVE`. Parameters: targetUserId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{userEtag}}
```

Request:
```json
{
  "roleIds": [
    "{{roleId}}"
  ]
}
```

Success 200:
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

Validation: Role tồn tại, unique, positive; [] xóa membership; không sửa Role chính mình; cả quyền cũ của target và quyền mới phải nằm trong quyền actor; transaction/audit/revoke.

Kiểm thử: Role sai400; tự gán403; nâng quyền403; nhiều Role OR; token cũ401. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/roles?page=1&pageSize=30

Danh sách Role. Quyền `WEB_ROLES/VIEW`. Parameters: page, pageSize, search (code/name).

Request không body.

Success 200:
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

Validation: Không hardcode quyền từ tên ADMIN/ALLROLL.

Kiểm thử: Phân trang; 401/403. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/roles/{roleId}

Chi tiết Role. Quyền `WEB_ROLES/VIEW`. Parameters: roleId: long.

Request không body.

Success 200:
```json
{
  "id": 5,
  "code": "REVIEWED_ROLE",
  "name": "Reviewed role",
  "version": "VERSION_64_HEX_FROM_GET"
}
```

Validation: ETag gồm metadata, matrix và membership của Role.

Kiểm thử: 404; lấy ETag trước cập nhật. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## POST /api/roles

Tạo Role rỗng. Quyền `WEB_ROLES/NEW`. Parameters: Không có.

Request:
```json
{
  "code": "REVIEWED_ROLE",
  "name": "Reviewed role"
}
```

Success 201:
```json
{
  "id": 5,
  "code": "REVIEWED_ROLE",
  "name": "Reviewed role",
  "version": "VERSION_64_HEX_FROM_GET"
}
```

Validation: Code30 uppercase unique; Name100; không tự thêm quyền hoặc membership, kể cả code ADMIN.

Kiểm thử: 201; code trùng409; Role mới không quyền. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PUT /api/roles/{roleId}

Sửa code/name Role. Quyền `WEB_ROLES/UPDATE`. Parameters: roleId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{roleEtag}}
```

Request:
```json
{
  "code": "REVIEWED_ROLE",
  "name": "Updated role"
}
```

Success 200:
```json
{
  "id": 5,
  "code": "REVIEWED_ROLE",
  "name": "Updated role",
  "version": "VERSION_64_HEX_FROM_GET"
}
```

Validation: Chỉ được quản trị Role có quyền nằm trong quyền actor; revoke phiên user thuộc Role. Không đổi grant.

Kiểm thử: 403 vượt quyền; 409 code trùng; 412 stale. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## DELETE /api/roles/{roleId}

Xóa Role không còn tham chiếu. Quyền `WEB_ROLES/DELETE`. Parameters: roleId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{roleEtag}}
```

Request không body.

Success 204:
Không body.

Validation: Phải gỡ UserRole, RoleDetail, RoleScreenAction tường minh trước; không cascade xóa âm thầm.

Kiểm thử: 204 khi Role rỗng; 409 nếu còn grant/membership; 428/412. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/roles/{roleId}/users?page=1&pageSize=30

Danh sách tài khoản của Role. Quyền `WEB_ROLES/VIEW AND WEB_USERS/VIEW`. Parameters: roleId; page, pageSize, search.

Request không body.

Success 200:
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

Validation: Không lộ user metadata chỉ bằng quyền xem Role; cần cả WEB_USERS/VIEW.

Kiểm thử: Thiếu một trong hai grant403; Role không tồn tại404; phân trang. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/roles/{roleId}/permissions

Đọc ma trận của Role. Quyền `WEB_PERMISSIONS/VIEW`. Parameters: roleId: long.

Request không body.

Success 200:
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

Validation: Các Screen đã có RoleDetail/extended grant, gồm inactive; giữ đầy đủ extended actions; catalog toàn bộ đọc qua /api/screens; ETag chung aggregate Role.

Kiểm thử: Nhiều screen không trùng; Role rỗng screens[]; ETag. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## PUT /api/roles/{roleId}/permissions

Patch các quyền đã được phê duyệt. Quyền `WEB_PERMISSIONS/UPDATE AND WEB_PERMISSIONS/APPROVE`. Parameters: roleId; If-Match.

```http
Authorization: Bearer {{token}}
If-Match: {{roleEtag}}
```

Request:
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

Success 200:
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

Validation: Chỉ 6 standard action chính xác uppercase. Omit flag giữ giá trị cũ. Omit extendedActions giữ nguyên, [] gỡ các extended đã đăng ký cho screen đó; cung cấp array thay các extended đã đăng ký; action lạ đã lưu giữ nguyên/read-only. Screen không có trong request không đổi. Không sửa Role đang gán cho actor. Quyền cũ/mới không vượt actor; toàn bộ transaction; audit before/after; phiên user ảnh hưởng hết hiệu lực.

Kiểm thử: 401/403; Screen/action sai400; request có screen trùng400; stale412; lỗi một mục rollback toàn bộ; không mất extended. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

## GET /api/authorization/actions

Catalog action được Backend cho phép. Quyền `WEB_PERMISSIONS/VIEW`. Parameters: Không có.

Request không body.

Success 200:
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

Validation: Không nhận ActionCode mới tùy ý từ client. Mở rộng sau này phải thêm registry PermissionActions và kiểm thử handler/service trước khi cấp quyền.

Kiểm thử: Đủ6 standard+5 extended; 401/403. Lỗi chung 400/401/403/404/409/412/428/429/413/500 theo điều kiện trong spec.

