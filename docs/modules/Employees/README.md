# Employees — Nhân sự

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. Hồ sơ, hợp đồng và lịch sử chuyển phòng ban có phạm vi dữ liệu.

## Phạm vi source

Source: `backend/HRM.API/Modules/Employees/`.

Entity hiện có: `Contract`, `Employee`, `EmployeeHistory`.

## Nghiệp vụ

EmployeeService dùng EmployeeDataScope để giới hạn query trước khi đọc/ghi. WEB_EMPLOYEES bảo vệ hồ sơ/lịch sử; WEB_CONTRACTS bảo vệ hợp đồng. DELETE hồ sơ là ngừng hoạt động, không xóa lịch sử nghiệp vụ. Hợp đồng có DRAFT/ACTIVE/EXPIRED/TERMINATED/CANCELLED; ngày kết thúc không trước ngày bắt đầu; ContractNo unique.

Chuyển phòng ban có EffectiveDate và Reason, ghi EmployeeHistory cùng UserId từ JWT. Employee hiện không có PositionId hiện tại; không tự suy ra hoặc bổ sung schema vị trí cho hồ sơ.

Mutation hồ sơ/chuyển phòng/hợp đồng tích hợp NotificationService hiện có, lưu audit và thông báo trong cùng AppDbContext transaction. Payload thông báo generic, không chứa dữ liệu nhân sự chi tiết; lỗi lưu thông báo làm rollback nghiệp vụ.


## Tài liệu module

- [Profiles API](PROFILES_API.md)
- [Contracts API](CONTRACTS_API.md)
- [History API](HISTORY_API.md)
- [SELF/DEPARTMENT/ALL](DATA_SCOPE.md)
- [Kiểm thử Employees](TESTS.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
