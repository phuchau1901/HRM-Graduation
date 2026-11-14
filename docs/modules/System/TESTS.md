# System — Tests

SystemSettingsTests: mọi rule password, password history, live RBAC/ETag, concurrent settings PUT chỉ một writer thành công, không revoke mật khẩu/token cũ, cấu hình min8/max10 áp trực tiếp API User thay cho DTO12 cũ, và trusted Auth primitive không bỏ qua policy.

AttendanceConfigurationTests: server timestamp/strict request chống gửi thời gian, windows/grace/snapshot không đổi sau chỉnh Shift/settings, idempotency và unique Attendance, QR/GPS/token secrecy, thiếu checkin theo hai rule, close/absence, legacy null snapshot fail closed, SELF Employee scope và không áp scope vào global settings. SystemSettingsTests còn kiểm tra timezone Asia/Ho_Chi_Minh, overnight UTC crossing, weekdays, DST invalid, geofence distance và biên window/grace.

SystemSettingsMigrationTests: chỉ tạo system_settings/password_histories, không recreate các bảng Attendance, không delete/backfill old business data, rules_snapshot_json nullable, index thay thế được tạo trước khi drop index FK cũ, MySQL SQL generation và snapshot khớp.

Frontend SystemSettings.test.jsx: hai tab, GET server values, If-Match/version PUT, readonly theo RBAC, GPS/location inputs, lỗi stale không tự retry, Shift UI dùng API thật. Employees tests cũ vẫn giữ.

```sh
dotnet build backend/HRM.API/HRM.API.csproj
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj
npm --prefix web-admin test
npm --prefix web-admin run build
```

Các tests không kết nối DB live. SQLite concurrency dùng nhiều connection file-backed; không tuyên bố đã apply/test migration trên MySQL Production. Kết quả cuối và lỗi baseline NV/TX xem [Implementation](IMPLEMENTATION.md#7-kiểm-chứng-và-giới-hạn).


## AuditLog API

`AuditLogApiTests`: 7 cases kiểm tra JWT, quyền riêng (Settings VIEW không thay thế), thu hồi grant khi JWT cũ vẫn tồn tại, bộ lọc trước phân trang, thứ tự ổn định, JSON detail/null/UTC, không cache, 404, không có DELETE, query sai/overflow. ApiInventoryTests kiểm kê 79 routes, 69 business actions bảo vệ bằng JWT/quyền.

Kiểm chứng lần bổ sung API: backend build thành công (0 warnings/errors). Full suite: 264 tests, 255 passed, 9 failed. Cả 7 AuditLog cases và inventory passed; 9 lỗi EmployeeCreationTests đã có sẵn do generator trả TX trong khi tests yêu cầu NV, không sửa trong phạm vi AuditLog. Không kết nối DB live hoặc apply migration.
