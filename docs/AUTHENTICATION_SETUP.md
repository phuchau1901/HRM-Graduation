# Authentication: cấu hình, seed và kiểm thử

Current identity/schema design is now string UserId; see [USERID_STRING_REFACTOR.md](USERID_STRING_REFACTOR.md). Numeric UserId and response-id statements below are historical.

Current rebuild preparation supersedes the older migration/User ID assumptions below: [HRM_REBUILD_PREPARATION_20261019.md](HRM_REBUILD_PREPARATION_20261019.md).

## Source đã xác minh

PasswordService sinh salt bằng RandomNumberGenerator (32 byte), PBKDF2-HMAC-SHA256 mặc định 600.000 vòng, hash 32 byte, format `PBKDF2-SHA256!iterations!BASE64_HASH`, salt Base64 riêng, so sánh FixedTimeEquals. Giữ nguyên xử lý hash Identity V2/V3 và nâng cấp sau xác thực thành công.

Các API mới:

- `POST /api/auth/login`: `{ "username": "admin", "password": "<nhập tại client>" }`. Trả accessToken, tokenType, expiresAtUtc, user, roles, permissions. Không trả hash/salt. Sai thông tin hoặc tài khoản không ACTIVE trả cùng 401. Quá giới hạn trả 429 và Retry-After: 60.
- `GET /api/auth/me`: Bearer token; trả user, roles, permissions mới nhất từ database.
- `GET /api/auth/me/permissions`: Bearer token; trả danh sách màn hình active với sáu cờ canNew/canView/canUpdate/canDelete/canApprove/canExport, luôn Y hoặc N.

Quyền được cộng giữa các Role: có Y ở bất kỳ Role được gán thì kết quả Y; thiếu quyền hoặc giá trị khác Y thì N. ADMIN không tự bypass RoleDetail. Các endpoint này cung cấp quyền cho client; nghiệp vụ khác muốn kiểm soát quyền màn hình phía server phải có authorization policy tương ứng, không chỉ dựa vào UI.

JWT HS256 kiểm tra chữ ký, issuer, audience, exp/nbf; clock skew 30 giây. Mỗi request Bearer hợp lệ còn kiểm tra User vẫn ACTIVE. Role claims là ảnh chụp tại lúc cấp JWT; /me và /permissions đọc quyền hiện tại. Không thêm refresh/logout/revoke-token endpoints; đổi mật khẩu không tự thu hồi access token còn hiệu lực. Không thay đổi Roles/RoleDetail trong Login.

## Cấu hình local

Chạy lệnh từ thư mục gốc repository. Không ghi secret vào appsettings hoặc Git. Nếu đã có cấu hình hợp lệ, giữ nguyên giá trị. Các giá trị trong dấu `<...>` dưới đây là chỗ cần điền tại máy của bạn, không phải secret mẫu dùng chung:

```sh
dotnet user-secrets set 'Jwt:Issuer' 'HRM.API' --project backend/HRM.API
dotnet user-secrets set 'Jwt:Audience' 'HRM.Client' --project backend/HRM.API
dotnet user-secrets set 'Jwt:SigningKey' '<secret-ngẫu-nhiên-ít-nhất-32-byte-UTF8>' --project backend/HRM.API
```

`Jwt:AccessTokenMinutes` tùy chọn, mặc định 15, giới hạn 1–120. App sẽ từ chối khởi động khi JWT config thiếu/không hợp lệ, trước khi chạy seed. Giữ ConnectionStrings:DefaultConnection hiện có; xác minh nó là database development dự định sử dụng trước khi bật seed. Không chạy app Development có seed bật nếu connection đang trỏ Railway chưa được phép thay đổi.

Production có thể cung cấp JWT qua secret store/environment (`Jwt__Issuer`, `Jwt__Audience`, `Jwt__SigningKey`). Source không tự thiết lập hoặc thay đổi cấu hình Railway. Production tuyệt đối không chạy AuthSeeder kể cả AuthSeed:Enabled=true.

## Seed — chỉ chạy sau khi bạn duyệt schema và cho phép ghi database đích

Source mới không tự chạy migration hoặc EnsureCreated. Seed yêu cầu schema đã sẵn sàng. Chưa chạy seed hay cập nhật Railway trong quá trình triển khai.

Lưu riêng năm mật khẩu do bạn chọn trong user-secrets:

```sh
dotnet user-secrets set 'AuthSeed:Passwords:admin' '<mật-khẩu-admin>' --project backend/HRM.API
dotnet user-secrets set 'AuthSeed:Passwords:hr01' '<mật-khẩu-hr01>' --project backend/HRM.API
dotnet user-secrets set 'AuthSeed:Passwords:manager01' '<mật-khẩu-manager01>' --project backend/HRM.API
dotnet user-secrets set 'AuthSeed:Passwords:employee01' '<mật-khẩu-employee01>' --project backend/HRM.API
dotnet user-secrets set 'AuthSeed:Passwords:employee02' '<mật-khẩu-employee02>' --project backend/HRM.API
```

Seeder đọc mật khẩu từ một configuration riêng chỉ có user-secrets, không fallback sang appsettings hoặc environment. Mật khẩu không được log. Dùng terminal/secret editor riêng khi nhập, tránh chia sẻ lịch sử chứa giá trị thật.

Chỉ khi đã sẵn sàng ghi database development:

```sh
ASPNETCORE_ENVIRONMENT=Development AuthSeed__Enabled=true dotnet run --no-launch-profile --project backend/HRM.API
```

Cờ trên chỉ tồn tại cho process đó. Những lần chạy bình thường không có cờ sẽ không seed. Seed thực hiện trong transaction:

