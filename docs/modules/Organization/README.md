# Organization — Tổ chức

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. CRUD phòng ban, Teams và vị trí/chức danh; danh mục dùng chung cho các module.

## Phạm vi source

Source: `backend/HRM.API/Modules/Organization/`.

Entity hiện có: `Department`, `Position`, `Team`.

## Nghiệp vụ

DepartmentsController, PositionsController dùng OrganizationService và BusinessExceptionFilter. Danh sách hỗ trợ page/pageSize/search/isActive; phân trang mặc định30, tối đa100. Mã danh mục unique; chỉ xóa cứng khi không còn tham chiếu, nếu đang được Employee/History/Team sử dụng thì trả409. Department có nhiều Team; xem các đặc tả Teams trong Organization.

Quyền chức năng: WEB_DEPARTMENTS hoặc WEB_POSITIONS với VIEW/NEW/UPDATE/DELETE tương ứng. Danh mục là global theo grant; quyền này không tự mở quyền đọc dữ liệu cá nhân nhân viên.

Tên bảng `departments` giữ lowercase; các tên cột thực tế theo Configuration, không đổi toàn bộ sang snake_case theo suy đoán. Position và Department có trường/độ dài khác nhau, xem API từng nhóm.


## Tài liệu module

- [Departments API](DEPARTMENTS_API.md)
- [Teams — đội nhóm thuộc Department](TEAMS.md)
- [Positions API](POSITIONS_API.md)
- [Kiểm thử Organization](TESTS.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).

Teams nằm trong cùng module Organization; xem [thiết kế và audit Teams](TEAMS.md), [Teams API](TEAMS_API.md), [Teams tests](TEAMS_TESTS.md). Route `/api/teams` và quyền `WEB_TEAMS` giữ nguyên; việc chuyển namespace không đổi schema.
