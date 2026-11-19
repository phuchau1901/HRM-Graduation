# Attendance — Chấm công

[API Attendance](API.md) · [Module Work: ca và lịch](../Work/README.md) · [Cấu hình hệ thống](../System/API.md)

Chấm công/QR sở hữu controller, DTO và service tại Modules/Attendance; quy tắc AttendanceRules và AttendanceCorrectionRules ở cùng module. Ca và phân lịch do Modules/Work quản lý. Entity/Configuration của Shift/WorkSchedule chuyển file sang Work, giữ namespace cũ; các entity chấm công giữ tại Attendance. Không đổi mapping database hoặc lịch sử migration.

API Shifts, WorkSchedules, Attendance và QRSessions giữ URL, RBAC, Data Scope và snapshot cũ. Giờ thực tế UTC do server cấp, ngày công theo timezone cấu hình; không tự tính lại lịch sử khi settings thay đổi.

AttendanceAdjustment được tận dụng bởi [Leave / Approval Workflow](../Leave/README.md), với [API tạo/hủy/duyệt](../Leave/API.md). Chỉ cập nhật Attendance khi duyệt cuối, kiểm tra snapshot/version lịch và lưu AuditLog trước/sau. Không tự sửa dữ liệu cũ hoặc tính payroll.
