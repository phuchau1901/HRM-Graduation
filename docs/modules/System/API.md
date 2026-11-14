# System — API Specification

[Module](README.md) · [Postman](../../HRM-API.postman_collection.json) · [Audit](IMPLEMENTATION.md)

Tất cả route yêu cầu JWT và ScreenPermission tương ứng; service còn kiểm tra live grant. Không bypass theo tên role. Lỗi giữ envelope dự án; validation JSON/DTO dùng ValidationProblemDetails. List giữ success/total/page/pageSize/data, page>=1, pageSize1..100. Timestamps thực tế là UTC, giờ ca là TimeOnly địa phương và WorkDate là ngày công tại timezone snapshot.

## Password Policy và Attendance Settings

| Method | URL | Quyền |
| --- | --- | --- |
| GET | /api/system-settings/password-policy | WEB_SYSTEM_SETTINGS/VIEW |
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

## Shifts — bảng shifts có sẵn

| Method | URL | Quyền |
| --- | --- | --- |
| GET | /api/shifts | WEB_SHIFTS/VIEW |
| GET | /api/shifts/{id} | WEB_SHIFTS/VIEW |
| POST | /api/shifts | WEB_SHIFTS/NEW |
| PUT | /api/shifts/{id} | WEB_SHIFTS/UPDATE |

Catalog global, không Employee scope. GET list page/pageSize/search theo code/name, ID tăng dần. Detail trả ETag/version. POST201 + Location/ETag; PUT200 cần If-Match. Body:

```json
{
  "code": "NIGHT",
  "name": "Night shift",
  "startTime": "22:00:00",
  "endTime": "06:00:00",
  "breakMinutes": 60,
  "lateGraceMinutes": 5,
  "isActive": true
}
```

Code trim/uppercase unique max30, name max100. Break>=0 và nhỏ hơn độ dài ca; LateGrace>=0, <=240 và nhỏ hơn độ dài ca. LateGrace null/bỏ qua lấy mặc định hiện tại khi lưu ca; gửi giá trị hiện tại để giữ nguyên. End<start qua đêm nếu được cấu hình cho phép; start=end không hợp lệ. Ngừng sử dụng bằng isActive=false (kể cả ca đêm cũ sau khi settings tắt ca qua đêm); không có hard-delete API. Chỉnh Shift không sửa snapshot lịch đã tạo.

## WorkSchedules — bảng work_schedules có sẵn

| Method | URL | Quyền và scope |
| --- | --- | --- |
| GET | /api/work-schedules | WEB_WORK_SCHEDULES/VIEW + SELF/DEPARTMENT/ALL |
| GET | /api/work-schedules/{id} | VIEW + scope |
| POST | /api/work-schedules | NEW + scope ghi ALL/DEPARTMENT |
| PUT | /api/work-schedules/{id} | UPDATE + scope ghi ALL/DEPARTMENT + If-Match |
| PATCH | /api/work-schedules/{id}/cancel | DELETE + scope ghi + If-Match |
| POST | /api/work-schedules/{id}/close | WEB_ATTENDANCE/APPROVE + scope |

List filters employeeId/from/to; Count trước paging, sort WorkDate rồi ID. Body tạo/sửa:

```json
{ "employeeId": 1, "shiftId": 1, "workDate": "2026-11-16" }
```

Employee ACTIVE trong scope, Shift ACTIVE, WorkDate không quá khứ theo timezone cấu hình và thuộc workingDays. Không trùng Employee/Shift/WorkDate, giữ UniqueWorkKey index có sẵn. POST201, PUT200; detail/response có id, employeeId, shiftId, workDate, status, version, rules snapshot.

Snapshot cố định start/end/window UTC, WorkDate/timezone/ShiftCode, break/grace, QR/GPS/locations/missing rule và settingsVersion. Không tính lại bằng Shift hoặc global config hiện tại khi punch/đọc lịch sử. Giờ DST invalid/ambiguous bị từ chối400, không tự chọn offset. Ca qua đêm thuộc WorkDate của ngày bắt đầu tại timezone đó.

PUT chỉ lịch SCHEDULED chưa bắt đầu, chưa có Attendance, không quá khứ; explicit admin review tạo snapshot mới. Cancel trả204, đổi status CANCELLED, không xóa; không cho hủy lịch đã bắt đầu/chấm công. Close chỉ sau CheckOutCloseUtc, giữ actual timestamps và phân loại COMPLETE/MISSING_CHECK_IN/MISSING_CHECK_OUT/ABSENT, đổi lịch CLOSED. Ngoài scope404 hoặc thiếu scope403. Quyền xem Employee catalog không tự cấp quyền schedule; quyền schedule không tự mở Employee PII.

