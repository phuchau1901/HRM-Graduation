# HRM API Specification — Organization và Employees (2026-10-24)

Kết quả audit ban đầu: [HRM_API_INVENTORY.md](HRM_API_INVENTORY.md). Spec này mô tả **31 REST endpoint thực tế** sau đợt đầu; không mô tả endpoint tưởng tượng cho module chưa triển khai. Auth/Notification được giữ nguyên và chỉ tích hợp service có sẵn.

## Quy ước

- `baseUrl` là địa chỉ API của môi trường đang chạy; HTTPS. Tất cả endpoint trừ Login dùng `Authorization: Bearer {{token}}`. JSON camelCase; DateOnly `yyyy-MM-dd`, thời gian trả UTC khi DTO mới có timestamp.
- Role/Permission nghĩa bất kỳ Role được cấp action tương ứng trong database, OR nhiều Role; không cố định quyền theo tên ADMIN/HR/MANAGER. JWT permission snapshot do server phát, không tin role/permission/userId/scope từ body.
- Model validation: 400 application/problem+json (ASP.NET Core). Lỗi business/auth: `{success:false,code,error,message,traceId}`. 401 HRM_AUTH_001/002, 403 HRM_AUTH_003 (permission), HRM_AUTH_004 (data scope), 429 HRM_AUTH_005. Resource 404 HRM_RESOURCE_404, conflict 409 HRM_RESOURCE_409, business validation 400 HRM_VALIDATION_400; Notification giữ mã riêng hiện có. 500 chung không lộ SQL/stack/secret.
- List mới trả `{success,total,page,pageSize,data}`; ID đơn GET/POST/PUT trả DTO; 201 có Location; 204 không body. GET departments giữ success/total/data và thêm page/pageSize; mặc định chỉ lấy 30 dòng thay vì danh sách không giới hạn.
- `search` là chuỗi tìm literal do EF parameterize, không nhận SQL/expression/sort tùy ý; số trang quá lớn trả 400.

## Data Scope và cấp quyền trước khi sử dụng

Scope hiện chưa có schema trong dự án. Đợt đầu dùng cấu hình Backend tường minh, không tạo bảng/cột/claim hoặc suy scope từ Role. Ví dụ cấu hình **minh họa, chưa ghi vào appsettings/Railway**:

```json
{"EmployeeDataScopes":{"Users":{"hr01":"ALL","manager01":"DEPARTMENT","employee01":"SELF"}}}
```

Environment tương đương `EmployeeDataScopes__Users__hr01=ALL`. Chỉ operator được cấp cấu hình; dùng UserId canonical trong JWT. Mặc định thiếu cấu hình là SELF **chỉ đọc**, không có EmployeeId thì danh sách rỗng. DEPARTMENT lấy phòng hiện tại từ User.EmployeeId → Employee.DepartmentId trong DB mỗi request, áp cho cả peer; ALL nhìn toàn bộ. SELF không ghi. DEPARTMENT ghi trong phòng mình; chuyển liên phòng cần ALL. User scope ALL vẫn phải có ScreenPermission, Role ADMIN không tự bypass. Invalid scope config dừng startup.

Scope là cơ chế cấu hình ban đầu; chưa có API quản trị/DB Data Scope. Cần xác nhận mapping người dùng trước triển khai thật. Quyền danh mục Organization là global catalog theo ScreenPermission, không mở truy cập PII nhân viên. Nếu cần field-level giới hạn hợp đồng cho manager, cần thiết kế scope riêng trước cấp quyền WEB_CONTRACTS.

Screen dùng: WEB_DEPARTMENTS (đã có trong source), WEB_EMPLOYEES, **WEB_POSITIONS**, **WEB_CONTRACTS**. Hai mã sau được định nghĩa cho API mới, chưa được xác minh/provision vào catalog Railway trong lần này; cần đối chiếu/tạo và cấp RoleDetail tường minh sau xác nhận. Nếu catalog khác, đối chiếu/sửa mapping trước deploy; không dùng mã gần giống để lách quyền. Chưa tự cấp quyền/seed/migration/đổi Railway. Flutter/React dùng cùng API và grant Backend, không lấy platform/client permission làm nguồn xác thực.

