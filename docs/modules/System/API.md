# System — API Specification

[Module](README.md) · [Postman](../../HRM-API.postman_collection.json) · [Audit](IMPLEMENTATION.md)

Tất cả route yêu cầu JWT. Riêng GET /api/system-settings/password-policy không cần ScreenPermission hoặc Scope; các route khác vẫn yêu cầu quyền tương ứng và live grant tại service. Không bypass theo tên role. Lỗi giữ envelope dự án; validation JSON/DTO dùng ValidationProblemDetails. List giữ success/total/page/pageSize/data, page>=1, pageSize1..100. Timestamps thực tế là UTC, giờ ca là TimeOnly địa phương và WorkDate là ngày công tại timezone snapshot.

## Password Policy và Attendance Settings

| Method | URL | Quyền |
| --- | --- | --- |
| GET | /api/system-settings/password-policy | JWT đăng nhập; không ScreenPermission, không Scope |
| PUT | /api/system-settings/password-policy | WEB_SYSTEM_SETTINGS/UPDATE |
| GET | /api/system-settings/attendance | WEB_SYSTEM_SETTINGS/VIEW |
| PUT | /api/system-settings/attendance | WEB_SYSTEM_SETTINGS/UPDATE |

Đây là cấu hình global, không dùng Employee data scope và không cần liên kết EmployeeId. GET trả 200 và header ETag dạng `"1"`:

```json
{
  "settings": {
    "minimumLength": 12,
    "maximumLength": 128,
    "requireUppercase": false,
    "requireLowercase": false,
    "requireDigit": false,
    "requireSpecialCharacter": false,
    "disallowUsernameInPassword": false,
    "passwordHistoryCount": 0
  },
  "version": 1,
  "updatedAtUtc": "2026-11-14T00:00:00Z"
}
```

PUT gửi toàn bộ object settings (không bọc settings/version), lấy ETag từ GET vào If-Match. Thành công 200 với version/ETag mới. Thiếu If-Match428, version stale/weak/wildcard/multiple/noncanonical412. Cập nhật nguyên tử, audit before/after và version trong cùng transaction; chỉ một writer dùng cùng ETag thành công. Không tự retry một PUT stale bằng version mới.

Password fields: minimumLength/maximumLength số nguyên1..1024, min<=max; các require flags boolean; disallowUsernameInPassword so sánh substring username không phân biệt hoa thường; passwordHistoryCount0..100. Special là ký tự không phải letter/digit/whitespace. Không cho cấu hình maxLength nhỏ hơn số nhóm ký tự bắt buộc. New password không blank dù minimum=1. [JSON đầy đủ](../../API/password-policy.sample.json).

Default12..128, flagsfalse/history0 giữ policy cũ. Chính sách áp dụng khi tạo User (kể cả kèm Employee), SELF_CHANGE, ADMIN_RESET, AuthService trusted primitives và development seed; bỏ StringLength12..128 cứng ở DTO, giữ transport cap1024 tương thích PasswordService. Không thay hashing/JWT. Login và legacy rehash không áp policy mới hồi tố. Policy update không revoke token hoặc làm password cũ mất hiệu lực.

History N>0: từ chối password hiện tại và N password trước đó đã nhớ. Lưu hash/salt cũ trong transaction đổi password, trim theo N sau thay đổi thành công; không lưu plaintext, không trả hash/salt hoặc log credential. N=0 tắt check/capture, không tự xóa history chỉ vì đổi cấu hình. Không thể khôi phục password history trước khi chức năng được bật. Account privilege/recovery guard, auth_version/refresh revocation và quota reset5/phút giữ nguyên.

Attendance body [JSON đầy đủ](../../API/attendance-settings.sample.json):

| Field | Validation/ý nghĩa |
| --- | --- |
| timezone | IANA/system timezone hợp lệ, default Asia/Ho_Chi_Minh |
| checkInBeforeStartMinutes / checkInAfterStartMinutes | 0..1440; cửa sổ check-in quanh start |
| checkOutBeforeEndMinutes / checkOutAfterEndMinutes | 0..1440; cửa sổ checkout quanh end |
| lateGraceMinutes | 0..240, mặc định khi tạo ca; từng Shift có LateGraceMinutes riêng |
| earlyLeaveGraceMinutes | 0..240, chụp vào snapshot lịch mới |
| workingDays | ISO weekdays1=Monday..7=Sunday, không trùng, ít nhất1 ngày |
| requireQr / requireGps | Bật yêu cầu chứng cứ tương ứng |
| allowOvernightShifts | Cho phép end<start là ngày kế tiếp; start=end không hợp lệ |
| missingPunchRule | REJECT_CHECKOUT_WITHOUT_CHECKIN hoặc INCOMPLETE |
| locations | Tối đa20, code uppercase unique1..50, name1..150, latitude[-90,90], longitude[-180,180], radiusMeters10..10000 |

QR/GPS bật phải có ít nhất một địa điểm. Config mới không sửa Shift cũ, Schedule snapshot cũ hoặc Attendance đã lưu; muốn thay quy tắc cho lịch chưa bắt đầu, dùng PUT schedule có quyền/If-Match.

