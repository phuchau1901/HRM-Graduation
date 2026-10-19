# JWT Authorization V2 và API access logging

## Quyền trong JWT

Login xác thực bằng PasswordService hiện có, đọc users → user_roles → roles → role_details → screens đang hoạt động, tổng hợp OR từng action qua các role. JWT chứa sub=UserId chuỗi, role và snapshot hrm_p có phiên bản hrm_pv=1, ví dụ:

```json
{"WEB_EMPLOYEES":["UPDATE","VIEW"]}
```

ScreenPermissionHandler chỉ đọc ClaimsPrincipal đã được JwtBearer xác thực, không truy vấn role_details cho request nghiệp vụ. ADMIN không có ngoại lệ. Registry PermissionActions.Columns ánh xạ đúng sáu cột Y/N hiện có; action chưa đăng ký bị từ chối. UPDATE/DELETE/... độc lập với VIEW. Snapshot lấy cả action không có VIEW; response Login và /me vẫn giữ cấu trúc cũ và chỉ hiển thị màn hình có VIEW.

IPermissionService.HasPermissionAsync vẫn dùng được khi caller cần đọc quyền hiện tại trong DB; handler không sử dụng nó. GetSnapshotAsync chạy khi Login. /me và /me/permissions vẫn đọc profile từ database như trước; sau khi sửa quyền, danh sách UI có thể khác snapshot trong token cũ.

JWT mặc định 15 phút, ClockSkew 30 giây, HS256, xác thực issuer/audience/chữ ký/lifetime. Giới hạn token phát hành và Bearer đầu vào mặc định 8192 byte, cấu hình 2048–32768. Snapshot quá lớn làm Login trả lỗi 500 chung, không phát hành token bị cắt thiếu quyền. Không đưa password, salt, email hoặc connection string vào JWT.

## API hiện tại

| API | Bảo vệ |
| --- | --- |
| POST /api/auth/login | Anonymous; LoginRateLimiter hiện có |
| GET /api/auth/me | JWT hợp lệ + tài khoản ACTIVE |
| GET /api/auth/me/permissions | JWT hợp lệ + tài khoản ACTIVE |
| GET /api/departments | JWT + WEB_DEPARTMENTS / VIEW |

Đây là toàn bộ controller endpoint trong source production hiện tại. Chưa có Employees CRUD, API phê duyệt hoặc xuất báo cáo để gán thêm quyền. Swagger chỉ bật Development. Route __test/permissions chỉ nằm trong test assembly và được đăng ký riêng ở test host.

Endpoint mới sử dụng `[ScreenPermission("WEB_EMPLOYEES", "UPDATE")]` sau khi xác nhận screen code. Quyền chức năng không xác định phạm vi bản ghi SELF/DEPARTMENT/ALL. Chưa thêm schema hoặc suy đoán data scope. Khi triển khai quy tắc phạm vi đã được duyệt, dùng ApiErrors.DataScopeDeniedAsync để trả HRM_AUTH_004.

## JSON lỗi

Response có success=false, code, error, message, traceId; không trả exception/token/chi tiết chữ ký.

| HTTP | Code | Error |
| --- | --- | --- |
| 401 | HRM_AUTH_001 | MISSING_TOKEN / INVALID_TOKEN; INVALID_CREDENTIALS khi Login sai |
| 401 | HRM_AUTH_002 | TOKEN_EXPIRED |
| 403 | HRM_AUTH_003 | PERMISSION_DENIED |
| 403 | HRM_AUTH_004 | DATA_SCOPE_DENIED |
| 429 | HRM_AUTH_005 | RATE_LIMITED, giữ Retry-After |
| 500 | HRM_API_500 | INTERNAL_ERROR |

Chỉ SecurityTokenExpiredException từ middleware xác thực được phân loại TOKEN_EXPIRED. Test riêng xác nhận token hết hạn có chữ ký sai vẫn là INVALID_TOKEN. Không giải mã payload chưa xác thực để phân loại. Model validation của ASP.NET Core giữ response validation hiện có.

## Thu hồi và giới hạn

Sửa role_details không thay đổi quyền trong JWT đã phát hành. Token mới sau Login lấy quyền mới. Token trước V2 thiếu snapshot sẽ bị 403 trên endpoint ScreenPermission và cần đăng nhập lại. Giữ truy vấn users.Status=ACTIVE trong OnTokenValidated mỗi request, nên khóa/xóa tài khoản vẫn chặn ngay.

Chưa có API refresh token; khi triển khai phải đọc lại snapshot từ DB, không sao chép quyền token cũ. Giai đoạn sau có thể cache trạng thái tài khoản ngắn hạn và thêm auth_version/invalidation. Cache sẽ thay đổi độ trễ khóa tài khoản nên cần quyết định nghiệp vụ trước.

Để thêm IMPORT/LOCK/UNLOCK/ASSIGN/RESET_PASSWORD mà không thêm cột, đề xuất permission_actions(action_code duy nhất) và role_screen_actions(role_id,screen_id,action_code,allowed), khóa duy nhất ba trường và FK phù hợp. Cần duyệt schema/chuyển dữ liệu sáu cột trước khi tạo migration. Lần sửa này không thay đổi schema.