CORS mới không được mở toàn cục trong đợt này: Auth/Organization/Employees giữ chính sách hiện tại; Web khác origin cần proxy cùng origin hoặc cấu hình CORS được duyệt riêng. Notification tiếp tục dùng allowlist hiện có.

## Danh sách endpoint


| Method | URL | Mục đích | Permission |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | Đăng nhập bằng UserId chuỗi, giữ alias username | Anonymous; LoginRateLimiter |
| GET | `/api/auth/me` | Profile hiện tại | JWT + User ACTIVE |
| GET | `/api/auth/me/permissions` | Danh sách màn hình xem được | JWT + User ACTIVE |
| GET | `/api/notifications` | Inbox riêng của JWT sub | JWT; recipient ownership |
| GET | `/api/notifications/unread-count` | Đếm chưa đọc | JWT; recipient ownership |
| PATCH | `/api/notifications/{notificationId}/read` | Đánh dấu một thông báo | JWT; recipient ownership |
| PATCH | `/api/notifications/read-all` | Đánh dấu toàn bộ inbox hiện tại | JWT; recipient ownership |
| POST | `/api/notifications/announcements` | Lưu announcement draft hoặc lịch | WEB_NOTIFICATIONS: USER→SEND_USER; USERS/ROLE/DEPARTMENT/CUSTOM→SEND_GROUP; ALL→SEND_ALL; thêm SCHEDULE khi có scheduledAt |
| POST | `/api/notifications/{notificationId}/publish` | Đưa draft vào outbox | WEB_NOTIFICATIONS: kiểm tra từng quyền gửi của target đã lưu; SCHEDULE nếu có lịch |
| POST | `/api/notifications/{notificationId}/cancel` | Hủy trước phát hành | WEB_NOTIFICATIONS / CANCEL |
| GET | `/api/departments` | Danh mục có phân trang | WEB_DEPARTMENTS / VIEW |
| GET | `/api/departments/{departmentId}` | Chi tiết danh mục | WEB_DEPARTMENTS / VIEW |
| POST | `/api/departments` | Tạo danh mục | WEB_DEPARTMENTS / NEW |
| PUT | `/api/departments/{departmentId}` | Cập nhật danh mục | WEB_DEPARTMENTS / UPDATE |
| DELETE | `/api/departments/{departmentId}` | Xóa danh mục chưa được sử dụng | WEB_DEPARTMENTS / DELETE |
| GET | `/api/positions` | Danh mục có phân trang | WEB_POSITIONS / VIEW |
| GET | `/api/positions/{positionId}` | Chi tiết danh mục | WEB_POSITIONS / VIEW |
| POST | `/api/positions` | Tạo danh mục | WEB_POSITIONS / NEW |
| PUT | `/api/positions/{positionId}` | Cập nhật danh mục | WEB_POSITIONS / UPDATE |
| DELETE | `/api/positions/{positionId}` | Xóa danh mục chưa được sử dụng | WEB_POSITIONS / DELETE |
| GET | `/api/employees` | Danh sách hồ sơ trong scope | WEB_EMPLOYEES / VIEW + SELF/DEPARTMENT/ALL |
| GET | `/api/employees/{employeeId}` | Chi tiết hồ sơ trong scope | WEB_EMPLOYEES / VIEW + row scope |
| POST | `/api/employees` | Tạo hồ sơ nhân viên | WEB_EMPLOYEES / NEW + ALL, hoặc DEPARTMENT đúng phòng ban |
| PUT | `/api/employees/{employeeId}` | Cập nhật thông tin hồ sơ | WEB_EMPLOYEES / UPDATE + ALL/DEPARTMENT |
| DELETE | `/api/employees/{employeeId}` | Ngừng hoạt động hồ sơ (soft deactivation) | WEB_EMPLOYEES / DELETE + ALL/DEPARTMENT |
| PATCH | `/api/employees/{employeeId}/department` | Chuyển phòng ban, tạo lịch sử | WEB_EMPLOYEES / UPDATE + ALL |
| GET | `/api/employees/{employeeId}/history` | Xem lịch sử hồ sơ | WEB_EMPLOYEES / VIEW + row scope |
| GET | `/api/employees/{employeeId}/contracts` | Danh sách hợp đồng nhân viên | WEB_CONTRACTS / VIEW + employee row scope |
| GET | `/api/employees/{employeeId}/contracts/{contractId}` | Chi tiết hợp đồng | WEB_CONTRACTS / VIEW + employee row scope |
| POST | `/api/employees/{employeeId}/contracts` | Tạo hồ sơ hợp đồng | WEB_CONTRACTS / NEW + ALL/DEPARTMENT |
| PUT | `/api/employees/{employeeId}/contracts/{contractId}` | Sửa hợp đồng / chuyển trạng thái | WEB_CONTRACTS / UPDATE + ALL/DEPARTMENT |