## API nghiệp vụ đã tách module

Ca và phân lịch: [Work API](../Work/API.md). Chấm công và QR: [Attendance API](../Attendance/API.md). System giữ các API cấu hình và AuditLog. URL API và quyền không đổi.

## HTTP và concurrency

401 thiếu/sai JWT;403 thiếu live grant/scope/evidence;404 resource ngoài scope/không tồn tại;400 validation/policy/timezone/forged-time fields;409 duplicate/khung giờ/legacy/history/status không hợp lệ;412 version stale;428 thiếu If-Match;500 hạ tầng. Password reset vẫn quota429 hiện có. JSON/DTO và generic error envelope giữ convention dự án.

Chưa có API AttendanceAdjustments/approval workflow hoàn chỉnh; bảng cũ được giữ nguyên, không được mô tả là API đã triển khai. Không tự apply migration hoặc deploy.

## AuditLog

Các mutation có ghi audit nghiệp vụ trong DB. Đã có API đọc log; chưa có UI hoặc field Description riêng. [Cấu trúc, mô tả từng Action, payload và giới hạn coverage](AUDIT_LOG.md). Không nhầm API audit với audit triển khai hoặc HTTP access logs.


### GET /api/audit-logs

JWT + `WEB_AUDIT_LOGS / VIEW`. Quyền đọc **toàn hệ thống**, phải được cấp rõ ràng qua cơ chế Screens/Role permissions hiện có; không tự tạo screen/grant và không kế thừa quyền Settings/Employee. Không có API thêm/sửa/xóa audit. Response không cache.

Query: `page` (mặc định 1), `pageSize` (mặc định 30, tối đa 100), `search` (tối đa 150 ký tự; tìm actor/action/entityType/entityId, không tìm payload). Bộ lọc chính xác: `actorUserId`, `action`, `entityType` (tối đa 100), `entityId` (tối đa 60). `fromUtc`, `toUtc` là ISO8601 timestamps, nên gửi `Z` hoặc offset tường minh; offset được chuyển UTC, hai đầu bao gồm, from không được sau to. Không lọc theo result vì chưa có cột result thống nhất.

```json
{"success":true,"total":1,"page":1,"pageSize":30,"data":[{"id":100,"actorUserId":"admin","action":"SETTINGS_UPDATED","entityType":"System","entityId":"PASSWORD_POLICY","createdAt":"2026-11-15T01:00:00Z"}]}
```

Count sau bộ lọc và trước phân trang; sắp xếp createdAt giảm dần, id giảm dần. EF AsNoTracking + projection; không tải before/after ở danh sách.

### GET /api/audit-logs/{id}

Cùng JWT/quyền VIEW, kiểm tra quyền trước lookup. Trả trực tiếp object metadata như trên, thêm `beforeJson`, `afterJson` là JSON value/object hoặc null, không phải chuỗi escape. Actor có thể null. CreatedAt trả UTC `Z`. Payload khác nhau theo nguồn ghi log, không bảo đảm mọi event có result/traceId hoặc đầy đủ hồ sơ trước/sau. Xem [mô tả từng Action và ví dụ detail](AUDIT_LOG.md).

Status: 200 thành công; 400 query sai; 401 chưa xác thực; 403 thiếu quyền; 404 không có log (detail). Lỗi giữ envelope hiện tại. Không tạo migration, không sửa log cũ.

Tự động phân lịch hàng tuần: cấu hình `autoScheduleEnabled` trong GET/PUT `/api/system-settings/attendance` (mặc định true). Job Work đầu Chủ nhật giờ Việt Nam sao chép tuần có lịch gần nhất của từng nhân viên ACTIVE còn hợp đồng ACTIVE, chỉ điền ngày trống và không ghi đè. [Chi tiết lịch chạy, hợp đồng và retry](../Work/WORK_SCHEDULES.md).

GET `/api/system-settings/password-policy` chỉ cần user đăng nhập/JWT hợp lệ, không yêu cầu WEB_SYSTEM_SETTINGS VIEW hoặc Data Scope, không cần liên kết EmployeeId. Giữ response `{settings,version,updatedAtUtc}` và ETag. Chưa đăng nhập trả401. PUT password-policy vẫn cần WEB_SYSTEM_SETTINGS UPDATE và If-Match; GET/PUT Attendance Settings giữ quyền hiện tại. Quyền đọc API này không tự cấp quyền vào màn hình quản trị hoặc chỉnh chính sách.

## Terminal logging

GET/PUT `/api/system-settings/terminal-logging`: VIEW/UPDATE trên WEB_SYSTEM_SETTINGS, JWT, không Scope. PUT dùng If-Match theo ETag GET; gửi trực tiếp settings object. GET `/api/system-settings/terminal-logging/modules` lấy module catalog và specialUsers (VIEW). Lưu bảng system_settings key TERMINAL_LOGGING, tạo row ở lần PUT đầu, không thêm bảng/Migration. Áp dụng ngay instance nhận request sau commit và đồng bộ replica/restart qua cache refresh mặc định30 giây. [Payload, ví dụ và thứ tự ưu tiên](../../guides/TERMINAL_LOGGING.md).
