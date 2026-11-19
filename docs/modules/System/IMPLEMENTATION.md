> Cập nhật tổ chức module: nghiệp vụ ca/phân lịch đã chuyển sang [Work](../Work/README.md), chấm công/QR sang [Attendance](../Attendance/README.md). Các mô tả file System cũ bên dưới là lịch sử triển khai; cấu hình chung vẫn ở System.

# System — Audit và báo cáo triển khai

## 1. Có gì trước khi sửa

Audit entity/configuration/controllers, DTO, service, snapshot và migration trong source:

| Phần | Trước thay đổi |
| --- | --- |
| Auth/Users | Login, create User, SELF_CHANGE/ADMIN_RESET, auth_version/refresh revocation, RBAC/admin protection có thật |
| PasswordService | PBKDF2-SHA256 + salt riêng, legacy verification/rehash; giới hạn input1..1024 |
| Password policy | DTO UserCreateRequest/ResetPasswordRequest hardcode12..128; chưa service cấu hình/history |
| System | AuditLog/Notification entities; chưa System Settings entity/API/UI |
| shifts | Bảng/entity/config, giờ Start/End, BreakMinutes/LateGraceMinutes, IsActive; chưa CRUD controller |
| work_schedules | Bảng/entity/config, Employee/Shift/WorkDate/status/UniqueWorkKey; chưa API/snapshot |
| attendances | Bảng/entity/config, UTC-capable datetime fields CheckIn/Out, Late/Early, QR FK, unique schedule; chưa engine/API |
| attendance_adjustments | Bảng/entity/config ProposedCheckIn/Out/Reason/Status; chưa API workflow |
| attendance_requests | Bảng/entity/config request-key idempotency; chưa endpoint sử dụng |
| qr_sessions | Bảng/entity/config nonce_hash, ValidFrom/ExpiresAt/Status; chưa API verify/session issuance |

Không phát hiện API Attendance/SystemSettings mock trước đó: chưa có controller chứ không phải đã có endpoint giả. Không có engine hardcode giờ vào/ra/late/early để thay thế; các default0 ở Fluent Configuration và các trường Shift mới là metadata. Password hardcode12..128 ở AdministrationDtos là rule cần bỏ để thay bằng service chung. Frontend trước đó chỉ có Employees, chưa có Settings hoặc quản lý ca/lịch.

## 2. Bổ sung trong module System

- SystemSetting JSON/version/updatedAt, defaults12..128 để tương thích, validation/live RBAC/audit/If-Match chống lost update.
- PasswordPolicyService dùng chung ở AdministrationService, AuthService trusted primitives và AuthSeeder. Không sửa PasswordService hashing hoặc JWT. Policy mới chỉ áp password mới, login/legacy hash upgrade không bị policy hồi tố.
- PasswordHistory chỉ lưu hash/salt cũ trong transaction password update, không API đọc secret, không plaintext. History check hiện tại + N mật khẩu trước đó; không có dữ liệu trước khi bật chức năng.
- AttendanceConfigurationService và AttendanceRules tái sử dụng Shift/WorkSchedule. Snapshot bất biến theo ngày công, timezone mặc định Asia/Ho_Chi_Minh, UTC windows, overnight, break/grace/working days/QR/GPS/locations/missing punches.
- AttendanceOperationsService dùng TimeProvider server UTC, strict body từ chối thời gian giả, scope/own Employee check, row-lock/idempotency, verify QR+GPS, read/close incomplete status.
- Frontend System Settings đúng hai tab Password Policy/Attendance Settings; trang Ca & lịch làm việc dùng API thật/ETag. Không mock, không grant mặc định, không áp Employee scope vào global settings.
- Các controller, DTO, engine/service mới nằm trong Modules/System; entity Attendance cũ vẫn ở Modules/Attendance, không tạo module/bảng song song.

## 3. Migration và trạng thái Pending

Migration mới `20261114112511_AddSystemSettingsAndAttendanceRules`:

- CREATE system_settings, password_histories; chỉ hai settings rows mặc định, không user/role/grant.
- ALTER shifts thêm version BIGINT DEFAULT0.
- ALTER work_schedules thêm version BIGINT DEFAULT0, rules_snapshot_json LONGTEXT NULL.
- Thay index employee_id bằng (employee_id,work_date); đã sửa thứ tự DDL để tạo index thay thế trước khi drop index cũ, giữ hỗ trợ FK liên tục trên MySQL, cả Up/Down.
- Không tạo lại shifts/work_schedules/attendances/QR/adjustments/requests; không delete/backfill dữ liệu nghiệp vụ cũ hoặc suy snapshot lịch cũ.

[Migration](../../../backend/HRM.API/Migrations/20261114112511_AddSystemSettingsAndAttendanceRules.cs) · [SQL review](../../../database/migrations/20261114112511_AddSystemSettingsAndAttendanceRules.sql).

