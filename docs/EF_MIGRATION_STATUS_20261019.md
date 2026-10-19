# Kiểm tra EF Core Migration — HRM.API

Current rebuild preparation supersedes the older migration/User ID assumptions below: [HRM_REBUILD_PREPARATION_20261019.md](HRM_REBUILD_PREPARATION_20261019.md).

Trạng thái Applied/Pending dùng thông tin người dùng cung cấp; không truy vấn Railway hoặc bảng __EFMigrationsHistory. Không tạo/sửa migration, không chạy seed/database update hay thực thi SQL trên Railway.

Đã đọc ba migration (Up/Down), các designer/target model, snapshot và đối chiếu relational model nạp toàn bộ 35 Configuration bằng EF Core/Pomelo. Chi tiết từng bảng/cột/khóa/index: [EF_MIGRATION_OPERATIONS_20261019.txt](EF_MIGRATION_OPERATIONS_20261019.txt).

## Ba migration hiện có

| Migration | Trạng thái được cung cấp | Thay đổi |
| --- | --- | --- |
| 20261012105318_InitialHRMDatabase | Applied | Tạo departments, employees; 4 index; FK employees.DepartmentId → departments.Id, Restrict; charset utf8mb4 |
| 20261018065734_AddHRMProposedSchema | Pending | Tạo 31 bảng, 59 index; sửa kiểu của 3 cột hiện hữu |
| 20261019080000_AddUserSalt | Pending | Thêm users.salt longtext NOT NULL, default chuỗi rỗng cho dữ liệu hiện có |

31 bảng mới của AddHRMProposedSchema:

| Module | Bảng |
| --- | --- |
| Attendance | `attendance_adjustments`, `attendance_requests`, `attendances`, `qr_sessions`, `shifts`, `work_schedules` |
| Auth | `refresh_tokens` |
| Authorization | `roles`, `user_roles`, `users` |
| Employees | `contracts`, `employee_histories` |
| Leave | `approval_requests`, `approval_steps`, `leave_balances`, `leave_requests`, `leave_types`, `overtime_requests` |
| Organization | `positions` |
| Payroll | `payroll_details`, `payroll_periods`, `salary_profiles`, `timesheet_details`, `timesheet_periods` |
| Performance | `kpi_criteria`, `kpi_results`, `kpi_targets`, `kpi_templates`, `performance_reviews` |
| System | `audit_logs`, `notifications` |

AddHRMProposedSchema tạo users gồm id, employee_id (nullable), username, email, password_hash, status (default ACTIVE), created_at. password_hash là longtext. Chưa có salt trong migration này; chưa có screens/role_details. Toàn bộ cột của 31 bảng, 59 index và FK được liệt kê trong file chi tiết.

## Thay đổi cột hiện hữu cần review

| Bảng.cột | Initial | AddHRMProposedSchema và Configuration hiện tại | Nullable |
| --- | --- | --- | --- |
| employees.PhoneNumber | longtext | varchar(20) | Có |
| employees.EmploymentStatus | longtext | varchar(20) | Không |
| departments.Description | longtext | varchar(500) | Có |

Đây là thay đổi schema thực sự đã được ghi vào migration, không phải do đổi namespace. Nếu dữ liệu hiện có vượt 20/20/500 ký tự, việc thu hẹp có thể thất bại hoặc làm mất dữ liệu tùy SQL mode. Chưa truy vấn dữ liệu nên chưa thể xác nhận an toàn áp dụng. Cần review chủ ý nghiệp vụ và kiểm tra độ dài dữ liệu trước khi duyệt migration này. Không có rename/drop bảng hay cột trong Up của ba migration.

departments/employees tiếp tục viết thường; PK, FK DepartmentId (Restrict), unique index mã phòng ban/mã nhân viên/email giữ nguyên. Không có thêm AlterColumn/Rename/Drop ở các bảng hiện hữu trong diff giữa snapshot cuối và model hiện tại. Các trường decimal ở bảng mới đang dùng decimal(65,30) theo mặc định provider vì Configuration không đặt precision; điều này đã có trong AddHRMProposedSchema, không phải drift mới, cần cân nhắc theo yêu cầu nghiệp vụ trước khi phê duyệt schema.

## users.salt

AddUserSalt thêm đúng tên cột lowercase salt, type longtext, NOT NULL, defaultValue="". Salt 32 byte được Base64 thành 44 ký tự; longtext lưu đủ nhưng rộng hơn cần thiết và không ràng buộc chiều dài 44 ở database. Configuration .HasColumnName("salt").IsRequired() và snapshot/target model khớp nhau, không có HasMaxLength.