| Tài khoản mới | Role ban đầu |
| --- | --- |
| admin | ADMIN |
| hr01 | HR |
| manager01 | MANAGER |
| employee01 | EMPLOYEE |
| employee02 | EMPLOYEE |

Bổ sung Role còn thiếu, không đổi Name của Role đã có. Chỉ gán Role cho tài khoản vừa được tạo. Tài khoản tồn tại được giữ nguyên hoàn toàn; Role từng bị gỡ sẽ không được tự gán lại. Không seed màn hình hoặc RoleDetail vì chưa có ma trận quyền nghiệp vụ được duyệt. Vì vậy quyền demo có thể toàn N; cần quản trị cấp quyền riêng theo quy tắc dự án. EmployeeID để null, không tạo dữ liệu nhân sự ngoài phạm vi.

Thiếu mật khẩu cho tài khoản cần tạo sẽ dừng trước khi ghi Role/User. Nếu mọi tài khoản đã tồn tại thì chạy lại không cần mật khẩu demo. Chạy seed trong một instance để tránh hai tiến trình khởi tạo đồng thời; unique constraints và transaction ngăn tạo trùng, nhưng tiến trình cạnh tranh có thể báo lỗi và cần chạy lại.

## Migration cần xem xét

Không tạo/sửa/chạy migration trong lượt hoàn thiện API này. Migration `20261019080000_AddUserSalt` từ lượt trước vẫn chờ review; kiểm tra xem database thực tế có salt/Salt hay chưa trước khi quyết định áp dụng. Models Screen và RoleDetail đã tồn tại nhưng các bảng `screens`, `role_details` còn pending so với snapshot hiện tại. API quyền cần những bảng đó; cần duyệt migration riêng đồng bộ schema trước khi sử dụng đầy đủ. Không gộp các thay đổi này vào seed và không tự cập nhật MySQL Railway.

## Postman

Import `docs/HRM-Authentication.postman_collection.json`.

1. Đặt baseUrl theo HTTPS URL hiện khi chạy app (giá trị trong collection chỉ là placeholder cổng 7000).
2. Đặt username và password tại máy local, không export/chia sẻ collection có secret.
3. Chạy Login; test script lưu accessToken vào collection variable.
4. Chạy Me và Permissions; Bearer token được dùng tự động.
5. Xóa token để kiểm tra 401; đổi mật khẩu nhập để kiểm tra cùng thông báo lỗi.
6. Gửi hơn 5 Login/phút từ cùng client để kiểm tra 429; chờ cửa sổ giới hạn tiếp theo rồi thử lại.

LoginRateLimiter được gọi trực tiếp trong AuthService trước truy vấn/hash, 5 lần/phút/IP và 30 lần/phút/instance, không xếp hàng. Không tin raw X-Forwarded-For. Sau reverse proxy, các client có thể chung IP proxy nếu chưa có cấu hình forwarded headers đáng tin cậy. Nhiều Railway replica cần limiter dùng chung/gateway nếu cần giới hạn toàn deployment; source chưa thay đổi cấu hình proxy/Railway.

## Build và test

```sh
dotnet build backend/HRM.API/HRM.API.csproj
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj
```

TestServer dùng SQLite trong bộ nhớ và secret sinh ngẫu nhiên; không dùng connection, user-secrets hoặc database Railway. Bao gồm test PasswordService trước đó, API Login/JWT/permissions/429, token bị sửa hoặc sai issuer/audience/lifetime/chữ ký, seed idempotent, giữ password/RoleDetail/membership đã sửa, và chặn seed ở Production/Staging hoặc chưa bật cờ Development.

Thiết kế JWT và test host dựa trên [Microsoft JWT bearer guidance](https://learn.microsoft.com/aspnet/core/security/authentication/configure-jwt-bearer-authentication) và [ASP.NET Core integration testing](https://learn.microsoft.com/aspnet/core/test/integration-tests?view=aspnetcore-8.0).

Backup trước lượt chỉnh sửa: `/private/tmp/hrm-auth-completion/before.tar.gz` (lưu tạm).

## File bàn giao

Tạo mới:

- `backend/HRM.API/Controllers/Auth/AuthController.cs` (namespace `HRM.API.Modules.Auth.Controllers`; đây là vị trí hiện tại sau khi file được chuyển trong lúc làm việc).
- `backend/HRM.API/Modules/Auth/DTOs/AuthDtos.cs`.
- `backend/HRM.API/Modules/Auth/Services/AuthProfileService.cs`.
- `backend/HRM.API/Modules/Auth/Services/JwtService.cs` (gồm JwtOptions).
- `backend/HRM.API/Data/Seeders/AuthSeeder.cs`.
- `backend/HRM.API.Tests/AuthenticationApiTests.cs`.
- `backend/HRM.API.Tests/AuthSeederTests.cs`.
- Tài liệu này và collection Postman đi kèm.

Sửa `Program.cs` để đăng ký DI, JWT authentication/authorization và seed có điều kiện; sửa test csproj để thêm Microsoft.AspNetCore.Mvc.Testing 8.0.13; cập nhật AUTH_PASSWORDS.md để chỉ rõ đó là báo cáo lịch sử. PasswordService, AuthService, LoginRateLimiter, các Entity/Configuration và toàn bộ migration/snapshot giữ nguyên so với backup của lượt này.

Kết quả xác minh: 52 test đạt, 0 lỗi/0 bỏ qua. Backend build thành công, 0 cảnh báo/0 lỗi. Đã kiểm tra JSON Postman hợp lệ và migration/snapshot không thay đổi so với backup. Không chạy seed hay bất kỳ lệnh cập nhật database MySQL nào.