## 1. POST /api/auth/login

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


## 2. GET /api/auth/me

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


## 3. GET /api/auth/me/permissions

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


## 4. GET /api/notifications

Inbox riêng của JWT sub.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Query limit=30 (clamp 1–100), beforeId nullable (cursor ID).
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Chỉ PUBLISHED và user hiện tại; không tin userId query. Offline đồng bộ API.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "items": [
    {
      "id": 1,
      "title": "Thông báo",
      "content": "Mở ứng dụng để xem thông tin.",
      "source": "SYSTEM",
      "createdAt": "2026-10-24T10:00:00Z",
      "publishedAt": "2026-10-24T10:00:01Z",
      "readAt": null,
      "referenceType": "EMPLOYEE",
      "referenceId": "1"
    }
  ],
  "nextBeforeId": null
}
```


## 5. GET /api/notifications/unread-count

Đếm chưa đọc.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Không có query/path/body.
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Chỉ thông báo đã phát hành của sub.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "count": 1
}
```


## 6. PATCH /api/notifications/{notificationId}/read

Đánh dấu một thông báo.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Path notificationId BIGINT.
- HTTP errors: 401, 404, 500.
- Validation/nghiệp vụ: Idempotent; non-recipient trả 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.


## 7. PATCH /api/notifications/read-all

Đánh dấu toàn bộ inbox hiện tại.

- Role/Permission: **JWT; recipient ownership**.
- Query/Path/Header: Không có query/path/body.
- HTTP errors: 401, 500.
- Validation/nghiệp vụ: Không thay đổi trạng thái đọc của user khác.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "updated": 1
}
```


## 8. POST /api/notifications/announcements

Lưu announcement draft hoặc lịch.

- Role/Permission: **WEB_NOTIFICATIONS: USER→SEND_USER; USERS/ROLE/DEPARTMENT/CUSTOM→SEND_GROUP; ALL→SEND_ALL; thêm SCHEDULE khi có scheduledAt**.
- Query/Path/Header: Header Idempotency-Key bắt buộc <=100 ký tự; scheduledAt UTC tương lai tùy chọn.
- HTTP errors: 400, 401, 403, 409, 500.
- Validation/nghiệp vụ: Target allowlist/OR/distinct, không SQL; cùng key khác payload 409. Worker xử lý sau. Xem NOTIFICATION_CENTER.md cho đầy đủ target.

JSON Request mẫu:

```json
{
  "title": "Thông báo demo",
  "content": "Vui lòng mở ứng dụng để kiểm tra.",
  "targets": [
    {
      "type": "USER",
      "userIds": [
        "{{targetUserId}}"
      ]
    }
  ]
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "status": "DRAFT",
  "scheduledAt": null,
  "recipientCount": 0
}
```


## 9. POST /api/notifications/{notificationId}/publish

Đưa draft vào outbox.

- Role/Permission: **WEB_NOTIFICATIONS: kiểm tra từng quyền gửi của target đã lưu; SCHEDULE nếu có lịch**.
- Query/Path/Header: Path notificationId BIGINT.
- HTTP errors: 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Không fanout đồng bộ HTTP. Không publish source nội bộ qua API này.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 202:

```json
{
  "id": 1,
  "status": "SCHEDULED",
  "scheduledAt": null,
  "recipientCount": 0
}
```


## 10. POST /api/notifications/{notificationId}/cancel

Hủy trước phát hành.

- Role/Permission: **WEB_NOTIFICATIONS / CANCEL**.
- Query/Path/Header: Path notificationId BIGINT.
- HTTP errors: 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Chỉ DRAFT/SCHEDULED; PUBLISHED trả 409; cancel lặp idempotent.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "status": "CANCELLED",
  "scheduledAt": null,
  "recipientCount": 0
}
```


