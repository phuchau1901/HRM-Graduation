# Attendance API — Chấm công và QR

Controller/DTO/service thuộc `backend/HRM.API/Modules/Attendance/`. URL và quyền không đổi. Quy tắc chấm công đọc từ [System Settings](../System/API.md); lịch làm việc do [Work](../Work/API.md) quản lý.

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

