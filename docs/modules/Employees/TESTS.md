# Employees — Kiểm thử

[Module](README.md) · [Hướng dẫn chạy test](../../guides/TESTING.md)

## Source kiểm thử

Trong `backend/HRM.API.Tests/`: EmployeeApiTests, ApiInventoryTests.

## Các tình huống cần giữ

- Profiles/Contracts/History được bảo vệ JWT+screen action; SELF/DEPARTMENT/ALL và user không liên kết Employee.
- Đọc/ghi trong phòng, chặn SELF ghi và chuyển liên phòng khi không ALL; contractId phải thuộc Employee truy cập được.
- Validation mã/email/FK/ngày/trạng thái; soft deactivation giữ lịch sử; chuyển phòng ghi actor từ JWT.
- Audit và Notification cùng transaction; lỗi insert notification rollback mutation nghiệp vụ; payload generic.

Automated tests dùng SQLite/TestServer, không chứng minh trạng thái grant/DDL của Railway. Các tình huống mới chưa có assertion tương ứng phải bổ sung test trước khi thay nghiệp vụ; đối chiếu tên method test trong source, không xem checklist này là kết quả chạy thực tế.

Khi test thủ công bằng Postman, chỉ dùng môi trường và tài khoản thử nghiệm đã được duyệt, lấy permission từ backend; không ghi password/token vào báo cáo.

## EmployeeCode và tạo User atomic

`EmployeeCreationTests` kiểm tra mã đầu tiên, sau dữ liệu cũ, slot code legacy, 10 request nhiều connection, mã chỉ đọc khi sửa/chuyển Department/Team/Position, không tái dùng identity, API không cần/trust employeeCode và lỗi DB/rollback. Tests User kiểm tra createEmployee flag/body, quyền NEW live + scope, liên kết cũ, RoleId/audit và không còn Employee nếu User insert/recovery guard lỗi. Xem [báo cáo kiểm chứng](EMPLOYEE_CREATION.md).

## Projection GET và names

`EmployeeReadApiTests` kiểm tra names/IDs list/detail, null Team/Position, JSON field hiện có, tên catalog inactive, row legacy thiếu Department, scope/filter/Count trước paging và sort ổn định. SQL interceptor xác nhận 1 row-query LEFT JOIN cho trang 1 hoặc 18 nhân viên, số query không tăng theo pageSize; không tracking Employee/Department/Team/Position. Kiểm tra cả JWT/VIEW/scope thiếu trả 401/403, ngoài scope hoặc không tồn tại trả 404. Response write dùng cùng projection, không cần catalog VIEW mới.