## 11. GET /api/departments

Danh mục có phân trang.

- Role/Permission: **WEB_DEPARTMENTS / VIEW**.
- Query/Path/Header: Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope. Query isActive nullable.
- HTTP errors: 400, 401, 403, 500.
- Validation/nghiệp vụ: Danh mục chung: không áp employee row scope. Query chỉ thu hẹp kết quả.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "departmentCode": "DEMO-D01",
      "departmentName": "Demo Department",
      "description": "Dữ liệu thử nghiệm",
      "isActive": true
    }
  ]
}
```


## 12. GET /api/departments/{departmentId}

Chi tiết danh mục.

- Role/Permission: **WEB_DEPARTMENTS / VIEW**.
- Query/Path/Header: Path departmentId số nguyên dương.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Không tồn tại: 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```


## 13. POST /api/departments

Tạo danh mục.

- Role/Permission: **WEB_DEPARTMENTS / NEW**.
- Query/Path/Header: Body DTO; ID/CreatedAt do server tạo.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=20, name<=150, description<=500. Trả Location header.

JSON Request mẫu:

```json
{
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```


## 14. PUT /api/departments/{departmentId}

Cập nhật danh mục.

- Role/Permission: **WEB_DEPARTMENTS / UPDATE**.
- Query/Path/Header: Path departmentId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=20, name<=150, description<=500. isActive=false dùng để ngừng sử dụng thay vì xóa danh mục đang tham chiếu.

JSON Request mẫu:

```json
{
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```


## 15. DELETE /api/departments/{departmentId}

Xóa danh mục chưa được sử dụng.

- Role/Permission: **WEB_DEPARTMENTS / DELETE**.
- Query/Path/Header: Path departmentId.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Chặn 409 nếu Department có Employee/History hoặc Position có History; FK RESTRICT bảo vệ thêm khi race.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.


## 16. GET /api/positions

Danh mục có phân trang.

- Role/Permission: **WEB_POSITIONS / VIEW**.
- Query/Path/Header: Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope. Query isActive nullable.
- HTTP errors: 400, 401, 403, 500.
- Validation/nghiệp vụ: Danh mục chung: không áp employee row scope. Query chỉ thu hẹp kết quả.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "code": "DEMO-P01",
      "name": "Demo Position",
      "isActive": true
    }
  ]
}
```


## 17. GET /api/positions/{positionId}

Chi tiết danh mục.

- Role/Permission: **WEB_POSITIONS / VIEW**.
- Query/Path/Header: Path positionId số nguyên dương.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Không tồn tại: 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```


## 18. POST /api/positions

Tạo danh mục.

- Role/Permission: **WEB_POSITIONS / NEW**.
- Query/Path/Header: Body DTO; ID/CreatedAt do server tạo.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=30, name<=150. Trả Location header.

JSON Request mẫu:

```json
{
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```


## 19. PUT /api/positions/{positionId}

Cập nhật danh mục.

- Role/Permission: **WEB_POSITIONS / UPDATE**.
- Query/Path/Header: Path positionId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=30, name<=150. isActive=false dùng để ngừng sử dụng thay vì xóa danh mục đang tham chiếu.

JSON Request mẫu:

```json
{
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```


## 20. DELETE /api/positions/{positionId}

Xóa danh mục chưa được sử dụng.

