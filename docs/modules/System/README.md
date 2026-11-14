# System — Settings, Password Policy & Attendance Configuration

[AuditLog — cấu trúc và sự kiện](AUDIT_LOG.md) · [API Specification](API.md) · [Audit/triển khai](IMPLEMENTATION.md) · [Tests](TESTS.md) · [Database](../../guides/DATABASE.md)

Module System sở hữu cấu hình toàn cục, PasswordPolicyService và các controller/service cấu hình/chấm công. Tái sử dụng entity/table của module Attendance; không dựng bộ bảng Shift/Schedule/Attendance thứ hai. Frontend có hai tab Password Policy, Attendance Settings và màn Ca & lịch làm việc dùng các bảng/API thực.

Các quyền cần được quản trị viên đăng ký/cấp có chọn lọc: WEB_SYSTEM_SETTINGS (VIEW/UPDATE), WEB_SHIFTS, WEB_WORK_SCHEDULES, WEB_ATTENDANCE, WEB_QR_SESSIONS. Không seed grant hoặc dựa vào tên role ADMIN. Cấu hình/ca/QR là global qua grant; dữ liệu lịch/chấm công Employee phải có scope theo screen/action.

Migration mới: `20261114112511_AddSystemSettingsAndAttendanceRules`. Chỉ tạo hai bảng mới system_settings/password_histories, thêm version/snapshot/index trên bảng có sẵn và hai dòng settings mặc định. Không apply DB, không seed user/role/grant, không backfill giờ cũ, không deploy. Snapshot lịch cũ để null, yêu cầu review rõ ràng trước khi sử dụng cho punch mới.

AuditLog: `GET /api/audit-logs` (lọc/phân trang) và `GET /api/audit-logs/{id}` (before/after). Cả hai yêu cầu quyền riêng `WEB_AUDIT_LOGS/VIEW` cho audit toàn hệ thống; không cấp grant tự động. Không cần migration.
