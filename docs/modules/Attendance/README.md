# Attendance — Chấm công

[API Attendance](API.md) · [Module Work: ca và lịch](../Work/README.md) · [Cấu hình hệ thống](../System/API.md)

Chấm công/QR sở hữu controller, DTO và service tại Modules/Attendance; quy tắc AttendanceRules và AttendanceCorrectionRules ở cùng module. Ca và phân lịch do Modules/Work quản lý. Entity/Configuration của Shift/WorkSchedule chuyển file sang Work, giữ namespace cũ; các entity chấm công giữ tại Attendance. Không đổi mapping database hoặc lịch sử migration.

API Shifts, WorkSchedules, Attendance và QRSessions giữ URL, RBAC, Data Scope và snapshot cũ. Giờ thực tế UTC do server cấp, ngày công theo timezone cấu hình; không tự tính lại lịch sử khi settings thay đổi.

AttendanceAdjustment được tận dụng bởi [Leave / Approval Workflow](../Leave/README.md), với [API tạo/hủy/duyệt](../Leave/API.md). Chỉ cập nhật Attendance khi duyệt cuối, kiểm tra snapshot/version lịch và lưu AuditLog trước/sau. Không tự sửa dữ liệu cũ hoặc tính payroll.

## Attendance Management và My Attendance

[Đặc tả daily, statistics, Excel, drawer và phiếu điều chỉnh](MANAGEMENT.md). Các endpoint mới dùng WEB_ATTENDANCE VIEW/EXPORT với Scope theo action, cùng bộ lọc dữ liệu. Không tạo Attendance giả cho người chưa chấm công.

| Method | API | Quyền |
| --- | --- | --- |
| GET | /api/attendances/daily | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/statistics | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/filters | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/daily/detail | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/me | WEB_MY_ATTENDANCE VIEW, không Scope; chỉ nhân viên đăng nhập |
| GET | /api/attendances/export | WEB_ATTENDANCE EXPORT + Scope, file .xlsx |

GET `/api/attendances/me` chỉ cần `WEB_MY_ATTENDANCE / VIEW`, không đọc Data Scope và không yêu cầu WEB_ATTENDANCE / VIEW. Backend lấy EmployeeId từ tài khoản ACTIVE đăng nhập, có hồ sơ nhân viên tồn tại; không liên kết trả HRM_AUTH_006. employeeId trong query không thay được người xem. Quyền quản lý daily/statistics/detail/filters/export vẫn theo WEB_ATTENDANCE; check-in/check-out dùng WEB_MY_ATTENDANCE / UPDATE không Scope; WEB_MY_ATTENDANCE VIEW không cấp quyền ghi hoặc xem người khác. Frontend My Attendance hiển thị theo screen mới; drawer quản lý chỉ hiển thị khi có WEB_ATTENDANCE VIEW. Cần cấp screen mới active và VIEW qua API phân quyền hiện có, không tự chuyển grant hoặc sửa DB.

Check-in và check-out: POST `/api/attendances/check-in` và `/api/attendances/check-out` chỉ cần `WEB_MY_ATTENDANCE / UPDATE`, không đọc Data Scope, không cần WEB_ATTENDANCE NEW/UPDATE. Server bắt buộc user ACTIVE có nhân viên liên kết hợp lệ và ca thuộc đúng nhân viên đó; ca của người khác trả404. API punch không bắt buộc VIEW, nhưng màn My Attendance cần thêm VIEW để tải danh sách. Giữ cửa sổ snapshot, QR/GPS, kỳ công khóa, requestKey/idempotency, transaction và audit. Các API quản lý vẫn giữ Scope theo action.