- Role/Permission: **WEB_POSITIONS / DELETE**.
- Query/Path/Header: Path positionId.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Chặn 409 nếu Department có Employee/History hoặc Position có History; FK RESTRICT bảo vệ thêm khi race.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.


## 21. GET /api/employees

Danh sách hồ sơ trong scope.

- Role/Permission: **WEB_EMPLOYEES / VIEW + SELF/DEPARTMENT/ALL**.
- Query/Path/Header: Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope. Query departmentId positive nullable; employmentStatus<=20.
- HTTP errors: 400, 401, 403, 500.
- Validation/nghiệp vụ: Scope áp trước count/paging/search. Department query không mở rộng scope.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "employeeCode": "DEMO-E01",
      "fullName": "Demo Employee",
      "email": "employee-demo@example.invalid",
      "dateOfBirth": "1995-01-01",
      "phoneNumber": null,
      "hireDate": "2024-01-01",
      "departmentId": 1,
      "employmentStatus": "ACTIVE",
      "createdAt": "2026-10-24T10:00:00Z"
    }
  ]
}
```


## 22. GET /api/employees/{employeeId}

Chi tiết hồ sơ trong scope.

- Role/Permission: **WEB_EMPLOYEES / VIEW + row scope**.
- Query/Path/Header: Path employeeId INT.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Ngoài scope hoặc không tồn tại: 404; không làm lộ danh sách user/auth.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 1,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z"
}
```


## 23. POST /api/employees

Tạo hồ sơ nhân viên.

- Role/Permission: **WEB_EMPLOYEES / NEW + ALL, hoặc DEPARTMENT đúng phòng ban**.
- Query/Path/Header: Body departmentId phải là số nguyên.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Mã<=20/email<=255 unique; tên<=150/phone<=20; Department ACTIVE; hireDate bắt buộc; birth<=hireDate và không tương lai; status ACTIVE/INACTIVE/TERMINATED. SELF không được ghi.

JSON Request mẫu:

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "employmentStatus": "ACTIVE",
  "employeeCode": "DEMO-E01",
  "hireDate": "2024-01-01",
  "departmentId": "{{departmentId}}"
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 1,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z"
}
```


## 24. PUT /api/employees/{employeeId}

Cập nhật thông tin hồ sơ.

- Role/Permission: **WEB_EMPLOYEES / UPDATE + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Không đổi employeeCode/hireDate/department qua endpoint này. Birth/email/length/status validation. PUT giống dữ liệu hiện tại không phát thêm audit/notification. Notification + audit cùng transaction.

JSON Request mẫu:

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "employmentStatus": "ACTIVE"
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 1,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z"
}
```


## 25. DELETE /api/employees/{employeeId}

Ngừng hoạt động hồ sơ (soft deactivation).

- Role/Permission: **WEB_EMPLOYEES / DELETE + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Đặt INACTIVE; không xóa row/contract/history. Không đổi tài khoản Auth hoặc tự kết thúc hợp đồng. TERMINATED trả 409; lặp INACTIVE không tạo event trùng.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.


## 26. PATCH /api/employees/{employeeId}/department

Chuyển phòng ban, tạo lịch sử.

- Role/Permission: **WEB_EMPLOYEES / UPDATE + ALL**.
- Query/Path/Header: Path employeeId; body departmentId là số nguyên.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Phòng đích ACTIVE và khác phòng hiện tại; effectiveDate từ hire/latest history đến hôm nay UTC; không lên lịch tương lai. Actor từ JWT. Employee/History/Audit/Notification/Outbox commit hoặc rollback cùng nhau.

JSON Request mẫu:

```json
{
  "departmentId": "{{otherDepartmentId}}",
  "effectiveDate": "2026-10-24",
  "reason": "Điều chuyển thử nghiệm"
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 2,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z"
}
```


## 27. GET /api/employees/{employeeId}/history

Xem lịch sử hồ sơ.