Nếu mong muốn cột giới hạn chính xác, varchar(44) là lựa chọn cần được duyệt và đồng bộ giữa Configuration/migration; lượt kiểm tra này không tự sửa. Chuỗi rỗng hỗ trợ dòng Identity legacy vì salt cũ nằm bên trong password_hash; đăng nhập đúng mới tạo salt riêng. Nó không phải salt hợp lệ cho format PBKDF2 tùy chỉnh. Không sinh ngẫu nhiên một salt để gán vào hash cũ.

File pending_migrations.sql hiện có cũng chỉ thêm salt bằng `ALTER TABLE users ADD salt longtext NOT NULL DEFAULT ('')` (có quoting tên bảng/cột trong file), không chứa hai bảng phân quyền còn thiếu. File được đọc, không thực thi.

## Kiểm tra pending model changes

Đã chạy trong backend/HRM.API:

```
dotnet ef migrations has-pending-model-changes --project HRM.API.csproj --startup-project HRM.API.csproj
```

Exit code 1: `Changes have been made to the model since the last migration. Add a new migration.`

Lệnh dùng cấu hình process riêng: Production, AuthSeed disabled, connection localhost giả và JWT key ngẫu nhiên tạm thời. Không sửa appsettings/user-secrets/Railway. CLI timeout ở bước tìm host sau 5 giây, báo warning rồi tiếp tục bằng AppDbContextFactory; kiểm tra model vẫn hoàn tất. Đã kiểm chứng độc lập bằng IMigrationsModelDiffer trong chương trình tạm không mở kết nối database.

Kết quả đối chiếu:

- Initial target: 2 bảng; Proposed target: 33 bảng; Salt target/snapshot: 33 bảng; Model hiện tại: 35 bảng.
- Initial target → Proposed target: 93 thao tác (31 CreateTable, 59 CreateIndex, 3 AlterColumn).
- Proposed target → Salt target: đúng 1 AddColumn salt.
- Salt target → snapshot: 0 thao tác; designer và snapshot cuối đồng nhất về schema.
- Snapshot → model hiện tại: đúng 5 thao tác: 2 CreateTable và 3 CreateIndex, không có thay đổi khác.
- Namespace HRM.API.Models trong snapshot lịch sử không tự tạo rename/schema drift khi entity hiện tại dùng Modules.

## Thay đổi chưa được migration ghi nhận

Không migration nào trong ba migration có screens hoặc role_details; snapshot cũng chưa có.

screens:

| Cột | Type | Nullable / default |
| --- | --- | --- |
| id | bigint, PK, auto increment | NOT NULL |
| code | varchar(100) | NOT NULL; unique |
| name | varchar(200) | NOT NULL |
| platform | varchar(20) | NOT NULL |
| route | varchar(255) | NOT NULL |
| icon | varchar(100) | NULL |
| parent_id | bigint | NULL; FK → screens.id, Restrict |
| sort_order | int | NOT NULL |
| is_active | tinyint(1) | NOT NULL; default true |
| supported_actions | json | NOT NULL |

role_details:

- role_id bigint NOT NULL; FK → roles.id, Cascade.
- screen_id bigint NOT NULL; FK → screens.id, Cascade.
- Khóa chính ghép (role_id, screen_id).
- can_new, can_view, can_update, can_delete, can_approve, can_export: varchar(1), NOT NULL, default N.

Ba index chưa ghi nhận: IX_screens_code (unique), IX_screens_parent_id và IX_role_details_screen_id. Các PK/FK nêu trên nằm trong hai CreateTableOperation.

## Điều kiện để test Login trên database thực

Theo trạng thái Applied/Pending đã cung cấp, cần review rồi áp dụng đúng thứ tự:

1. AddHRMProposedSchema để có users, roles, user_roles cùng các bảng phụ thuộc; trước hết xử lý quyết định thu hẹp ba cột.
2. AddUserSalt để AuthService đọc/ghi users.salt.
3. Một migration mới được duyệt riêng bổ sung screens/role_details và ba index. Chưa tạo trong lượt này theo yêu cầu.

Chỉ áp dụng hai migration pending hiện có CHƯA đủ cho Login thành công: sau kiểm tra mật khẩu, AuthController gọi AuthProfileService, luôn đọc screens; nếu user có role còn đọc role_details. Thiếu các bảng này có thể khiến Login đúng mật khẩu trả lỗi database thay vì token. /me và /me/permissions cũng cần chúng. Seed chỉ tạo dữ liệu, không tạo schema.

Sau schema: cấu hình Jwt:Issuer/Audience/SigningKey hợp lệ và có User ACTIVE với credentials hợp lệ; nếu dùng demo seed thì bật Development + AuthSeed:Enabled riêng với mật khẩu trong user-secrets. Trạng thái database thực và dữ liệu dài vẫn chưa được xác minh do không kết nối Railway. Unit/integration test bằng SQLite trong bộ nhớ có thể chạy độc lập; không chứng minh schema Railway đã sẵn sàng.
