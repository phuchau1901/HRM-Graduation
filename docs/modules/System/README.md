# System — Settings, Password Policy & Shared Audit

[AuditLog — cấu trúc và sự kiện](AUDIT_LOG.md) · [API Specification](API.md) · [Audit/triển khai](IMPLEMENTATION.md) · [Tests](TESTS.md) · [Database](../../guides/DATABASE.md)

Module System sở hữu cấu hình toàn cục, PasswordPolicyService và AuditLog dùng chung. API/DTO/service ca và phân lịch đã chuyển sang [Work](../Work/README.md); nghiệp vụ chấm công/QR và AttendanceRules sang [Attendance](../Attendance/README.md). SystemSettingsController vẫn sở hữu password-policy, attendance settings và các cấu hình chung.

Các quyền cần được quản trị viên đăng ký/cấp có chọn lọc: WEB_SYSTEM_SETTINGS (VIEW/UPDATE), WEB_SHIFTS, WEB_WORK_SCHEDULES, WEB_ATTENDANCE, WEB_QR_SESSIONS. Không seed grant hoặc dựa vào tên role ADMIN. Cấu hình/ca/QR là global qua grant; dữ liệu lịch/chấm công Employee phải có scope theo screen/action.

Migration mới: `20261114112511_AddSystemSettingsAndAttendanceRules`. Chỉ tạo hai bảng mới system_settings/password_histories, thêm version/snapshot/index trên bảng có sẵn và hai dòng settings mặc định. Không apply DB, không seed user/role/grant, không backfill giờ cũ, không deploy. Snapshot lịch cũ để null, yêu cầu review rõ ràng trước khi sử dụng cho punch mới.

AuditLog: `GET /api/audit-logs` (lọc/phân trang) và `GET /api/audit-logs/{id}` (before/after). Cả hai yêu cầu quyền riêng `WEB_AUDIT_LOGS/VIEW` cho audit toàn hệ thống; không cấp grant tự động. Không cần migration.

## Lịch phép tự động

System Settings → Leave Accrual Settings cấu hình suất cấp mặc định defaultDaysPerCycle (mặc định1 ngày/chu kỳ), mức riêng theo PositionId, điều kiện nhân viên mới và hai lịch cấp/thu hồi độc lập với ngày bắt đầu + khoảng lặp MONTH/YEAR. [API và chính sách](../Leave/ACCRUAL_SETTINGS.md). Cấu hình disabled mặc định; không tự chạy migration/deploy. Quyền xem là WEB_SYSTEM_SETTINGS VIEW, lưu/chạy là WEB_SYSTEM_SETTINGS UPDATE; không áp Data Scope và không yêu cầu quyền số dư phép hoặc liên kết Employee.

Lịch phép version2 dùng ngày bắt đầu + khoảng lặp + đơn vị MONTH/YEAR cho cấp và thu hồi độc lập. Lần đầu sau trọn một khoảng lặp; rule daysPerCycle, mặc định ANNUAL nếu bỏ leaveTypeId. Nhân viên chưa có quota không bị tạo số dư khi thu hồi; đến hạn cấp sẽ tạo nếu đủ điều kiện. Cấu hình legacy giữ nguyên đến khi người dùng lưu kiểu lịch mới.

Lịch phép version2 cho phép rules=[]: mọi nhân viên ACTIVE đủ điều kiện nhận mức mặc định ANNUAL, kể cả chưa có chức vụ. Khớp quy tắc chức vụ thì dùng mức riêng và không cộng thêm mức mặc định. Xem payload và điều kiện tại [ACCRUAL_SETTINGS.md](../Leave/ACCRUAL_SETTINGS.md).

## Phân ca hàng loạt và lịch tuần/tháng

Chi tiết audit, quyền theo action, payload preview/bulk/copy/export, ngày lễ và transaction tại [Work Schedule Management](../Work/WORK_SCHEDULES.md). Dùng bảng hiện có, không có Migration mới.

| Method | API | Quyền |
| --- | --- | --- |
| GET | /api/work-schedules/calendar | WEB_WORK_SCHEDULES VIEW + Scope |
| POST | /api/work-schedules/bulk/preview | WEB_WORK_SCHEDULES NEW + Scope; overwrite thêm UPDATE |
| POST | /api/work-schedules/bulk | Như preview, cần previewToken |
| POST | /api/work-schedules/copy | Như bulk, thêm VIEW + Scope nguồn |
| GET | /api/work-schedules/export | WEB_WORK_SCHEDULES EXPORT + Scope; CSV trang đang chọn |

Tự động phân lịch hàng tuần: cấu hình `autoScheduleEnabled` trong GET/PUT `/api/system-settings/attendance` (mặc định true). Job Work đầu Chủ nhật giờ Việt Nam sao chép tuần có lịch gần nhất của từng nhân viên ACTIVE còn hợp đồng ACTIVE, chỉ điền ngày trống và không ghi đè. [Chi tiết lịch chạy, hợp đồng và retry](../Work/WORK_SCHEDULES.md).

Đọc chính sách mật khẩu: GET `/api/system-settings/password-policy` chỉ cần đăng nhập, không kiểm tra quyền màn hình hoặc Scope. PUT vẫn cần WEB_SYSTEM_SETTINGS UPDATE + If-Match.
