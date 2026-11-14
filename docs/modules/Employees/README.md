# Employees — Nhân sự

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. Hồ sơ, hợp đồng và lịch sử chuyển phòng ban có phạm vi dữ liệu.

## Phạm vi source

Source: `backend/HRM.API/Modules/Employees/`.

Entity hiện có: `Contract`, `Employee`, `EmployeeHistory`.

## Nghiệp vụ

EmployeeService dùng EmployeeDataScope để giới hạn query trước khi đọc/ghi. WEB_EMPLOYEES bảo vệ hồ sơ/lịch sử; WEB_CONTRACTS bảo vệ hợp đồng. DELETE hồ sơ là ngừng hoạt động, không xóa lịch sử nghiệp vụ. Hợp đồng có DRAFT/ACTIVE/EXPIRED/TERMINATED/CANCELLED; ngày kết thúc không trước ngày bắt đầu; ContractNo unique.

Chuyển phòng ban có EffectiveDate và Reason, ghi EmployeeHistory cùng UserId từ JWT. Employee có `PositionId` nullable tham chiếu `positions.id`; API tạo/sửa hồ sơ nhận `positionId`, API đọc trả vị trí hiện tại. Dữ liệu cũ chưa gán vị trí có giá trị null.

Mutation hồ sơ/chuyển phòng/hợp đồng tích hợp NotificationService hiện có, lưu audit và thông báo trong cùng AppDbContext transaction. Payload thông báo generic, không chứa dữ liệu nhân sự chi tiết; lỗi lưu thông báo làm rollback nghiệp vụ.


## Tài liệu module

- [Profiles API](PROFILES_API.md)
- [Contracts API](CONTRACTS_API.md)
- [History API](HISTORY_API.md)
- [SELF/DEPARTMENT/ALL](DATA_SCOPE.md)
- [Kiểm thử Employees](TESTS.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).

## Teams

Employee có `TeamId` nullable, composite FK bảo đảm Team thuộc Department của Employee. Các response hồ sơ có `TeamId` và `TeamName`. PUT cũ không gửi teamId giữ nguyên Team; chuyển Department gỡ Team cũ nếu không chỉ định Team mới hợp lệ. Audit `EMPLOYEE_TEAM_CHANGED` lưu before/after và actor trong cùng transaction. Team không thêm data scope mới. Xem [API Teams](../Organization/TEAMS_API.md) và [Profiles API](PROFILES_API.md#team-của-nhân-viên).

## Mã nhân viên và tạo tài khoản

EmployeeCode mới tự sinh `NV` + Id AUTO_INCREMENT, tối thiểu 6 chữ số, không nhận mã từ client và không đổi khi cập nhật. Giữ unique index và mã legacy. [Chi tiết sinh mã](PROFILES_API.md#employeecode-tự-động-chỉ-đọc). Tạo User kèm Employee qua createEmployee của POST /api/users dùng một transaction chung, không tạo Employee riêng rồi mới gọi User.

- [Audit và báo cáo tạo Employee/User atomic](EMPLOYEE_CREATION.md)
