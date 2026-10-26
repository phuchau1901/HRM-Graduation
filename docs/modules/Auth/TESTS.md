# Auth — Kiểm thử

[Module](README.md) · [Hướng dẫn chạy test](../../guides/TESTING.md)

## Source kiểm thử

Trong `backend/HRM.API.Tests/`: PasswordServiceTests, AuthServiceTests, AuthProfileServiceTests, AuthenticationApiTests, AuthSeederTests, AuthorizationV2Tests.

## Các tình huống cần giữ

- PBKDF2 đúng format, salt32 byte khác nhau; verify đúng/sai; tampered hash/salt, invalid Base64/iterations/algorithm và legacy Identity.
- Login đúng/sai/unknown/locked, rate limit, alias UserId/username; không trả hoặc log credential.
- JWT sai chữ ký/issuer/audience/lifetime, quá lớn; UserId chuỗi và session version; /me chỉ lấy màn hình có VIEW sau OR.
- Seed opt-in Development, hiện chỉ admin/ADMIN; seed lại không sửa password, membership, RoleName hoặc grant.

Automated tests dùng SQLite/TestServer, không chứng minh trạng thái grant/DDL của Railway. Các tình huống mới chưa có assertion tương ứng phải bổ sung test trước khi thay nghiệp vụ; đối chiếu tên method test trong source, không xem checklist này là kết quả chạy thực tế.

Khi test thủ công bằng Postman, chỉ dùng môi trường và tài khoản thử nghiệm đã được duyệt, lấy permission từ backend; không ghi password/token vào báo cáo.
