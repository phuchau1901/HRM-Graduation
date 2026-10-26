# Leave — Nghỉ phép và phê duyệt

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **PARTIAL — model/hạ tầng có; API nghiệp vụ MISSING**. Đã có Entity/Fluent Configuration; chưa có API nghỉ phép, tăng ca hoặc phê duyệt.

## Phạm vi source

Source: `backend/HRM.API/Modules/Leave/`.

Entity hiện có: `ApprovalRequest`, `ApprovalStep`, `LeaveBalance`, `LeaveRequest`, `LeaveType`, `OvertimeRequest`.

## Phạm vi và giới hạn

Model gồm loại phép, số dư, yêu cầu nghỉ/tăng ca, yêu cầu và bước phê duyệt. Chưa triển khai workflow chuyển trạng thái, người duyệt hoặc quy tắc trừ/hoàn phép. Khi triển khai cần ScreenPermission đúng catalog, phạm vi người duyệt và NotificationService hiện có; không tạo hệ thống thông báo riêng.

## Tài liệu module

- [Kiểm thử và quy trình chung](../../guides/TESTING.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
