# Bật / tắt log terminal theo user và module

Cấu hình qua API System Settings bên dưới. API lưu vào bảng `system_settings` hiện có, key `TERMINAL_LOGGING`, không cần Migration. Khi chưa có dữ liệu lưu, dùng `TerminalLogging` trong `backend/HRM.API/appsettings.json`, file theo environment hoặc biến môi trường làm mặc định. Cấu hình đã lưu qua API được ưu tiên hơn file/env. Cấu hình này chỉ lọc output console; không tắt job, không sửa Audit Logs, không thay response API, JWT, phân quyền hoặc correlation ID.

Mặc định tất cả tắt (`N`). Chỉ in khi **Enabled=Y, user=Y và module=Y** đồng thời. Quy tắc áp dụng cả log lỗi; cờ N không chỉ chặn request thành công. Chỉ chuỗi Y/y có nghĩa bật, không dùng boolean true. Module và user so khớp không phân biệt hoa/thường.

## API System Settings

| Method | Endpoint | Quyền |
| --- | --- | --- |
| GET | `/api/system-settings/terminal-logging` | JWT + WEB_SYSTEM_SETTINGS VIEW |
| PUT | `/api/system-settings/terminal-logging` | JWT + WEB_SYSTEM_SETTINGS UPDATE |
| GET | `/api/system-settings/terminal-logging/modules` | JWT + WEB_SYSTEM_SETTINGS VIEW |

Hai API toàn hệ thống và catalog không áp dụng Data Scope SELF/DEPARTMENT/ALL. API catalog trả `{modules:[...],specialUsers:["system","anonymous"]}`; module lấy từ Controller thực tế, không cần cố định ở frontend.

GET trả `{settings:{enabled,defaultUser,defaultModule,includeSql,users,modules},version,updatedAtUtc}` và header ETag. Khi chưa lưu, version=0, ETag=`"0"`, updatedAtUtc=Unix epoch; GET không tự tạo dữ liệu. Lần đầu PUT khởi tạo key trong transaction.

PUT gửi trực tiếp object settings, không bọc thêm `settings` hoặc `version`; gửi header `If-Match` bằng ETag của GET. Ví dụ:

```http
PUT /api/system-settings/terminal-logging
Authorization: Bearer <accessToken>
Content-Type: application/json
If-Match: "0"
```

```json
{
  "enabled": "Y",
  "defaultUser": "N",
  "defaultModule": "N",
  "includeSql": "N",
  "users": { "admin": "Y", "system": "N" },
  "modules": { "Employees": "Y", "Authorization": "Y" }
}
```

PUT thay toàn bộ cấu hình; muốn giữ rule khác phải gửi lại rule đó. Response giống GET, version tăng1. API chỉ nhận Y/N viết hoa, userId phải tồn tại (trừ system/anonymous), module thuộc catalog, mỗi map tối đa500 rule, không có key trùng không phân biệt hoa/thường. Lỗi400 validation,401 chưa đăng nhập,403 thiếu screen permission,428 thiếu If-Match,412 stale version; concurrent insert/deadlock409 yêu cầu GET lại. Dữ liệu và Audit Log commit cùng transaction; chỉ cập nhật cache sau commit. Background sync bỏ qua version cũ hơn để không ghi đè lần PUT mới.

Settings lưu bền qua restart. Không tự apply Migration, không deploy. Chưa bổ sung UI riêng cho setting này.

## Mỗi user tự chọn module riêng

- `GET /api/system-settings/terminal-logging/me`
- `PUT /api/system-settings/terminal-logging/me`

Chỉ cần JWT của user ACTIVE, không cần quyền WEB_SYSTEM_SETTINGS hoặc Data Scope, không cần EmployeeId. Chỉ sửa user đăng nhập; không nhận userId để sửa thay người khác. `system` và `anonymous` là danh tính log đặc biệt, chỉ quản trị qua API toàn hệ thống.

GET trả `{settings:{enabled,modules,globalEnabled,includeSql,availableModules},version,updatedAtUtc}` + ETag. Không trả userId/rule của tài khoản khác. `modules` là lựa chọn module hiện tại của chính mình; `availableModules` dùng để dựng form. PUT dùng If-Match của GET và body:

```json
{
  "enabled": "Y",
  "modules": { "Employees": "Y", "Attendance": "N" }
}
```

PUT thay toàn bộ danh sách module **của chính mình**. Module không gửi mặc định N, không kế thừa các module bật chung. Các user khác giữ nguyên cấu hình. Không thay master Enabled, DefaultUser, DefaultModule, IncludeSql hoặc rule system/anonymous. User có thể lưu lựa chọn khi master tắt, nhưng chỉ in log khi `globalEnabled=Y` do admin bật. Quyền tự chọn module không cấp quyền gọi API nghiệp vụ hoặc xem terminal/Audit Logs.

API lưu trong cùng key TERMINAL_LOGGING, Audit ghi riêng TERMINAL_LOGGING_SELF_UPDATED và chỉ snapshot phần cá nhân. Nếu user khác vừa sửa setting chung, ETag có thể cũ: GET lại rồi PUT; không tự ghi đè phần của họ.

### Admin cấu hình nhiều user cùng lúc

API PUT toàn hệ thống hỗ trợ thêm `userModules`:

```json
{
  "enabled": "Y",
  "defaultUser": "N",
  "defaultModule": "N",
  "includeSql": "N",
  "users": { "admin": "Y", "bob": "Y", "system": "N" },
  "modules": {},
  "userModules": {
    "admin": { "Employees": "Y" },
    "bob": { "Attendance": "Y" }
  }
}
```

Hai user phải tồn tại. Admin chỉ in Employees; bob chỉ in Attendance. Một khi có entry userModules[user], chỉ dùng map đó và các module thiếu là N, kể cả DefaultModule=Y. User chưa có map riêng vẫn dùng Modules/DefaultModule như phiên bản cũ. Cả hai trường hợp vẫn cần Enabled=Y, user flag=Y và IncludeSql=Y nếu là SQL. PUT admin là thay toàn bộ settings: gửi lại userModules hiện hành để giữ lựa chọn cá nhân đã lưu.

Không đổi schema, không cần Migration. Cache tức thì/cross-instance refresh vẫn như trước.

## Chỉ theo dõi API của admin

```json
"TerminalLogging": {
  "Enabled": "Y",
  "DefaultUser": "N",
  "DefaultModule": "Y",
  "IncludeSql": "N",
  "Users": { "admin": "Y", "system": "N", "anonymous": "N" },
  "Modules": {}
}
```

Admin gọi API sẽ có log; các job nền không in log vì user log của chúng là `system`, không phải user đã tạo dữ liệu. Nếu chỉ muốn xem một số module, đặt `DefaultModule=N` và bật riêng:

```json
"Modules": {
  "Employees": "Y",
  "Authorization": "Y",
  "Notifications": "N"
}
```

Cờ riêng N luôn ghi đè default Y; cờ riêng Y ghi đè default N. `Enabled=N` tắt toàn bộ output của application console provider.

## Tên module

`Auth`, `Authorization`, `Organization`, `Employees`, `Work`, `Attendance`, `Leave`, `Approvals`, `Performance`, `Notifications`, `System`. Module API lấy từ namespace Controller được routing chọn. Vì thế `/api/contracts` thuộc `Employees`, `/api/roles` và `/api/users` thuộc `Authorization`, `/api/system-settings/leave-accrual/run` thuộc `System`.

Log trong cùng request (kể cả EF) dùng module của Controller để dễ lần theo API. Các message không thuộc request/job dùng module từ namespace logger hoặc fallback `System`. Route không khớp Controller cũng fallback `System`.

## Job nền và login

- NotificationWorker: user `system`, module `Notifications`.
- LeaveAccrualWorker: user `system`, module `Leave`.
- WorkScheduleWorker: user `system`, module `Work`.
- Startup/seed/model diagnostics: user `system`, module `System`.
- Chưa xác thực, login, JWT không hợp lệ: user `anonymous`. Backend không đọc username từ request body/header để quyết định bộ lọc. User đã xác thực lấy từ identity được middleware JWT kiểm chứng.

