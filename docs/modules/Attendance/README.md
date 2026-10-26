# Attendance — Chấm công

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **PARTIAL — model/hạ tầng có; API nghiệp vụ MISSING**. Đã có Entity/Fluent Configuration; chưa có Controller, DTO hoặc Service HTTP nghiệp vụ.

## Phạm vi source

Source: `backend/HRM.API/Modules/Attendance/`.

Entity hiện có: `Attendance`, `AttendanceAdjustment`, `AttendanceRequest`, `QRSession`, `Shift`, `WorkSchedule`.

## Phạm vi và giới hạn

Phạm vi model: ca làm, lịch làm, chấm công, hiệu chỉnh/yêu cầu và phiên QR. Chưa có API để tạo ca, phân lịch, check-in/out hoặc phê duyệt hiệu chỉnh. Cần chốt timezone, ca qua ngày, chống gửi trùng và khóa kỳ trước triển khai. Không ghi các route dự kiến như API đang chạy.

## Tài liệu module

- [Kiểm thử và quy trình chung](../../guides/TESTING.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
