# Work API — Ca và phân lịch làm việc

Controller/DTO/service thuộc `backend/HRM.API/Modules/Work/`. URL và quyền không đổi. [Bulk/Calendar/Copy/Export](WORK_SCHEDULES.md).

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


## Calendar, bulk assignment, copy, export

Xem [đặc tả đầy đủ](WORK_SCHEDULES.md). Các API `/api/work-schedules/calendar`, `/bulk/preview`, `/bulk`, `/copy`, `/export` thuộc module Work. Cấu hình ngày lễ và quy tắc chấm công đọc từ System Settings.
