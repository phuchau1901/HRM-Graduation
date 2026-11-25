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

## Audit Employee GET: names và trạng thái migration

Projection đọc tên Department/Team/Position không đổi schema/model, không cần migration mới. [Báo cáo audit](../modules/Employees/EMPLOYEE_READ.md) ghi rõ hai migration PositionId/TeamId có trong source/snapshot nhưng Applied/Pending trên DB đích **chưa xác minh**. Không suy trạng thái DB từ snapshot hoặc báo cáo agent không chạy migration. Có SQL metadata read-only để operator đối chiếu; không tự apply hoặc thêm cột/fallback giả.

## System Settings và snapshot Attendance

Migration `20261114112511_AddSystemSettingsAndAttendanceRules` (chưa apply bởi agent): tạo system_settings (setting_key VARCHAR40 PK, json_value LONGTEXT, version BIGINT concurrency, updated_at_utc DATETIME6) và password_histories (id BIGINT auto, user_id VARCHAR100 FK users, hash VARCHAR500/salt VARCHAR44 chỉ lưu credential, created_at_utc DATETIME6, index user_id/id).

Thêm shifts.version và work_schedules.version BIGINT NOT NULL DEFAULT0, work_schedules.rules_snapshot_json LONGTEXT NULL. Giữ nguyên shifts/work_schedules/attendances/adjustments/requests/qr_sessions, actual timestamp/FK hiện có; không backfill hoặc chuyển giờ cũ. Index employee_id/work_date thay index employee_id đơn; migration tạo index mới trước khi drop index cũ để FK MySQL luôn có supporting index, Down làm ngược tương ứng.

Chỉ seed hai rows cấu hình PASSWORD_POLICY/ATTENDANCE, không seed user/role/grant hay password history. Default policy12..128 tương thích; history thu thập khi đổi password từ thời điểm bật. History retention pruning chỉ áp các hash được lưu bởi chức năng này trong các lần đổi password sau đó, không xóa tài khoản/nhân viên/công cũ.

Snapshot theo lịch chứa timezone/date và UTC start/end/windows, break/grace, QR/GPS/locations/missing rule và settingsVersion. Legacy snapshot null cần review riêng, không dùng ca hiện tại để suy kết quả cũ. PasswordPolicy và snapshot DTO được validate trước serialize; LONGTEXT ở đây là payload JSON được kiểm soát, không phải mặc định mapping string tùy ý.