Lịch legacy snapshot null được hiển thị rules=null; punch/close bị409, không tự suy diễn/backfill lịch sử. Lịch tương lai chưa có Attendance có thể được admin review qua PUT; lịch đã có Attendance giữ nguyên.

## Attendance — server time và evidence

| Method | URL | Quyền |
| --- | --- | --- |
| GET | /api/attendances | WEB_ATTENDANCE/VIEW + Employee scope |
| POST | /api/attendances/check-in | WEB_ATTENDANCE/NEW + scope + EmployeeId chính chủ |
| POST | /api/attendances/check-out | WEB_ATTENDANCE/UPDATE + scope + EmployeeId chính chủ |

Punch body:

```json
{
  "scheduleId": 1,
  "requestKey": "unique-request-key",
  "qrSessionId": null,
  "qrToken": null,
  "latitude": null,
  "longitude": null
}
```

Không nhận userId/employeeId/CheckInAt/CheckOutAt/timestamp trong body; unknown fields bị400. Lấy UTC hiện tại từ TimeProvider phía server, không header/query clock override. RequestKey bắt buộc <=100, unique; phát lại cùng key/operation/employee/schedule đang mở trả record hiện có, không ghi lặp. Key dùng cho resource/operation khác409; mỗi schedule tối đa một Attendance qua unique index có sẵn, row-lock serialize punch.

Schedule phải SCHEDULED và EmployeeId liên kết JWT trùng EmployeeId lịch, kể cả actor có ALL. Quản trị viên không dùng punch để chấm công hộ; workflow adjustment/approval đầy đủ chưa được thêm trong phạm vi cấu hình này. SELF có thể punch chính mình; SELF vẫn không được tự phân ca bằng API quản trị schedule.

Check-in từ start-before đến min(end,start+after); checkout từ max(start,end-before) đến end+after, bao gồm biên. LateMinutes=max(0,ceil(checkin-start)-lateGrace), EarlyMinutes tương tự với end-checkout-earlyGrace. Khi đủ hai đầu, WorkedMinutes=max(0,floor(checkout-checkin)-BreakMinutes) chỉ là số phút tổng, chưa phải payroll/overtime engine.

RequireQr: session ACTIVE, ValidFrom<=serverNow<ExpiresAt, token SHA256 khớp constant-time và location nằm trong snapshot. RequireGps: tọa độ hợp lệ, Haversine trong radius của địa điểm snapshot; nếu QR+GPS thì phải cùng địa điểm QR. GPS là tọa độ client cung cấp, không có hardware attestation. Không lưu/log raw token hoặc hash vào audit. Actual timestamps và Late/Early được lưu UTC/kết quả theo snapshot, không recompute khi đổi cấu hình.

Missing rule REJECT_CHECKOUT_WITHOUT_CHECKIN trả409 nếu checkout trước checkin. INCOMPLETE cho lưu checkout-only với MISSING_CHECK_IN. Checkin-only là INCOMPLETE trong cửa sổ, GET hiển thị MISSING_CHECK_OUT sau deadline mà không ghi DB; close ghi trạng thái cuối. Không tự bịa timestamp để lấp đầu thiếu, không sửa old punches.

Response200 AttendanceView: id, scheduleId, employeeId, workDate, checkInAtUtc?, checkOutAtUtc?, lateMinutes, earlyMinutes, status, workedMinutes?. List giữ pagination, employeeId/from/to filters chỉ thu hẹp scope.

## QRSession — bảng qr_sessions có sẵn

GET /api/qr-sessions: WEB_QR_SESSIONS/VIEW, pagination; chỉ id/locationCode/validFromUtc/expiresAtUtc/status, không nonceHash/token.

POST /api/qr-sessions: WEB_QR_SESSIONS/NEW, body `{"locationCode":"HQ","lifetimeSeconds":60}`; lifetime15..300 giây, location tồn tại trong cấu hình hiện tại. 201 `{session,token}`, token random32 bytes chỉ trả lần tạo, DB chỉ SHA256. Không tự lưu token vào Postman collection/export/log. Phiên QR có thể dùng cho nhiều nhân viên tại địa điểm trong TTL; không phải OTP cá nhân.

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
