# Kiểm thử và Postman

[Mục lục](../README.md) · [API Inventory](../API/README.md)

## Automated tests

Từ repository root:

```sh
dotnet build backend/HRM.API/HRM.API.csproj
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj
```

Test host dùng Testing, SQLite in-memory, secret ngẫu nhiên, seed/worker tắt; không dùng MySQL Railway. SQLite không thay thế kiểm tra InnoDB locks/collation/DDL/large batch trên DEV đã được duyệt. VSTest cần mở socket nội bộ trên một số môi trường sandbox.

Chọn module:

```sh
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj --filter 'FullyQualifiedName~OrganizationApiTests'
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj --filter 'FullyQualifiedName~EmployeeApiTests'
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj --filter 'FullyQualifiedName~Administration'
```

Test suite bao gồm PasswordService/AuthService/profile/API/JWT, permission standard/extended, Administration CRUD/security/concurrency/revocation, Notification/outbox, Organization, Employees, migration operations và route inventory. Xem TESTS.md của từng module để biết tình huống cụ thể. Không dùng số test lịch sử làm cam kết cho source mới; kết quả cần lấy từ lần chạy thực tế.

Đợt viết lại Markdown chỉ kiểm tra cấu trúc, internal links và độ phủ52 endpoint; không tuyên bố đã chạy lại build/test hoặc xác minh trạng thái DB live.

## Postman

Collection chính được giữ nguyên tại [HRM-API.postman_collection.json](../HRM-API.postman_collection.json), gồm52 request. File có sẵn [API/HRM-API.postman_collection.json](../API/HRM-API.postman_collection.json) cũng được giữ nguyên; không merge/ghi đè dữ liệu chưa commit khi viết lại Markdown. Dùng một collection nhất quán cho phiên test.

Đặt baseUrl, userId, loginPassword/token ở local environment hoặc Vault. Chạy Login để lấy token. Collection có request ghi dữ liệu và Cleanup: không chạy toàn bộ collection lên Railway, không export secret runtime.

Quy trình kiểm thử:

1. Chọn môi trường local/DEV đã cho phép; xác minh schema/grant/worker theo module, không tự cấp quyền để làm test pass.
2. Login; gọi /me và /me/permissions, kiểm tra không có credential.
3. Gọi endpoint không JWT→401; thiếu action→403; với quyền hợp lệ kiểm tra success và business validation.
4. Với Administration, GET detail/matrix lấy ETag trước mỗi mutation; thiếu428, stale412; test self escalation/last-admin/reset bằng account thử nghiệm.
5. Với Employee, chạy SELF/DEPARTMENT/ALL độc lập theo cấu hình backend được duyệt.
6. Với Notification, dùng Idempotency-Key ổn định khi retry, chờ worker PUBLISHED rồi kiểm tra inbox/read; user khác không đọc được; reconnect phải đồng bộ API.
7. Revoke qua API quản trị, token cũ→401, Login mới phản ánh grant mới. Không coi sửa SQL trực tiếp là cùng cơ chế thu hồi.

Không tự chạy migration, seed, reset DB hoặc bật worker trên môi trường thật để phục vụ kiểm thử tài liệu.
