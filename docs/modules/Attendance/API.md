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

## Tự nhận diện lịch khi punch

POST check-in/check-out không bắt buộc scheduleId. Ví dụ `{ "requestKey": "unique-punch-request" }`; vẫn gửi thêm QR/GPS nếu snapshot yêu cầu. Server lấy employee từ tài khoản ACTIVE và chọn lịch SCHEDULED có cửa sổ snapshot chứa thời gian server, hỗ trợ ca qua đêm. Không đọc Data Scope. Nếu check-out khớp nhiều lịch, ưu tiên lịch duy nhất đã check-in và chưa check-out; vẫn còn nhiều lịch thì trả 409 yêu cầu scheduleId, không tự chọn tùy ý. Client cũ truyền scheduleId tiếp tục được hỗ trợ và kiểm tra sở hữu.

Retry cùng requestKey giữ đúng attendance/lịch ban đầu kể cả đã qua cửa sổ punch; key của người khác, thao tác khác hoặc lịch khác bị từ chối. Không có lịch khớp sẽ ghi bằng chứng ngoài lịch theo mục bên dưới, không tự cấp giờ OT hoặc lương.

## Ghi nhận ngoài lịch và xác nhận tăng ca

Check-in/check-out bỏ `scheduleId`: nếu không có ca phù hợp thì ghi giờ thực tế vào `unscheduled_attendances`, **không tạo Shift/WorkSchedule giả**. Nếu đang trong ca nhưng đã quá cửa sổ check-in, API yêu cầu Attendance Adjustment, không cho chuyển thành OT để bỏ qua ca/đi trễ. Nhiều ca cùng khớp vẫn trả 409 để chọn rõ scheduleId.

- Check-in: server ghi StartAtUtc, snapshot quy tắc QR/GPS, trạng thái OPEN. Mỗi nhân viên chỉ có một phiên ngoài lịch đang mở; requestKey dùng chung bảng attendance_requests để chống trùng cả hai loại punch.
- Check-out không truyền scheduleId ưu tiên phiên ngoài lịch đang mở. Ghi EndAtUtc và commit bằng chứng trước; sau đó tự gửi xác nhận qua workflow OVERTIME hiện có. Không tự cấp ApprovedHours.
- Nếu không có route/người duyệt hợp lệ hoặc chưa gửi được thông báo, giờ đã chấm vẫn được giữ ở RECORDED; response có confirmationMessage, có thể gửi lại. Phiên dưới 1 phút hoặc quá 24 giờ được lưu nhưng không tự gửi duyệt; HR cần đối soát, không tự cắt sửa timestamp.
- Nếu có một đơn OT PENDING/APPROVED bao phủ toàn khoảng thực tế thì liên kết đơn đó, không tạo trùng workflow. Một đơn có thể liên kết nhiều phiên thực tế không chồng lấn. Đơn chỉ giao một phần khoảng giờ thì lưu RECORDED, yêu cầu đối soát trước khi gửi.
- Snapshot QR/GPS khi check-in tiếp tục áp dụng lúc check-out. Không nhận giờ, employeeId hoặc ApprovedHours từ client.

Response vẫn là AttendanceView, thêm các field:

```json
{
  "id": 123,
  "scheduleId": null,
  "employeeId": 32,
  "recordType": "UNSCHEDULED",
  "unscheduledAttendanceId": 123,
  "checkInAtUtc": "2026-11-25T02:00:00Z",
  "checkOutAtUtc": "2026-11-25T04:00:00Z",
  "status": "PENDING",
  "workedMinutes": 120,
  "overtimeRequestId": 456,
  "approvalId": 789,
  "version": 3,
  "confirmationMessage": null
}
```

`workedMinutes` ở bản ghi UNSCHEDULED là phút thực tế đã chấm, **không phải phút OT được duyệt**. `id` thuộc bảng theo recordType; không dùng id ngoài lịch để gọi API sửa/chốt Attendance có ca. Các field mới không loại bỏ field cũ; client cũ truyền scheduleId tiếp tục hoạt động.

