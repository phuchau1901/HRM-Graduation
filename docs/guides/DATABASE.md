# Database, mapping và EF Core migrations

[Mục lục](../README.md)

## Nguồn sự thật

Entity và Fluent Configuration hiện tại nằm trong Modules/<Module>/Entities và Configurations. Một AppDbContext chung dùng ApplyConfigurationsFromAssembly; không dựng DbContext riêng cho mỗi module.

Tên bảng/cột, casing, type, length, precision, default, nullability và FK/index phải theo Configuration và schema thực tế đã xác minh, không mặc định VARCHAR(255) cho mọi string. Bảng departments/employees lowercase trên MySQL Linux; một số cột của chúng dùng PascalCase theo mapping hiện có. Decimal(18,2) giữ HasPrecision(18,2), các precision khác giữ đúng giá trị riêng.

User.UserId là string: users.user_id VARCHAR(100), primary key, ValueGeneratedNever. Không có users.username riêng. Các FK UserID dùng VARCHAR(100), gồm UserRole, RefreshToken, NotificationRecipient/creator, AuditLog và Approval/History theo Configuration. users.salt VARCHAR(44) nullable, password_hash VARCHAR(500). RoleDetail giữ sáu cờ Y/N, RoleScreenAction giữ action mở rộng.

Screen hiện chỉ ID/Code/Name/Platform/Icon/IsActive; không giả định parent_id, route, sort_order hay supported_actions. Cần so sánh schema đích trước khi áp dụng bất kỳ thay đổi nào.

## Migration hiện có trong source

| Migration | Phạm vi |
| --- | --- |
| 20261019074710_InitialHRMDatabase | Schema ban đầu hiện tại, UserId chuỗi và các quan hệ |
| 20261019145341_AddNotificationCenter | Chuẩn hóa nội dung notification; targets/recipients/outbox và quyền mở rộng theo Up thực tế |
| 20261026065757_AddUserAuthVersion | Thêm duy nhất users.auth_version BIGINT NOT NULL DEFAULT0; Down chỉ bỏ cột này |

AppDbContextModelSnapshot phản ánh model của migration cuối. Việc file có trong source không chứng minh đã Applied trên Railway. Đợt viết lại tài liệu không kết nối DB hoặc kiểm tra lịch sử live. Các tên migration cũ InitialHRMDatabase/AddHRMProposedSchema/AddUserSalt trong báo cáo trước không phải chỉ dẫn áp dụng cho schema hiện tại.

Migration auth_version phải được duyệt/áp dụng trước binary đọc cột này. Trong rollout nhiều instance, binary cũ không có kiểm tra av; cần phương án triển khai/rollback được duyệt. Không giả định transaction wrapper rollback được toàn bộ MySQL DDL.

## Kiểm tra model không cập nhật database

Từ backend/HRM.API, sau khi build và kiểm tra design-time connection đang trỏ đúng môi trường:

```sh
dotnet ef migrations has-pending-model-changes --project HRM.API.csproj --startup-project HRM.API.csproj --no-build
```

Lệnh so sánh model với snapshot, không xác nhận migration đã Applied hoặc schema live khớp model. Dùng connection local/design-time an toàn; AppDbContextFactory đọc cấu hình theo môi trường và user-secrets. Không mở ứng dụng với seed/worker chỉ để kiểm tra model.

Xuất SQL để operator review có thể dùng `dotnet ef migrations script <FROM> <TO>` với hai ID thực tế trong source và output local. Đọc cả Up/Down, unique/index/FK/casing và khả năng migration đã chạy dở trước khi phê duyệt. Không tự tạo migration chỉ vì namespace đổi.

## Dữ liệu CSV và lịch sử mapping

Báo cáo CSV cũ ghi nhận220 dòng,34 bảng gồm33 bảng nghiệp vụ và EF history,218 cột nghiệp vụ được đối chiếu. Đó là bằng chứng của snapshot schema cũ, không thay thế schema hiện tại sau UserId string/Notification/auth_version. Không suy FK/index/charset/collation chỉ từ danh sách cột; cần metadata đầy đủ.

Các giả định cũ như salt longtext NOT NULL hoặc username riêng đã hết hiệu lực. Không áp lại migration cũ để khớp báo cáo lịch sử. SQL/tar backup trong docs/backups được giữ nguyên để tra cứu, không phải bộ script được phép chạy tự động.

Không có database update, reset/drop, seed hoặc DDL Railway nào được thực hiện trong lần tổ chức tài liệu này. Mọi thao tác ghi môi trường thật cần xác nhận riêng.