## Log và cấu hình Railway

ApiAccessLoggingMiddleware ghi ILogger structured event ApiAccess, JSON console ra stdout: TimestampUtc, TraceId/CorrelationId do server sinh, UserId đã xác thực hoặc anonymous, Method, Route template, StatusCode, DurationMs, ClientPlatform, ScreenCode, Action, ErrorCode và ClientIp tùy chọn.

Không log raw URL/query/route values/body/JWT/Authorization/Cookie/exception message. Route không khớp ghi /[unmatched]. ClientPlatform hiện là unknown vì chưa có nguồn đáng tin cậy; không tin header client. IP mặc định tắt. Log 401/403/500 luôn được ghi dù health check hoặc sampling. Không ghi MySQL; AuditLog nghiệp vụ giữ riêng. X-Correlation-Id response trùng traceId lỗi, không lấy correlation header của client.

Cấu hình bổ sung trên Railway, giữ SigningKey/Issuer/Audience/secret đang dùng:

```text
Jwt__AccessTokenMinutes=15
Jwt__MaxTokenBytes=8192
ApiAccessLogging__IncludeClientIp=false
ApiAccessLogging__ExcludedPaths__0=/health
ApiAccessLogging__ExcludedPaths__1=/healthz
ApiAccessLogging__ExcludedPaths__2=/ready
```

Sampling theo route template trong appsettings hoặc environment tương đương:

```json
{"ApiAccessLogging":{"SuccessSampleRates":{"api/auth/me":0.1}}}
```

Chỉ sampling request thành công. Nếu cần ForwardedFor/Proto, xác nhận IP proxy thực tế rồi đặt ReverseProxy__KnownProxies__0 (và index tiếp theo). Chỉ proxy đã khai báo được tin cậy, ForwardLimit=1. Không dùng wildcard hoặc bật ASPNETCORE_FORWARDEDHEADERS_ENABLED để tin mọi proxy. Nhiều tầng proxy cần thiết kế lại allowlist/hop tương ứng. Chưa sửa biến môi trường Railway.

Hosting.Diagnostics giới hạn Warning để tránh log raw URL. Tránh bật HTTP body logging, EF SensitiveDataLogging hoặc IdentityModel PII ở production. Thiết lập retention/access control cho Railway logs vì UserId/IP vẫn là định danh.

## File sửa/tạo

- Services/JwtService.cs: snapshot claims và giới hạn token.
- Controllers/Auth/AuthController.cs: snapshot khi Login, JSON lỗi Login/rate limit.
- Modules/Authorization/Services/IPermissionService.cs, PermissionService.cs: action registry/query snapshot.
- Modules/Authorization/Policies/ScreenPermission.cs: handler đọc claims, metadata screen/action.
- Security/JwtPermissions.cs, Security/ApiErrors.cs: parser từ chối mặc định, JSON lỗi.
- Middleware/ApiAccessLoggingMiddleware.cs: log an toàn và xử lý 500.
- Program.cs: JsonConsole, DI, JWT events, trusted proxies, thứ tự middleware.
- ../HRM.API.Tests/AuthorizationV2Tests.cs và AuthProfileServiceTests, AuthenticationApiTests, PermissionApiTests: kiểm thử V2 và snapshot/revocation.
- Tài liệu này.

Giữ PasswordService, AuthService, LoginRateLimiter, AuthSeeder, entity, configuration, migrations và database. Giữ các file người dùng đã di chuyển trước đó. Backup trước sửa: /private/tmp/hrm-auth-v2/before.tar.gz.

## Kiểm chứng và tồn tại

Build HRM.API.csproj thành công: 0 warning, 0 error. Nhóm Authentication/Authorization: 54/54 pass. Toàn bộ suite: 96 pass, 2 fail, tổng 98; không skip test. git diff --check sạch.

Test dùng TestServer/SQLite cục bộ, password/signing key sinh ngẫu nhiên, không truy cập Railway. Kiểm tra multi-role OR, sáu action độc lập, ADMIN không bypass, khóa user, token cũ/mới sau thu hồi, lỗi missing/expired/sai chữ ký/expired sai chữ ký/tampered, size limit, JSON lỗi và log 200/401/403/500 không rò rỉ dữ liệu. Hai lỗi có trước:

- AuthSeederTests.SeedCreatesDemoAccountsAndNeverRestoresEditedPasswordsRolesOrPermissions kỳ vọng 4 role/5 user; seeder hiện chỉ có ADMIN/admin. Không tự đổi dữ liệu seed.
- AuthServiceTests.InitialMigrationCreatesCompleteSchemaAndAllUserForeignKeysUseUserId thất bại ở HasPendingModelChanges. Snapshot còn Screen.ParentID/Route/SortOrder/SupportedActions và FK ParentID nhưng entity/config hiện tại đã bỏ. Cần đối chiếu schema và quyết định riêng; không tự sửa migration để làm test xanh.

Tham khảo API chuẩn: [JwtBearerEvents](https://learn.microsoft.com/en-us/dotnet/api/microsoft.aspnetcore.authentication.jwtbearer.jwtbearerevents?view=aspnetcore-8.0), [Forwarded Headers và trusted proxies](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/proxy-load-balancer?view=aspnetcore-8.0).
