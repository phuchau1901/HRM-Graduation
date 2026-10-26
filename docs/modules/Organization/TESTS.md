# Organization — Kiểm thử

[Module](README.md) · [Hướng dẫn chạy test](../../guides/TESTING.md)

## Source kiểm thử

Trong `backend/HRM.API.Tests/`: OrganizationApiTests, ApiInventoryTests.

## Các tình huống cần giữ

- Không JWT401, thiếu action403; CRUD department/position đúng grant; unique code, validation và phân trang.
- Không xóa Department đang có Employee hoặc Position được History tham chiếu; inactive position được lưu đúng.
- Không thay tên bảng/cột/precision theo suy đoán; catalog không mở quyền đọc hồ sơ nhân viên.

Automated tests dùng SQLite/TestServer, không chứng minh trạng thái grant/DDL của Railway. Các tình huống mới chưa có assertion tương ứng phải bổ sung test trước khi thay nghiệp vụ; đối chiếu tên method test trong source, không xem checklist này là kết quả chạy thực tế.

Khi test thủ công bằng Postman, chỉ dùng môi trường và tài khoản thử nghiệm đã được duyệt, lấy permission từ backend; không ghi password/token vào báo cáo.
