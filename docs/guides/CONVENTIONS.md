# Quy ước HTTP và sử dụng API

[Mục lục](../README.md) · [API Inventory](../API/README.md)

## Request/response

Base URL theo môi trường, HTTPS. JSON camelCase; DateOnly dạng yyyy-MM-dd, timestamp theo UTC. Tất cả REST endpoint ngoài POST /api/auth/login yêu cầu `Authorization: Bearer <token>`; userId quyết định quyền lấy từ JWT sub, không lấy từ body.

List của Organization/Employees/Administration dùng page>=1, pageSize1..100 mặc định30, search tối đa150 ký tự và trả `{success,total,page,pageSize,data}`. Notification dùng cursor beforeId/limit và trả `{items,nextBeforeId}`; không áp pagination kiểu page lên inbox. Tham số bổ sung xem từng endpoint.

POST thường trả201+Location khi tạo resource; PUT/PATCH trả DTO hoặc receipt; DELETE thành công204 trừ Employee soft deactivation theo API. Publish Notification trả202 vì đang chờ worker. Không coi một receipt SCHEDULED là thông báo đã đến inbox.

Ví dụ `{{token}}`, `{{roleId}}`, `{{employeeId}}`, `{{newPassword}}` là placeholder. ID số phải thay bằng JSON number; UserId là string. Version trong mẫu chỉ minh họa; cần lấy ETag/version thật từ GET trước mutation quản trị.

## Lỗi

| HTTP | Ý nghĩa |
| --- | --- |
| 400 | DTO/query/validation nghiệp vụ không hợp lệ |
| 401 | Thiếu/sai/hết hạn JWT, User không ACTIVE hoặc session version bị thu hồi |
| 403 | Không có action, vượt authority hoặc bị giới hạn data scope |
| 404 | Resource không tồn tại/không khả dụng theo query phạm vi |
| 409 | Unique/FK/state/last-administrator conflict |
| 412 | If-Match không khớp resource hiện tại |
| 413 | Body vượt giới hạn endpoint |
| 428 | Mutation quản trị thiếu If-Match |
| 429 | Login/reset vượt rate limit |
| 500 | Hạ tầng/lỗi chưa xử lý, không trả stack/SQL/secret |

Model validation của ASP.NET Core có thể trả application/problem+json. Auth/business errors dùng envelope:

```json
{"success":false,"code":"HRM_AUTH_003","error":"PERMISSION_DENIED","message":"Permission denied.","traceId":"TRACE_ID"}
```

Mã phổ biến: HRM_AUTH_001/002/003/004/005; HRM_RESOURCE_404/409; HRM_VALIDATION_400; HRM_ADMIN_403/412/428. Notification có mã riêng HRM_NOTIFICATION_*. Không giả định mọi endpoint đều trả tất cả mã lỗi; xem điều kiện trong API module.

## Authorization

VIEW, NEW, UPDATE, DELETE, APPROVE, EXPORT lấy từ RoleDetail Y/N. SEND_USER, SEND_GROUP, SEND_ALL, SCHEDULE, CANCEL lấy từ RoleScreenAction. Role đa trị OR; action khác VIEW độc lập. Catalog screens ACTIVE không phải danh sách màn hình cá nhân; profile UI chỉ hiển thị có VIEW.

API nghiệp vụ dùng snapshot JWT và kiểm tra session version. API quản trị còn đọc live grants. Scope SELF/DEPARTMENT/ALL riêng cho Employees. Không dùng response Login hoặc quyền do React/Flutter gửi lên để tự quyết định quyền server.

## CORS và dữ liệu nhạy cảm

Notification đang có CORS policy riêng. API khác cần same-origin proxy hoặc cấu hình CORS riêng đã duyệt khi dùng frontend khác origin. Với Administration phải cho If-Match và các method cần dùng, expose ETag; cũng có thể tạo quoted If-Match từ version trong DTO. Không tự mở tất cả origin để xử lý403.

Không đưa password/hash/salt/access token/FCM token vào source, log hoặc dữ liệu mẫu thật. Postman dùng local environment/Vault; không export secret runtime.
