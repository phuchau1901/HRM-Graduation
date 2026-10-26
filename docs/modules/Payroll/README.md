# Payroll — Lương và bảng công

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **PARTIAL — model/hạ tầng có; API nghiệp vụ MISSING**. Đã có Entity/Fluent Configuration; chưa có API tính lương/chốt kỳ/bảng công.

## Phạm vi source

Source: `backend/HRM.API/Modules/Payroll/`.

Entity hiện có: `PayrollDetail`, `PayrollPeriod`, `SalaryProfile`, `TimesheetDetail`, `TimesheetPeriod`.

## Phạm vi và giới hạn

Model gồm hồ sơ lương, kỳ lương, chi tiết lương, kỳ và chi tiết bảng công. Chưa có thuật toán tính lương, khóa kỳ, xuất báo cáo hay phạm vi dữ liệu lương. Decimal phải giữ precision/scale đúng Configuration, không làm tròn/đổi kiểu theo suy đoán. Không gửi lương hoặc chi tiết thu nhập qua push.

## Tài liệu module

- [Kiểm thử và quy trình chung](../../guides/TESTING.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
