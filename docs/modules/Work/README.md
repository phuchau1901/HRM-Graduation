# Work — Ca và lịch làm việc

[API](API.md) · [Lịch tuần/tháng, bulk, preview, copy, export](WORK_SCHEDULES.md)

Module sở hữu ShiftsController, WorkSchedulesController, WorkScheduleService, WorkScreens và DTO ca/lịch. Frontend nằm tại `web-admin/src/work/`: WorkWorkspace và WorkScheduleCalendar. Nhóm giao diện Attendance & Timekeeping, giữ URL frontend cũ để không làm hỏng bookmark.

Quyền WEB_SHIFTS và WEB_WORK_SCHEDULES giữ nguyên. Scope theo action VIEW/NEW/UPDATE/DELETE/EXPORT, snapshot, transaction, audit và notification giữ nguyên. AttendanceOperationsService và AttendanceRules thuộc module Attendance. System chỉ cung cấp cấu hình chung, password policy và audit dùng chung.

Entity/Fluent Shift, WorkSchedule chuyển file vào Work/Entities và Work/Configurations; giữ namespace/persistence mapping Attendance cũ để bảo toàn EF migration/snapshot, không tạo entity/table thay thế hoặc đổi schema. Việc tách controller/service/DTO là thay đổi tổ chức source, không thay đổi database.

Không có endpoint trùng, không có Migration mới, không apply Migration hoặc deploy Railway.

Tự động phân lịch hàng tuần: cấu hình `autoScheduleEnabled` trong GET/PUT `/api/system-settings/attendance` (mặc định true). Job Work đầu Chủ nhật giờ Việt Nam sao chép tuần có lịch gần nhất của từng nhân viên ACTIVE còn hợp đồng ACTIVE, chỉ điền ngày trống và không ghi đè. [Chi tiết lịch chạy, hợp đồng và retry](WORK_SCHEDULES.md).