[Migration source](../../backend/HRM.API/Migrations/20261114112511_AddSystemSettingsAndAttendanceRules.cs) · [SQL review](../../database/migrations/20261114112511_AddSystemSettingsAndAttendanceRules.sql) · [Audit và trạng thái Pending](../modules/System/IMPLEMENTATION.md#3-migration-và-trạng-thái-pending). Không kết nối DB live, không khẳng định Applied/Pending từ snapshot, không tự apply hoặc rollback; MySQL DDL có thể auto-commit. Cần schema mới trước khi dùng cấu hình/password-creation/chấm công mới. Down mất settings/history/snapshot mới nên chỉ rollback có backup và phối hợp binary.

## Mô tả audit_logs

Bảng có từ InitialHRMDatabase, chứa actor/action/entity/before_json/after_json/created_at UTC. Chưa có cột Description hoặc UI; API đọc `/api/audit-logs` dùng bảng hiện có; schema/payload khác nhau theo service. Xem [AuditLog chi tiết](../modules/System/AUDIT_LOG.md) để tra action, ví dụ và coverage; không cần migration cho lần bổ sung tài liệu này.

## Payroll & Compensation

Migration cần duyệt: [20261123171325_CompletePayrollCompensation](../../backend/HRM.API/Migrations/20261123171325_CompletePayrollCompensation.cs) · [SQL sinh offline để review](../../database/migrations/20261123171325_CompletePayrollCompensation.sql). Chưa apply; không truy cập DB live hoặc Railway. [Thiết kế và vận hành](../modules/Payroll/README.md) · [API](../modules/Payroll/API.md).

Giữ các bảng hiện có:

| Table | Phần bổ sung |
|---|---|
| salary_profiles | pay_basis nullable cho legacy, items_json, insurance_base decimal(18,2), dependents, kpi_bonus_amount decimal(18,2), reason, is_verified=false cho legacy, version concurrency; index employee_id/effective_from |
| timesheet_periods | version, input_hash, last_calculation_key, errors_json; unique period_key cũ giữ nguyên |
| timesheet_details | snapshot_json, unique_key nullable unique; giữ FK indexes PeriodID/EmployeeID |
| payroll_periods | department_id/scope_key, policy_id, created/calculated/paid actors, approval_id, version/hash/requestKey/errors, locked_at/paid_at/payment_reference; unique mới (period_key,scope_key), thay unique period_key cũ |
| payroll_details | gross/tax/insurance/employer_insurance decimal(18,2), unique_key và employee_period_key nullable unique; giữ calculation_snapshot JSON và FK indexes |

Chỉ tạo ba bảng:

| Table | Cột/chỉ mục chính |
|---|---|
| salary_components | id, code UNIQUE, name, kind, taxable/tax_deductible/overtime_included, is_active, version |
| payroll_policies | id, code UNIQUE, name, effective_from/to, status, rules_json, legal_reference, version; index status/effective_from |
| payroll_adjustments | id, payroll_period_id FK RESTRICT, employee_id FK RESTRICT, component_id FK RESTRICT, amount decimal(18,2), reason, component_snapshot_json, request_key UNIQUE, is_cancelled, version, created_by/at |

Quan hệ: TimesheetPeriod 1:N TimesheetDetail; PayrollPeriod → TimesheetPeriod, Department?, PayrollPolicy?, ApprovalRequest?; PayrollPeriod 1:N PayrollDetail/PayrollAdjustment; SalaryProfile/PayrollDetail/TimesheetDetail/Adjustment → Employee; Adjustment → SalaryComponent. Không tạo bảng Approval hoặc notification mới.

Khóa nghiệp vụ: UNIQUE period_key/scope_key chống batch trùng, cùng serializable transaction khóa dòng source để ngăn global/department batch chồng nhau. PayrollDetail employee_period_key=`yyyy-MM:employeeId` chống trả trùng khi nhân viên chuyển phòng; unique_key=`payrollPeriodId:employeeId`. Cột unique mới nullable cho legacy, không tự normalize/xóa dòng cũ. TimesheetDetail unique_key=`timesheetPeriodId:employeeId`. Version concurrency tăng ở mọi mutation nghiệp vụ; cột version legacy được khởi tạo 1. Money không đổi precision các cột cũ.

Migration Up chỉ DROP unique period_key cũ (không phải index chống đỡ FK), thêm cột, ba bảng, indexes, RESTRICT FKs và ba screen nếu thiếu. Không cấp role grants, không sửa salary amount/ContractNo/Attendance hoặc tạo lại bảng cũ. SQL và snapshot kiểm tra offline qua PayrollMigrationTests. MySQL DDL có thể auto-commit; review trên staging trước khi người vận hành apply theo quy trình đã duyệt.

Không tự Down sau khi đã dùng nhiều batch phòng ban cùng tháng: unique period_key cũ không thể khôi phục nếu có nhiều dòng. Down cũng xóa chính sách, adjustment, snapshot và cột mới; cần backup, kế hoạch đối soát và phối hợp version ứng dụng. Legacy chưa có snapshot/IsVerified không được tự dùng làm căn cứ trả lương.

## Ghi nhận chấm công ngoài lịch

Migration `20261125031533_AddUnscheduledAttendanceEvidence` thêm `unscheduled_attendances` (Employee/UTC start-end/status/settings snapshot/version/QR IDs/OvertimeRequest/Approval/actor), unique nullable open_employee_key và index employee/start, overtime ID. Bảng `attendance_requests` thêm unscheduled_attendance_id nullable FK RESTRICT để dùng chung idempotency requestKey. Không tạo ca giả hoặc đổi attendances.ScheduleID thành nullable. Dữ liệu chứng cứ không bị xóa khi từ chối/hủy. [Luồng và quyền](../modules/Attendance/API.md#ghi-nhận-ngoài-lịch-và-xác-nhận-tăng-ca). Chưa apply migration; binary mới cần schema này.