Không kết nối DB đích hoặc chạy GetApplied/GetPending trực tiếp trong lần này. Các file migration cũ có trong source không chứng minh đã Applied trên Railway; source snapshot không chứng minh bảng/cột live đã tồn tại. Trạng thái Applied/Pending của cả migration cũ và mới trên môi trường đích **chưa xác minh**. Operator cần đối chiếu __EFMigrationsHistory + schema/index thực tế và review SQL trước khi apply. Không có migration application, startup auto-migrate, Railway/Production changes hay dữ liệu cũ bị xóa trong lần triển khai.

Cần schema mới trước khi dùng settings, thiết lập password mới và attendance APIs. Schedule legacy rules=null không được punch/close tự động. Future schedule chưa có Attendance có thể được admin review explicit qua PUT; lịch đã có Attendance không bị sửa. Không convert timestamps legacy vì chưa biết nguồn timezone lịch sử. Down sẽ bỏ metadata/history/settings mới nên rollback cần backup và coordinated binary rollback, không chạy tự động.

## 4. API đã tạo/sửa

19 endpoint mới (route inventory77 tổng) ở [API Specification](API.md): settings4, shifts4, work-schedules6, attendances3, qr-sessions2.

API cũ POST /api/users và POST /api/users/{id}/reset-password giữ route/status/error/RBAC nhưng áp policy DB thay vì StringLength12..128 cố định. DTO giữ cap1024 theo hashing; server service mới là nguồn policy. Các AuthService primitives/seed cũng áp policy; login/rehash không áp policy mới. User privilege protection, PasswordService/JWT và module Employee giữ nguyên.

Chưa thêm AttendanceAdjustments approval endpoints hoặc payroll engine. WorkedMinutes là tổng actual duration trừ break snapshot, không phải tính lương. Location edits/global config mới không sửa snapshots cũ; ca/ngày công cũ không tự recalculate.

## 5. Quyền và bảo mật

WEB_SYSTEM_SETTINGS VIEW/UPDATE global, không Employee scope. WEB_SHIFTS và WEB_QR_SESSIONS là catalog global qua grant. WEB_WORK_SCHEDULES và WEB_ATTENDANCE bắt buộc dataScopes theo action: SELF/DEPARTMENT/ALL. SELF được xem/punch chính chủ, không tự phân ca. ALL không cho punch hộ tài khoản khác. Không tự seed screen/grant; admin hiện tại cần bootstrap/cấp quyền có review qua cơ chế Screens/Role Matrix hiện có.

Config/policy/shifts/schedule/attendance mutations đều audit trong cùng transaction dữ liệu. Không serialize password request, hash/salt hoặc QR token vào audit. QR token raw chỉ response lúc tạo; GPS kiểm tra geofence từ tọa độ client, không tuyên bố hardware attestation. History credential table cần được bảo vệ như users.password_hash.

## 6. Files chính

Modules/System/Entities/SystemSetting.cs, Configurations/SystemSettingConfiguration.cs; DTOs/SettingsDtos.cs, AttendanceDtos.cs; Services/SystemSettingsService.cs, SettingsDefaults.cs, PasswordPolicyService.cs, AttendanceRules.cs, AttendanceConfigurationService.cs, AttendanceOperationsService.cs; Controllers/SystemSettingsController.cs, AttendanceConfigurationControllers.cs.

Các tích hợp: Program.cs; AuthService.cs, AuthSeeder.cs, AdministrationDtos.cs/AdministrationService.cs; Shift/WorkSchedule entities/configurations; migration/designer/snapshot; test harness và ApiInventoryTests. Frontend thêm SystemSettings.jsx, AttendanceSetup.jsx, SystemSettings.test.jsx, chỉnh navigation/styles. Hai Postman Collection và JSON samples settings đã cập nhật.

## 7. Kiểm chứng và giới hạn

Kết quả cuối:

- dotnet build: thành công, 0 warnings / 0 errors.
- dotnet test toàn bộ: 257 tests, 248 passed / 9 failed / 0 skipped; cả 20 test System/Attendance/migration mới nằm trong nhóm passed. Chỉ còn 9 lỗi baseline prefix NV/TX.
- Frontend: 12/12 tests passed; production build thành công. Test bổ sung kiểm tra hủy lịch qua PATCH/If-Match theo quyền DELETE, không hard-delete.
- Postman: 81 request examples / 77 unique endpoints, JSON body và variables hợp lệ. Các link tài liệu, git diff --check, SQL không recreate bảng nghiệp vụ và thứ tự supporting index MySQL đã kiểm tra.

 Tests dùng SQLite/TestServer, MySQL SQL generation và snapshot offline; không chạy migration/MySQL production. Có 9 lỗi baseline EmployeeCreationTests (source generator TX nhưng expected NV) đã được ghi nhận trước tác vụ; không sửa prefix hoặc tests ngoài phạm vi để che lỗi.