| API | Quyền / phạm vi |
|---|---|
| GET `/api/attendances/punch-context?checkIn=true` | WEB_MY_ATTENDANCE UPDATE, không scope; trả recordType/requireQr/requireGps/openId để chuẩn bị punch theo snapshot |
| GET `/api/attendances/unscheduled/me` | WEB_MY_ATTENDANCE VIEW, không scope; chỉ employee liên kết login |
| GET `/api/attendances/unscheduled` | WEB_ATTENDANCE VIEW và SELF/DEPARTMENT/ALL |
| POST `/api/attendances/unscheduled/{id}/submit` | WEB_MY_ATTENDANCE UPDATE, không scope; chỉ chính mình; `{version,reason}` bắt buộc |
| POST `/api/attendances/unscheduled/{id}/cancel` | WEB_MY_ATTENDANCE UPDATE, không scope; chỉ RECORDED chưa gửi, `{version,reason}` bắt buộc; giữ nguyên bằng chứng |

List nhận page/pageSize/search, employeeId/departmentId/teamId, from/to (theo ngày bắt đầu phiên, Asia/Ho_Chi_Minh), status OPEN/RECORDED/PENDING/APPROVED/REJECTED/CANCELLED. Lọc thêm chỉ thu hẹp scope; GET me không cho xem người khác. Response `{success,total,page,pageSize,data:[{id,employeeID,employeeCode,fullName,startAtUtc,endAtUtc,status,version,overtimeRequestId,approvalId}]}`.

Quyết định vẫn dùng `/api/approvals/{id}/approve|reject`: WEB_APPROVALS APPROVE, đúng người/bước/scope/version. Chi tiết duyệt OT bổ sung `actualEvidence` gồm ID, start/end UTC và trạng thái của các phiên thực tế. Không tạo endpoint duyệt tắt bằng VIEW/ALL. Hủy đơn đang pending qua API Overtime hiện có sẽ cập nhật các bằng chứng liên kết thành CANCELLED; không xóa timestamp. APPROVED không được hủy bằng API raw.

My Attendance có panel giờ ngoài lịch, check-in/out tự động, trạng thái pending, gửi lại xác nhận/hủy khi chưa gửi. Attendance quản lý đọc cùng panel theo scope và mở Approval Center khi có quyền. Thống kê/danh sách công thường vẫn theo ca; không trộn giờ raw thành công thường hoặc coi là đã được duyệt.

### Timesheets / Payroll

Source tính công đọc raw theo khoảng UTC giao với tháng. OPEN/RECORDED/PENDING là lỗi cần xử lý trước khóa; APPROVED chỉ được tính khi đơn OT liên kết cũng APPROVED và có ApprovedHours. Lấy giao giờ thực tế/giờ được duyệt, tách tại nửa đêm Việt Nam để hai tháng không đếm trùng; không cộng WorkedDays/công thường. REJECTED/CANCELLED không cộng OT. Snapshot lưu đoạn giờ/request IDs và warning tham chiếu ID bằng chứng. Chốt kỳ đã khóa vẫn chặn punch và duyệt ngược lịch sử. Không thay cấu trúc JSON snapshot cũ chỉ để bổ sung raw, tránh làm đổi fingerprint kỳ đã duyệt không liên quan.

### Migration

`20261125031533_AddUnscheduledAttendanceEvidence`: thêm bảng raw và cột attendance_requests.unscheduled_attendance_id nullable, unique open_employee_key (null cho phiên đã đóng), indexes và RESTRICT FKs. Không đổi khóa ScheduleID bắt buộc của attendances, không tạo lại bảng cũ hoặc cấp quyền mới. Cần người vận hành review/apply trước chạy binary mới; lần triển khai này không apply migration và không deploy Railway. Down xóa raw evidence/liên kết mới nên phải backup và đối soát trước rollback.

Nếu lịch được bổ sung sau khi raw đã gửi/duyệt và chồng lên giờ đã ghi, source Payroll sẽ yêu cầu đối soát thay vì cộng cùng giờ đó thành OT. Xung đột ghi/duyệt/hủy đồng thời trả 409 để reload/retry; không tự ghi đè trạng thái.

Kiểm tra triển khai: build Backend/Frontend thành công; 63 tests liên quan Attendance/Leave/Payroll/API/migration pass; frontend 90/90 pass. Bộ backend đầy đủ: 633 pass / 9 fail / 642 tests, các lỗi còn lại thuộc EmployeeCreationTests đang kỳ vọng NV trong khi generator hiện dùng TX. Không thay đổi generator/test đó; không apply migration hoặc deploy. Các kiểm tra migration/SQL và integration dùng provider offline/SQLite, không xác nhận schema hay concurrency MySQL production đã chạy.