- Role/Permission: **WEB_EMPLOYEES / VIEW + row scope**.
- Query/Path/Header: Path employeeId; Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope.
- HTTP errors: 400, 401, 403, 404, 500.
- Validation/nghiệp vụ: Lịch sử được tạo qua nghiệp vụ chuyển phòng ban; không cho client ghi lại actor hoặc sửa/xóa lịch sử. Chưa gán chức danh vì Employee không có PositionId.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "employeeId": 1,
      "oldDepartmentId": 1,
      "newDepartmentId": 2,
      "oldPositionId": null,
      "newPositionId": null,
      "effectiveDate": "2026-10-24",
      "reason": "Điều chuyển",
      "changedByUserId": "<JWT sub>"
    }
  ]
}
```


## 28. GET /api/employees/{employeeId}/contracts

Danh sách hợp đồng nhân viên.

- Role/Permission: **WEB_CONTRACTS / VIEW + employee row scope**.
- Query/Path/Header: Path employeeId; Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope.
- HTTP errors: 400, 401, 403, 404, 500.
- Validation/nghiệp vụ: Không truy vấn hợp đồng nhân viên ngoài scope. search chỉ theo contractNo.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "employeeId": 1,
      "contractNo": "DEMO-C01",
      "contractType": "FIXED_TERM",
      "startDate": "2024-01-01",
      "endDate": "2027-01-01",
      "status": "DRAFT",
      "attachmentUrl": null
    }
  ]
}
```


## 29. GET /api/employees/{employeeId}/contracts/{contractId}

Chi tiết hợp đồng.