Muốn xem job Notifications thì bật `Users.system=Y` và `Modules.Notifications=Y` (cùng Enabled=Y). Giữ các module khác N nếu không muốn log của job khác. Ngữ cảnh module job được truyền qua async calls, kể cả EF, và không lan sang job chạy song song.

Muốn truy login/401, bật `Users.anonymous=Y` cùng module tương ứng, ví dụ `Auth=Y`. Login chưa có danh tính xác thực nên không thể lọc theo userId gửi trong body. Correlation ID/traceId trong response vẫn có khi terminal bị tắt.

## SQL / mức độ log

`IncludeSql=N` chặn toàn bộ category Microsoft.EntityFrameworkCore để không có log SQL polling, query/debug hoặc EF diagnostics gây nhiễu. `IncludeSql=Y` cho phép log EF nhưng **vẫn phải khớp user và module được bật**.

`Logging:LogLevel` hiện có vẫn là lớp lọc severity bên ngoài. Ví dụ muốn SQL INFORMATION cần category EF không bị đặt ở Warning/Error:

```json
"Logging": {
  "LogLevel": {
    "Default": "Information",
    "Microsoft.AspNetCore": "Warning",
    "Microsoft.EntityFrameworkCore.Database.Command": "Information"
  }
}
```

Không bật sensitive-data logging hoặc đọc payload/token để bổ sung access log. API access event giữ format JSON an toàn hiện có. Console scope bổ sung `TerminalUserId`, `TerminalModule`, và `TerminalTraceId` cho request HTTP; khi bật SQL có thể nối SQL và access event bằng cùng traceId. Success sampling/excludedPaths của ApiAccessLogging vẫn áp dụng trước console filter.

## Biến môi trường (Railway/local)

```text
TerminalLogging__Enabled=Y
TerminalLogging__DefaultUser=N
TerminalLogging__DefaultModule=N
TerminalLogging__IncludeSql=N
TerminalLogging__Users__admin=Y
TerminalLogging__Users__system=N
TerminalLogging__Modules__Employees=Y
TerminalLogging__Modules__Authorization=Y
```

Không tự deploy để đổi config. File JSON được reload qua IOptionsMonitor khi host phát hiện thay đổi file; logger đã tạo không giữ snapshot config cũ. Thay biến môi trường cần khởi động lại tiến trình qua quy trình vận hành của môi trường đó. Console provider không query database khi ghi log. Worker đọc đúng một setting định kỳ 30 giây để đồng bộ instance/restart, dùng cache trong bộ nhớ; cấu hình host `TerminalLoggingRefresh:PollSeconds` giới hạn5..300 giây và `WorkerEnabled` điều khiển worker đồng bộ. PUT áp dụng ngay sau commit trên instance nhận request, các instance khác đồng bộ trong một chu kỳ nếu DB truy cập được. Worker lỗi giữ cấu hình hợp lệ gần nhất.

## Kiểm thử

TerminalLoggingTests kiểm tra Y/N, default/override, identity đã xác thực, controller module cho log SQL/access, cờ EF, reload đối với logger đã tạo và cách ly hai job async. AuthorizationV2Tests giữ kiểm tra không ghi payload/token, error envelope và correlation ID khi request lỗi.

Kết quả xác nhận: 80/80 tests liên quan terminal logging, authorization, Notifications, Leave Accrual và Work Schedules đạt; Backend build thành công. Không thay database hoặc deploy.

API settings bổ sung: 60/60 tests liên quan API terminal settings, System Settings, Authorization, API inventory và model/Approval đạt. Bao gồm nạp policy DB bởi worker vào cache mới, quyền không Scope, audit, version cũ và validation không làm đổi runtime policy.

Cấu hình module riêng theo user: 63/63 tests liên quan đạt, bao gồm cách ly module giữa hai user, API me không đọc/sửa user khác, không bật master/SQL, bảo vệ ETag và tương thích cấu hình cũ. Backend build đạt, không cần Migration.
