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
| 20261113000000_AddRoleScreenActionDataScope | Metadata data_scope nullable theo role/screen/action, không tự cấp grant |
| 20261114091114_AddEmployeePosition | employees.PositionId BIGINT NULL, FK Restrict tới positions.id |
| 20261114092818_AddTeamsAndEmployeeTeam | teams, employees.TeamId INT NULL, composite FK bảo đảm cùng Department; không backfill/grant |

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

## Teams và Employee.DepartmentId

Audit source/configuration/snapshot: [báo cáo Teams](../modules/Organization/TEAMS.md#audit-model-trước-triển-khai). Chưa kiểm tra schema/live migration history.

`teams` dùng tên cột PascalCase nhất quán với departments/employees:

| Cột | MySQL | Quy tắc |
| --- | --- | --- |
| Id | INT NOT NULL AUTO_INCREMENT | PK |
| TeamCode | VARCHAR(30) NOT NULL | Unique toàn hệ thống, API normalize uppercase |
| TeamName | VARCHAR(150) NOT NULL | Tên bắt buộc |
| DepartmentId | INT NOT NULL | FK Restrict tới departments.Id |
| Description | VARCHAR(500) NULL | Mô tả |
| IsActive | TINYINT(1) NOT NULL | API/entity mặc định true |
| CreatedAt | DATETIME(6) NOT NULL | API/entity gán UTC |

Alternate key `AK_teams_Id_DepartmentId` unique `(Id, DepartmentId)`. Index `IX_teams_DepartmentId_IsActive` hỗ trợ lọc và FK Department. Index `IX_teams_TeamCode` unique. Employee thêm `TeamId INT NULL` và index `(TeamId, DepartmentId)`; composite FK tham chiếu `(teams.Id, teams.DepartmentId)`, ON DELETE RESTRICT. DepartmentId hiện tại của Employee vẫn NOT NULL với FK riêng. TeamId null hợp lệ theo composite FK MySQL; không gán Team tự động cho dữ liệu cũ.

Department của Team là một phần alternate key nên API không cho đổi. Xóa Department còn Team hoặc Team còn Employee bị chặn. Team/Department inactive vẫn tồn tại; trạng thái active được kiểm tra ở service khi gán mới, không thể biểu diễn bằng FK thuần.

Migration mới chỉ thêm bảng/cột/index/FK, không ALTER dữ liệu Employee cũ, không seed/grant, không chạy SQL backfill. Up không có thao tác xóa. Down bỏ quan hệ/cột/bảng Teams và sẽ mất metadata Team mới nếu operator chủ động rollback, nên cần backup và review riêng; không chạy rollback tự động. MySQL DDL có thể auto-commit.

Chưa apply migration, chưa deploy Railway. Apply Position migration trước Teams nếu môi trường chưa có. Review [migration Teams](../../backend/HRM.API/Migrations/20261114092818_AddTeamsAndEmployeeTeam.cs) và [SQL sinh để review](../../database/migrations/20261114092818_AddTeamsAndEmployeeTeam.sql), xác minh schema đích và migration history qua quy trình vận hành được phê duyệt trước khi cập nhật DB. Binary mới yêu cầu schema mới.

Test `TeamMigrationTests` generate SQL bằng provider MySQL và so sánh snapshot hoàn toàn offline; integration tests dùng SQLite relational để xác minh composite FK, không chứng minh migration đã chạy trên MySQL live.

## EmployeeCode tự động và tạo User atomic

Audit source: Employee.Id là INT AUTO_INCREMENT/ValueGeneratedOnAdd; EmployeeCode VARCHAR(20) NOT NULL có unique index IX_employees_EmployeeCode. DTO cập nhật thực tế tên EmployeeProfileRequest, không có EmployeeUpdateRequest riêng; DTO này không có field sửa EmployeeCode. POST EmployeeCreateRequest đã bỏ EmployeeCode. Migration snapshot/Initial migration và Fluent Configuration nhất quán cho các cột này. Không kết nối database live để xác nhận schema hoặc AUTO_INCREMENT counter trong lần sửa này.

Dùng `NV` + Id, tối thiểu 6 chữ số, không MAX + 1. EmployeeCodeGenerator yêu cầu transaction tường minh: insert code tạm unique để lấy Id, kiểm tra slot legacy, update code chính thức trước khi commit. Nếu legacy đã chiếm code dự kiến, chỉ delete row provisional vừa tạo để lấy Id kế tiếp; giữ nguyên mọi row/mã cũ. Một code tạm không bao giờ được commit bởi các đường tạo Employee/User trong ứng dụng. Lỗi gán mã/audit/User insert làm rollback toàn bộ. Unique/NOT NULL hiện có giữ nguyên, không đổi schema/seed/backfill hay identity của nhân viên cũ.

AUTO_INCREMENT MySQL 8 hiện có cấp Id giữa các kết nối và duy trì high-water mark; không reset/reseed/TRUNCATE để cấp lại mã. API DELETE Employee là deactivation. Mã có thể nhảy do transaction thất bại hoặc slot mã legacy, không đảm bảo liên tục. Đây là mã theo identity hiện tại, không phải bộ đánh số lại nhân viên cũ. Kiểm tra schema/live counter qua quy trình vận hành riêng trước rollout nếu môi trường có chỉnh DDL thủ công.

POST /api/users với createEmployee=true dùng cùng Serializable transaction/AppDbContext để tạo Employee (gồm code chính thức), User.EmployeeId, UserRoles và audit. Không nested transaction, không hai request độc lập. FK User.EmployeeId vẫn tham chiếu Employee.Id như trước; Attendance, Contracts, EmployeeHistory, Department, Team, Position không đổi. Giữ kiểm tra Team cùng Department và scope hiện tại. Deadlock/lock-timeout MySQL 1213/1205 được retry cả creation transaction tối đa 3 lần, chỉ sau rollback; không retry duplicate/unknown commit error.

Không cần migration mới cho thay đổi này, không apply migration cũ, không sửa dữ liệu legacy và không deploy. Kiểm thử concurrency dùng file SQLite/WAL với nhiều connection; không thay thế kiểm thử trên bản sao MySQL được phê duyệt.
