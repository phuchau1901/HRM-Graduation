# Organization — Tổ chức

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. CRUD phòng ban và vị trí/chức danh; danh mục dùng chung cho các module.

## Phạm vi source

Source: `backend/HRM.API/Modules/Organization/`.

Entity hiện có: `Department`, `Position`.

## Nghiệp vụ

DepartmentsController, PositionsController dùng OrganizationService và BusinessExceptionFilter. Danh sách hỗ trợ page/pageSize/search/isActive; phân trang mặc định30, tối đa100. Mã danh mục unique; chỉ xóa cứng khi không còn tham chiếu, nếu đang được Employee/History sử dụng thì trả409.

Quyền chức năng: WEB_DEPARTMENTS hoặc WEB_POSITIONS với VIEW/NEW/UPDATE/DELETE tương ứng. Danh mục là global theo grant; quyền này không tự mở quyền đọc dữ liệu cá nhân nhân viên.

Tên bảng `departments` giữ lowercase; các tên cột thực tế theo Configuration, không đổi toàn bộ sang snake_case theo suy đoán. Position và Department có trường/độ dài khác nhau, xem API từng nhóm.


## Tài liệu module

- [Departments API](DEPARTMENTS_API.md)
- [Positions API](POSITIONS_API.md)
- [Kiểm thử Organization](TESTS.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
