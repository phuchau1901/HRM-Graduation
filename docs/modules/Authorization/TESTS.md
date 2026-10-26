# Authorization — Kiểm thử

[Module](README.md) · [Hướng dẫn chạy test](../../guides/TESTING.md)

## Source kiểm thử

Trong `backend/HRM.API.Tests/`: PermissionServiceTests, PermissionApiTests, AuthorizationV2Tests, AdministrationApiTests, AdministrationRealtimeTests, AdministrationMigrationTests, ApiInventoryTests.

## Các tình huống cần giữ

- Sáu action chuẩn và năm action mở rộng; nhiều Role/nhiều Screen, action không cần VIEW; không ADMIN bypass.
- Users hợp lệ, trùng ID/email, Employee/Role sai; DTO không hash/salt; Role mới rỗng và Role đang tham chiếu không được xóa.
- Screens ACTIVE/platform/pagination; code unique; không rename code/platform referenced; chặn dormant grants escalation.
- Chống tự gán Role, sửa Role đang gán cho mình, takeover target vượt authority; bảo vệ account quản trị cuối cùng.
- If-Match thiếu428/cũ412; matrix batch lỗi rollback, giữ extended khi chỉ sửa standard; audit trước/sau không chứa secret.
- Reset reauth/rate limit; revoke access/refresh, old JWT401; SignalR chỉ gửi group version mới và bỏ qua account khóa.
- Migration chỉ thêm/bỏ auth_version; production route unique và JWT/ScreenPermission đúng quy ước.

Automated tests dùng SQLite/TestServer, không chứng minh trạng thái grant/DDL của Railway. Các tình huống mới chưa có assertion tương ứng phải bổ sung test trước khi thay nghiệp vụ; đối chiếu tên method test trong source, không xem checklist này là kết quả chạy thực tế.

Khi test thủ công bằng Postman, chỉ dùng môi trường và tài khoản thử nghiệm đã được duyệt, lấy permission từ backend; không ghi password/token vào báo cáo.
