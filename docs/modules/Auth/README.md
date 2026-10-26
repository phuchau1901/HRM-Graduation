# Auth — Xác thực

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. Đăng nhập bằng UserId chuỗi, phát JWT, trả profile và quyền xem màn hình.

## Phạm vi source

Source: `backend/HRM.API/Modules/Auth/`.

Entity hiện có: `RefreshToken`.

## Luồng xử lý

`AuthController → AuthService → PasswordService → AuthProfileService + PermissionService → JwtService`.

LoginRateLimiter được gọi bên trong AuthService. AuthProfileService JOIN user_roles → roles và role_details → screens, OR sáu cờ Y/N rồi chỉ trả màn hình có VIEW. JWT chứa snapshot có cả action không có VIEW, lấy từ PermissionService. UI permissions không phải nguồn quyết định quyền API.

UserId là `users.user_id VARCHAR(100)` primary key, không tự tăng và không có thuộc tính Username riêng. `username` chỉ là alias của request login. Email, EmployeeId và thông tin Role được trả qua DTO an toàn.

Chưa có API public đăng ký, quên mật khẩu hay tự đổi mật khẩu. Primitive ChangePasswordAsync/ResetPasswordAsync không tự trở thành endpoint; reset bởi quản trị viên nằm ở Authorization.


## Tài liệu module

- [API đăng nhập và profile](API.md)
- [Mật khẩu, JWT và phiên](SECURITY.md)
- [Kiểm thử Auth](TESTS.md)
- [Reset bởi quản trị](../Authorization/USERS_API.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
