# Authorization — Phân quyền và quản trị

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. Quản lý User, Role, Screen, ma trận quyền chuẩn và mở rộng.

## Phạm vi source

Source: `backend/HRM.API/Modules/Authorization/`.

Entity hiện có: `Role`, `RoleDetail`, `RoleScreenAction`, `Screen`, `User`, `UserRole`.

## Kiến trúc

PermissionService đọc grant qua User → UserRole → RoleDetail/RoleScreenAction → Screen ACTIVE. Nhiều Role tổng hợp OR. Registry chuẩn: VIEW, NEW, UPDATE, DELETE, APPROVE, EXPORT; registry mở rộng: SEND_USER, SEND_GROUP, SEND_ALL, SCHEDULE, CANCEL. Action khác VIEW không bắt buộc có VIEW.

ScreenPermissionAttribute tạo dynamic policy; ScreenPermissionHandler đọc permission snapshot từ JWT đã được xác thực. API quản trị còn kiểm tra grant DB mới nhất trong AdministrationService. Không suy quyền từ ADMIN/ALLROLL hoặc dữ liệu Role/Permission client gửi lên.

Mã quản trị dùng trong source: WEB_USERS, WEB_ROLES, WEB_PERMISSIONS. Screens API và action catalog dùng WEB_PERMISSIONS; không có giả định WEB_SCREENS. Catalog/grant trên từng môi trường phải được kiểm tra độc lập trước triển khai.


## Tài liệu module

- [Screens API](SCREENS_API.md)
- [Users API](USERS_API.md)
- [Roles API](ROLES_API.md)
- [Permission Matrix và Actions API](PERMISSIONS_API.md)
- [Bảo mật và bootstrap](SECURITY.md)
- [Kiểm thử phân quyền](TESTS.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
