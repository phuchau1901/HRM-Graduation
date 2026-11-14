# Attendance — Chấm công

[API do module System cung cấp](../System/API.md) · [Audit triển khai](../System/IMPLEMENTATION.md) · [Tests](../System/TESTS.md)

Các entity/table Attendance, AttendanceAdjustment, AttendanceRequest, QRSession, Shift, WorkSchedule đã tồn tại trước khi triển khai cấu hình. Giữ nguyên module Entities/Configurations này; controller, DTO và service mới nằm trong Modules/System theo cấu trúc yêu cầu, không tạo lại bảng/module song song.

Hiện có 15 endpoints thực cho Shifts (4), WorkSchedules (6), Attendance (3), QRSessions (2). Giờ ca là địa phương theo timezone cấu hình, actual timestamps UTC do server cấp, WorkDate theo ngày bắt đầu ca. Snapshot lịch bảo vệ lịch sử khi chỉnh ca/settings; legacy rules=null không được tự tính lại. Dữ liệu nhân viên dùng SELF/DEPARTMENT/ALL theo action, không mở quyền do có quyền settings.

AttendanceAdjustments vẫn chỉ có model/table ProposedCheckIn/Out/Reason/Status, chưa có submission/approval APIs. Không tuyên bố workflow duyệt chỉnh công, overtime, payroll hoặc giả lập lại dữ liệu cũ đã hoàn chỉnh.