- Role/Permission: **WEB_CONTRACTS / VIEW + employee row scope**.
- Query/Path/Header: Path employeeId INT, contractId BIGINT.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Contract phải thuộc đúng employeeId; mismatch/outside scope trả 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeId": 1,
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```


## 30. POST /api/employees/{employeeId}/contracts

Tạo hồ sơ hợp đồng.

- Role/Permission: **WEB_CONTRACTS / NEW + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId; không nhận employeeId khác trong body.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: No<=50 unique; type<=30; start>=hireDate; end>=start; status allowlist; ACTIVE chứa hôm nay và không trùng khoảng ACTIVE khác. HTTPS attachment<=500, không có credentials, server không fetch URL. Audit/notification atomic.

JSON Request mẫu:

```json
{
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "employeeId": 1,
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```


## 31. PUT /api/employees/{employeeId}/contracts/{contractId}

Sửa hợp đồng / chuyển trạng thái.

- Role/Permission: **WEB_CONTRACTS / UPDATE + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId, contractId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Giữ quy tắc tạo. ACTIVE chỉ giữ ACTIVE hoặc sang EXPIRED/TERMINATED; đóng cần endDate<=hôm nay; bản ghi đóng immutable, PUT dữ liệu giống hệt vẫn 200 không tạo event trùng. Không có DELETE hợp đồng.

JSON Request mẫu:

```json
{
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeId": 1,
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```


## SignalR hiện có

`/hubs/notifications`: JWT bắt buộc, sub làm UserId; `notification.available` payload `{notificationId,eventId}`. Query access_token chỉ ở hub cho browser transport; REST không nhận token query. Client loại trùng eventId và đồng bộ inbox/count sau reconnect. FCM chưa triển khai. Không tạo hub/NotificationService khác.

## Ranh giới nghiệp vụ đợt đầu

- Chưa thêm PositionId hiện tại lên Employee hoặc suy chức danh từ History; đọc các field lịch sử chức danh sẵn có, chưa hỗ trợ đổi chức danh hiện tại. Cần duyệt schema nếu muốn bổ sung.
- Tạo Employee không tự tạo tài khoản Auth hoặc tự gắn User.EmployeeId; tài khoản SELF/DEPARTMENT cần liên kết hiện có.
- Hợp đồng là hồ sơ, chưa có ký số/approval workflow. Type giữ chuỗi<=30 theo schema; date/status rules là hợp đồng API đợt đầu, không rewrite dữ liệu cũ. Employee soft deactivation không khóa user Auth hoặc tự kết thúc hợp đồng.
- Chuyển phòng ban có hiệu lực ngay, không scheduler tương lai. History chỉ append qua command; không sửa/xóa lịch sử.
- Profile update/deactivate, department transfer, contract mutation dùng NotificationService.CreateInternalAsync và cùng AppDbContext transaction. Chỉ thông báo generic cho tài khoản ACTIVE liên kết nhân viên; không chứa lương/PII trong push. Worker xử lý sau; giữ worker config hiện tại. Nếu lỗi lưu notification, cả thay đổi nghiệp vụ/audit/outbox rollback.
- Không có schema/configuration entity thay đổi trong đợt này; không tạo Migration mới. Database phải có các bảng existing (bao gồm Notification Center khi bật tích hợp); trạng thái Migration Railway không được kiểm tra hoặc cập nhật trong lần này.
- Attendance → Leave/Overtime/Approvals → Payroll/Timesheets → KPI → Dashboard/Reports vẫn MISSING theo inventory; chưa chuyển sang các module đó trước hoàn thiện hai module đầu.

## Postman và kiểm chứng

Import [HRM-API.postman_collection.json](HRM-API.postman_collection.json). Điền baseUrl, userId, loginPassword cục bộ hoặc token được cấp; không lưu mật khẩu thật vào collection/source. Login tự lưu token runtime. Tạo Department/Position/Employee/Contract tự lưu ID runtime. `otherDepartmentId` cần là phòng ACTIVE khác, chọn thủ công; notificationKey được tạo runtime và giữ để retry cùng payload. Request Cleanup để cuối và chỉ chạy có chủ đích trên dữ liệu demo; không chạy collection ghi lên Railway khi chưa được duyệt.

Các JSON `{{departmentId}}` trong spec/collection là placeholder cho **số nguyên**; collection raw body xuất dạng số, không phải string. Sửa ngày effectiveDate cho phù hợp lúc test; cập nhật code/email/contractNo nếu đã tồn tại. Không tự động đặt Data Scope hoặc cấp quyền database khi chạy Postman.

Build/test và danh sách file xem báo cáo bàn giao; automated test dùng TestServer/SQLite, worker tắt, credentials sinh ngẫu nhiên, không dùng Railway.

## Kết quả đợt Organization → Employees

- Build: thành công, 0 warning/0 error.
- Test mới: 13/13 đạt (Organization 4, Employees 8, runtime inventory 1).
- Toàn bộ suite: 134 đạt, 1 lỗi có trước, tổng 135. Lỗi AuthSeederTests kỳ vọng 4 Role nhưng seeder hiện chỉ có ADMIN; không sửa seed trong đợt này.
- EF has-pending-model-changes: không có thay đổi. Không tạo/chạy Migration; không kết nối/cập nhật Railway.
- Postman: 31 request duy nhất; JSON body đã kiểm tra sau thay placeholder numeric; token/loginPassword lưu rỗng. Điền biến rồi chạy folder có chủ đích, với Notification cần chờ worker trước read.

File sửa: Program.cs (DI của module mới), DepartmentsController.cs hiện có, AuthenticationApiTests.cs (fixture cho entity/scope/fault injection mới). File tạo: Common/BusinessApi.cs; Organization/DTOs/OrganizationDtos.cs, Services/OrganizationService.cs, Controllers/PositionsController.cs; Employees/DTOs/EmployeeDtos.cs, Services/EmployeeDataScope.cs, EmployeeService.cs, Controllers/EmployeesController.cs, EmployeeContractsController.cs; Tests OrganizationApiTests.cs, EmployeeApiTests.cs, ApiInventoryTests.cs; ba tài liệu/collection HRM_API_INVENTORY.md, HRM_API_SPEC.md, HRM-API.postman_collection.json. Prefix runtime là backend/HRM.API/Modules; Common ở backend/HRM.API/Common; tests ở backend/HRM.API.Tests.

Auth, JWT, RBAC, Notification runtime, các Entity/Configuration và Migrations được giữ nguyên. Backup trước sửa: /private/tmp/hrm-org-employees/before.tar.gz.
