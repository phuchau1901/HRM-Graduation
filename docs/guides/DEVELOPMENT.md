# Chạy Backend local

[Mục lục](../README.md) · [Kiểm thử](TESTING.md) · [Database](DATABASE.md)

## Điều kiện

.NET SDK8; MySQL tương thích Pomelo; dự án backend/HRM.API/HRM.API.csproj. Program giữ một AppDbContext, ApplyConfigurationsFromAssembly và explicit MySQL server version trong design-time factory.

Cấu hình ConnectionStrings:DefaultConnection, Jwt:Issuer, Jwt:Audience, Jwt:SigningKey bằng user-secrets hoặc secret store của môi trường. Không ghi giá trị thật vào source/tài liệu. Kiểm tra tên cấu hình và validation trong Program.cs/JwtOptions trước chạy; không tự đổi key để làm token cũ hợp lệ.

Khởi tạo kho secrets local nếu cần:

```sh
dotnet user-secrets init --project backend/HRM.API/HRM.API.csproj
```

Nhập secret bằng công cụ secret manager local an toàn; không dùng password thật trong collection hoặc command chia sẻ. Không bật AuthSeed:Enabled/Notifications:WorkerEnabled khi chưa duyệt ghi DB đích.

## Build và chạy

Từ thư mục repository:

```sh
dotnet restore backend/HRM.API/HRM.API.csproj
dotnet build backend/HRM.API/HRM.API.csproj
dotnet run --project backend/HRM.API/HRM.API.csproj --no-build
```

Đặt môi trường Development theo máy local để dùng Swagger hiện có. URL/port theo launchSettings hoặc cấu hình máy, không giả định domain Railway. Database phải tương thích model; source mới dùng users.auth_version ngay khi Login/validate JWT. Chạy ứng dụng có thể khởi động worker/seed nếu operator đã bật các flag; kiểm tra cấu hình trước.

## Seed và bootstrap

AuthSeeder chỉ admin/ADMIN, chỉ Development opt-in, password lấy riêng user-secrets AuthSeed:Passwords:admin. Seed idempotent nhưng vẫn ghi DB khi thiếu account; không cấp quyền mặc định. Không chạy seed hoặc tự tạo account demo trên Railway Production.

Bootstrap quyền quản trị là quy trình operator được duyệt, không có public API tự cấp quyền. Xem [Authorization Security](../modules/Authorization/SECURITY.md). Data Scope Employee do backend cấu hình, xem [Data Scope](../modules/Employees/DATA_SCOPE.md).

## Frontend

React Web và Flutter Mobile dùng cùng REST/JWT. Cấu hình baseUrl của môi trường; không gửi UserId/Role như căn cứ cấp quyền. Web khác origin cần CORS/same-origin proxy theo [quy ước](CONVENTIONS.md). Offline Notification phải đồng bộ lại qua API.
