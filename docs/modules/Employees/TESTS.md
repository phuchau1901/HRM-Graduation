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
