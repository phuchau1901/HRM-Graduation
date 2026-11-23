# Attendance API — Chấm công và QR

Controller/DTO/service thuộc `backend/HRM.API/Modules/Attendance/`. URL và quyền không đổi. Quy tắc chấm công đọc từ [System Settings](../System/API.md); lịch làm việc do [Work](../Work/API.md) quản lý.

## Attendance — server time và evidence

| Method | URL | Quyền |
| --- | --- | --- |
| GET | /api/attendances | WEB_ATTENDANCE/VIEW + Employee scope |
| POST | /api/attendances/check-in | WEB_MY_ATTENDANCE / UPDATE; không Scope; chỉ nhân viên đăng nhập |
| POST | /api/attendances/check-out | WEB_MY_ATTENDANCE / UPDATE; không Scope; chỉ nhân viên đăng nhập |

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

Schedule phải SCHEDULED và EmployeeId lấy từ tài khoản ACTIVE đăng nhập trùng EmployeeId của lịch. Hai API punch không gọi EmployeeDataScope hoặc yêu cầu cấu hình SELF/DEPARTMENT/ALL; chỉ kiểm tra WEB_MY_ATTENDANCE / UPDATE. Ca người khác trả404, chưa có liên kết nhân viên hợp lệ trả403 HRM_AUTH_006. Quản trị viên cũng không được chấm công hộ qua các API này; sửa giờ công dùng Attendance Adjustment và Approval Workflow.

Check-in từ start-before đến min(end,start+after); checkout từ max(start,end-before) đến end+after, bao gồm biên. LateMinutes=max(0,ceil(checkin-start)-lateGrace), EarlyMinutes tương tự với end-checkout-earlyGrace. Khi đủ hai đầu, WorkedMinutes=max(0,floor(checkout-checkin)-BreakMinutes) chỉ là số phút tổng, chưa phải payroll/overtime engine.

RequireQr: session ACTIVE, ValidFrom<=serverNow<ExpiresAt, token SHA256 khớp constant-time và location nằm trong snapshot. RequireGps: tọa độ hợp lệ, Haversine trong radius của địa điểm snapshot; nếu QR+GPS thì phải cùng địa điểm QR. GPS là tọa độ client cung cấp, không có hardware attestation. Không lưu/log raw token hoặc hash vào audit. Actual timestamps và Late/Early được lưu UTC/kết quả theo snapshot, không recompute khi đổi cấu hình.

Missing rule REJECT_CHECKOUT_WITHOUT_CHECKIN trả409 nếu checkout trước checkin. INCOMPLETE cho lưu checkout-only với MISSING_CHECK_IN. Checkin-only là INCOMPLETE trong cửa sổ, GET hiển thị MISSING_CHECK_OUT sau deadline mà không ghi DB; close ghi trạng thái cuối. Không tự bịa timestamp để lấp đầu thiếu, không sửa old punches.

Response200 AttendanceView: id, scheduleId, employeeId, workDate, checkInAtUtc?, checkOutAtUtc?, lateMinutes, earlyMinutes, status, workedMinutes?. List giữ pagination, employeeId/from/to filters chỉ thu hẹp scope.

## QRSession — bảng qr_sessions có sẵn

GET /api/qr-sessions: WEB_QR_SESSIONS/VIEW, pagination; chỉ id/locationCode/validFromUtc/expiresAtUtc/status, không nonceHash/token.

POST /api/qr-sessions: WEB_QR_SESSIONS/NEW, body `{"locationCode":"HQ","lifetimeSeconds":60}`; lifetime15..300 giây, location tồn tại trong cấu hình hiện tại. 201 `{session,token}`, token random32 bytes chỉ trả lần tạo, DB chỉ SHA256. Không tự lưu token vào Postman collection/export/log. Phiên QR có thể dùng cho nhiều nhân viên tại địa điểm trong TTL; không phải OTP cá nhân.


## Attendance Management và My Attendance

[Đặc tả daily, statistics, Excel, drawer và phiếu điều chỉnh](MANAGEMENT.md). Các endpoint mới dùng WEB_ATTENDANCE VIEW/EXPORT với Scope theo action, cùng bộ lọc dữ liệu. Không tạo Attendance giả cho người chưa chấm công.

| Method | API | Quyền |
| --- | --- | --- |
| GET | /api/attendances/daily | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/statistics | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/filters | WEB_ATTENDANCE VIEW + Scope |
| GET | /api/attendances/daily/detail | VIEW trên WEB_MY_ATTENDANCE (chỉ chính mình, không Scope) hoặc WEB_ATTENDANCE (Scope quản lý) |
| GET | /api/attendances/me | WEB_MY_ATTENDANCE VIEW, không Scope; chỉ nhân viên đăng nhập |
| GET | /api/attendances/export | WEB_ATTENDANCE EXPORT + Scope, file .xlsx |

GET `/api/attendances/me` chỉ cần `WEB_MY_ATTENDANCE / VIEW`, không đọc Data Scope và không yêu cầu WEB_ATTENDANCE / VIEW. Backend lấy EmployeeId từ tài khoản ACTIVE đăng nhập, có hồ sơ nhân viên tồn tại; không liên kết trả HRM_AUTH_006. employeeId trong query không thay được người xem. Quyền quản lý daily/statistics/filters/export vẫn theo WEB_ATTENDANCE; check-in/check-out dùng WEB_MY_ATTENDANCE / UPDATE không Scope; WEB_MY_ATTENDANCE VIEW không cấp quyền ghi hoặc xem người khác. Frontend My Attendance hiển thị theo screen mới; drawer hỗ trợ WEB_MY_ATTENDANCE VIEW cho chính mình hoặc WEB_ATTENDANCE VIEW theo Scope. Cần cấp screen mới active và VIEW qua API phân quyền hiện có, không tự chuyển grant hoặc sửa DB.

Check-in và check-out: POST `/api/attendances/check-in` và `/api/attendances/check-out` chỉ cần `WEB_MY_ATTENDANCE / UPDATE`, không đọc Data Scope, không cần WEB_ATTENDANCE NEW/UPDATE. Server bắt buộc user ACTIVE có nhân viên liên kết hợp lệ và ca thuộc đúng nhân viên đó; ca của người khác trả404. API punch không bắt buộc VIEW, nhưng màn My Attendance cần thêm VIEW để tải danh sách. Giữ cửa sổ snapshot, QR/GPS, kỳ công khóa, requestKey/idempotency, transaction và audit. Các API quản lý vẫn giữ Scope theo action.

GET `/api/attendances/daily/detail` chấp nhận VIEW trên **một trong** WEB_MY_ATTENDANCE hoặc WEB_ATTENDANCE, không yêu cầu cả hai. Với WEB_MY_ATTENDANCE VIEW, chỉ xem employee liên kết user đăng nhập và không đọc Scope; employeeId/scheduleId người khác trả404. Với WEB_ATTENDANCE VIEW, xem theo Scope VIEW hiện hành. Nếu có cả hai, chi tiết chính mình ưu tiên nhánh cá nhân; dữ liệu người khác vẫn phải nằm trong Scope quản lý. Thay đổi này chỉ cấp quyền đọc, không cấp quyền punch hoặc điều chỉnh.
