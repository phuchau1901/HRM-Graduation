# Attendance Management — Báo cáo ngày và chấm công cá nhân

## Audit: phần đã có

- `attendances`, `work_schedules`, `shifts`, `leave_requests`, `attendance_adjustments`, ApprovalRequest/Step, TimesheetPeriod đã có Entity/Fluent/migration. Không tạo bảng, không đổi Entity/schema.
- `GET /api/attendances` chỉ trả các bản ghi Attendance đã tồn tại. Giữ nguyên contract để không ảnh hưởng client cũ; không dùng endpoint này để thống kê tất cả nhân viên.
- `POST /api/attendances/check-in`, `/check-out` đã có server UTC clock, snapshot windows, scope theo action, kiểm tra user/employee, QR/GPS, requestKey chống trùng và transaction. Giữ nguyên URL/body/quyền.
- Work quản lý ca và phân lịch; các snapshot sẵn có chứa timezone, giờ ca, cửa sổ punch, break/grace và evidence policy. Leave/Approvals đã có luồng điều chỉnh công với audit trước/sau; không sửa giờ trực tiếp.
- TimesheetPeriod khóa theo tháng `period_key=yyyy-MM`. Không có lịch sử org/date-effective hoặc bảng ngày nghỉ không phân ca.

## Phần bổ sung

AttendanceManagementService, DTO daily/statistics/detail và file Excel OpenXML nằm trong Modules/Attendance. Frontend tại `web-admin/src/attendance/AttendanceWorkspace.jsx`.

- Attendance: `/#/hr/attendance`, quản lý theo ngày/khoảng, thống kê, lọc phòng ban/Team/ID hoặc mã/tên nhân viên, trạng thái, phân trang, drawer, xuất `.xlsx`.
- My Attendance: `/#/hr/my-attendance`, dùng endpoint cá nhân, tích hợp check-in/out và tạo phiếu điều chỉnh. Mặc định gồm hôm qua và hôm nay để còn thấy ca qua đêm thuộc ngày hôm trước.
- Ca/lịch làm việc được điều hướng riêng tại `/#/hr/work-schedules`, vẫn thuộc nhóm Attendance & Timekeeping.
- Không có mock rows hoặc mock counters. Loading có skeleton; empty chỉ khi API thực sự trả0; thống kê lỗi hiển thị thông báo và dấu “—”, không dựng số0 giả.

## API và RBAC

Tất cả cần JWT. Các API quản lý dùng WEB_ATTENDANCE với Data Scope SELF/DEPARTMENT/ALL **của action tương ứng**; riêng /me chỉ dùng WEB_MY_ATTENDANCE / VIEW, không kiểm tra Scope. VIEW và EXPORT của quản lý dùng Scope riêng, không lấy scope từ screen khác. Screen active và quyền hiện hành vẫn được kiểm tra ở service. Không cần WEB_EMPLOYEES/WEB_SHIFTS VIEW để xem tên/ca trong dữ liệu Attendance đã được phép xem.

| Method | API | Quyền |
| --- | --- | --- |
| GET | /api/attendances/daily | WEB_ATTENDANCE / VIEW + scope |
| GET | /api/attendances/statistics | WEB_ATTENDANCE / VIEW + scope, cùng query/bộ lọc với daily |
| GET | /api/attendances/filters | WEB_ATTENDANCE / VIEW + scope; department/Team chỉ trong phạm vi |
| GET | /api/attendances/daily/detail | WEB_ATTENDANCE / VIEW + scope; resource ngoài phạm vi trả404 |
| GET | /api/attendances/me | WEB_MY_ATTENDANCE / VIEW, không Scope; chỉ nhân viên đăng nhập |
| GET | /api/attendances/export | WEB_ATTENDANCE / EXPORT + scope EXPORT |

Không mở API PATCH/PUT thay check-in/check-out. Các API tạo/hủy/duyệt phiếu điều chỉnh hiện có giữ nguyên quyền riêng.

### Query daily/statistics/me/export

```http
GET /api/attendances/daily?date=2026-11-23&page=1&pageSize=20
GET /api/attendances/statistics?from=2026-11-23&to=2026-11-29&departmentId=4&status=LATE
```

- Dùng `date` hoặc `from/to`, không dùng đồng thời. Mặc định ngày hiện tại theo Asia/Ho_Chi_Minh. `me` không truyền ngày mặc định hôm qua–hôm nay. Ngày công là ngày bắt đầu ca, không phải ngày check-out.
- Từ1..31 ngày, trong1900..9998. Thêm departmentId, teamId, employeeId, search (tên/mã), status. ID dương; pageSize1..100, mặc định30. UI dùng20/trang.
- status nhận các trạng thái chính trong bảng bên dưới, hoặc `LATE`/`EARLY` để lọc vi phạm độc lập.
- `me` luôn dùng EmployeeId liên kết với tài khoản ACTIVE đang đăng nhập. employeeId gửi khác không đổi chủ dữ liệu. Chưa có liên kết trả403 HRM_AUTH_006. Không lấy số liệu toàn đơn vị cho màn cá nhân.
- Daily trả `{success,total,page,pageSize,asOfUtc,data}`. total đếm **dòng nhân viên/ngày/ca**, không phải số người; một người nhiều ca có nhiều dòng. Nhân viên chưa có lịch có một dòng/ngày.
- Statistics trả `{success,asOfUtc,from,to,employees,scheduled,checkedIn,working,late,early,notPunched,onLeave,absent,missingCheckOut}`. Các chỉ tiêu đếm **nhân viên phân biệt** trong toàn khoảng/bộ lọc, trước phân trang. Một người có thể xuất hiện đồng thời ở nhiều chỉ tiêu; không cộng các thẻ để suy tổng.

Ví dụ một dòng daily (minh họa, ID theo môi trường):

```json
{
  "employeeId": 12,
  "employeeCode": "NV000012",
  "employeeName": "Nguyễn Văn A",
  "departmentId": 4,
  "departmentName": "Engineering",
  "teamId": 5,
  "teamName": "Core",
  "workDate": "2026-11-23",
  "scheduleId": 100,
  "attendanceId": null,
  "shiftCode": "DAY",
  "timezone": "Asia/Ho_Chi_Minh",
  "shiftStartAtUtc": "2026-11-23T01:00:00Z",
  "shiftEndAtUtc": "2026-11-23T10:00:00Z",
  "checkInAtUtc": null,
  "checkOutAtUtc": null,
  "workedMinutes": null,
  "lateMinutes": 0,
  "earlyMinutes": 0,
  "isLate": false,
  "isEarly": false,
  "isOnLeave": false,
  "isHoliday": false,
  "isPeriodLocked": false,
  "snapshotMissing": false,
  "status": "NOT_CHECKED_IN"
}
```

Response còn có checkInOpenUtc/checkInCloseUtc/checkOutOpenUtc/checkOutCloseUtc, requireQr/requireGps/missingPunchRule để màn cá nhân biết cửa sổ và chứng cứ cần cung cấp. Server vẫn quyết định thời điểm/quyền/evidence thực tế khi punch, không tin giờ ở trình duyệt. RulesJson không được serialize trong danh sách.

### Trạng thái và chỉ tiêu

| Trạng thái | Quy tắc |
| --- | --- |
| NOT_CHECKED_IN | Có ca/snapshot hợp lệ, chưa có punch, cửa sổ check-out chưa đóng; kể cả chưa đến ca hoặc đã qua cửa sổ check-in |
| WORKING | Có check-in, chưa check-out, serverNow <= snapshot.CheckOutCloseUtc |
| COMPLETE | Đã có cả hai giờ thực tế |
| MISSING_CHECK_IN | Có check-out nhưng thiếu check-in |
| MISSING_CHECK_OUT | Có check-in, chưa check-out và serverNow > snapshot.CheckOutCloseUtc |
| ABSENT | Có ca hợp lệ, không có cả hai punch và serverNow > snapshot.CheckOutCloseUtc |
| ON_LEAVE | Có đơn APPROVED/CANCELLATION_PENDING bao phủ ngày, chưa có punch |
| DAY_OFF | Không có ca/phép, thứ không nằm trong workingDays |
| HOLIDAY | Không có ca/phép, ngày nằm trong holidayDates |
| NO_SCHEDULE | Ngày làm việc nhưng chưa phân ca/phép |
| LEGACY_UNVERIFIED | Ca thiếu/không khớp snapshot hoặc không xác định được cửa sổ, không suy vắng/thiếu check-out từ giờ ca hiện hành |

Đúng tại CheckOutCloseUtc vẫn trong cửa sổ, chỉ sau đó mới đánh dấu thiếu/vắng. Không dùng giờ17:00 cố định hoặc thời gian trình duyệt. Ca qua đêm dùng đầy đủ ngày/giờ UTC trong snapshot và WorkDate gốc. Có punch thực tế thì ưu tiên hiển thị trạng thái punch, đồng thời giữ cờ isOnLeave/isHoliday độc lập nếu có.

isLate và isEarly lấy riêng từ late_minutes/early_minutes đã tính lúc punch/duyệt điều chỉnh, không suy từ một trường Status. Một người vừa trễ vừa về sớm giữ cả hai. WorkedMinutes chỉ có khi đủ cặp giờ và snapshot: max(0, số phút check-out−check-in−snapshot.BreakMinutes), không dựng giờ công payroll khi còn đang làm.

### Nguồn và tối ưu truy vấn

Read model dùng SQL parameterized CTE ngày, `employees CROSS JOIN days LEFT JOIN work_schedules LEFT JOIN attendances`, join Department/Team/Shift và EXISTS Leave/TimesheetPeriod. Hủy lịch bị loại khỏi ca hoạt động. Nhân viên đã tới HireDate được đưa vào; nhân viên ngừng làm vẫn hiện nếu có lịch hoặc phép lịch sử trong ngày.

Scope, org/employee/search/status được áp trên SQL trước count, aggregate và paging. Statistics nhóm theo EmployeeId rồi tổng hợp các cờ độc lập, không tải toàn bộ công vào RAM. Lấy chi tiết không gây query cho từng dòng. Cùng builder dùng cho daily/statistics/me/export; export thay action scope bằng EXPORT. Query triển khai MySQL JSON/datetime và SQLite tương ứng để test, không nối dữ liệu người dùng thành SQL.

Các giờ/quy tắc của ca có lịch lấy từ RulesSnapshotJson; sửa Shift/Settings không thay đổi kết quả lịch sử. Nhân viên **không có lịch/snapshot** dùng workingDays/holidayDates hiện tại để phân biệt ngày nghỉ/lễ; hiện chưa có snapshot lịch sử cho ngày không phân ca. Tên, phòng ban, Team là hồ sơ hiện tại; không giả lập lịch sử điều chuyển chưa được lưu. Legacy có thể hiển thị mã ca hiện tại kèm snapshotMissing=true, nhưng không suy lại giờ/vi phạm từ ca hiện tại.

### Drawer và điều chỉnh

```http
GET /api/attendances/daily/detail?employeeId=12&date=2026-11-23&scheduleId=100
```

Bỏ scheduleId để xem dòng chưa có lịch của nhân viên/ngày. Response `{attendance,rules,adjustments}`; adjustments là20 phiếu gần nhất của đúng bản ghi công. Ngoài scope hoặc không có dòng trả404.

Không sửa giờ trực tiếp. Chỉ nhân viên chủ lịch có WEB_ATTENDANCE_ADJUSTMENTS / NEW mới thấy nút tạo phiếu; cần lịch và snapshot hợp lệ. Nếu Attendance chưa tồn tại, gửi scheduleId; nếu đã tồn tại, gửi attendanceId. Chỉ nhận đúng một trong hai field. Khi chưa có Attendance, transaction tạo bản ghi tham chiếu INCOMPLETE với cả hai giờ null để liên kết workflow, không tự tạo giờ thực tế. Sau duyệt cuối mới ghi giờ đề xuất; bị từ chối/hủy thì không phát sinh giờ. Form nhập cả cặp giờ đề xuất theo giờ Việt Nam (để trống một giờ nghĩa là đề xuất xóa giờ đó), bắt buộc lý do. POST `/api/attendance-adjustments` hiện có kiểm tra lại quyền/chủ bản ghi/snapshot; chỉ cập nhật sau duyệt cuối, lưu audit trước/sau.

Kỳ TimesheetPeriod có ClosedAt hoặc status khác OPEN/DRAFT bị khóa. Bổ sung guard server cho tạo phiếu và duyệt cuối, đồng thời chặn punch mới/close khi kỳ khóa. Idempotent replay punch đã ghi vẫn có thể trả kết quả cũ khi schedule còn mở; không tạo giờ mới. View/export không thay đổi dữ liệu hoặc tự tạo Attendance cho dòng ABSENT.

### My Attendance và punch

Màn cá nhân dùng `/me`, không lấy danh sách ALL rồi lọc ở client. Dùng nguyên POST `/attendances/check-in`, `/check-out` với WEB_MY_ATTENDANCE / UPDATE, không kiểm tra Scope; backend vẫn ràng buộc nhân viên đăng nhập. Trong cửa sổ server asOfUtc, nút hành động được bật khi thiếu punch tương ứng, có snapshot, không phải phép và kỳ không khóa.

Form cung cấp qrSessionId/qrToken khi snapshot yêu cầu QR; GPS lấy bằng geolocation khi snapshot yêu cầu. Client không gửi giờ punch hoặc employeeId. requestKey được giữ nguyên khi retry trong form để không ghi trùng sau lỗi mạng. Backend luôn kiểm tra lại thời gian/evidence; nút ở client không cấp quyền. Không có cơ chế bypass QR/GPS để chấm công.

### Excel

`GET /api/attendances/export` cùng bộ lọc, dùng Scope EXPORT. Xuất toàn bộ kết quả đã lọc, không giới hạn theo trang UI, tối đa10000 dòng; vượt giới hạn trả400 yêu cầu thu hẹp khoảng/bộ lọc. File `.xlsx` OpenXML ZIP thật, không đổi đuôi CSV. Giờ hiển thị theo Việt Nam, phút là ô số; chuỗi nhân viên dùng inline strings và escape XML, không trở thành công thức. Không gửi dữ liệu ngoài Scope VIEW/EXPORT tương ứng.

## Kiểm thử và triển khai

Automated tests gồm LEFT JOIN/no punch, tên/mã/org/ca, thống kê độc lập, boundary CheckOutCloseUtc, ca qua đêm và `/me`, ngày nghỉ/lễ/phép/legacy, lọc/phân trang, SELF/DEPARTMENT/ALL, Scope EXPORT khác VIEW, Excel hợp lệ/không formula injection, khóa kỳ ở thời điểm duyệt cuối và rollback dữ liệu. Frontend tests API thật, drawer/phiếu điều chỉnh, lỗi không giả counters, cá nhân, retry requestKey, cửa sổ punch và tải Excel.

Không có Migration mới, không apply Migration hoặc deploy Railway. API cũ và dữ liệu lịch sử giữ nguyên; các read endpoints mới không ghi DB.

### Điều chỉnh ca chưa có bản ghi công

```http
POST /api/attendance-adjustments
```

```json
{
  "scheduleId": 100,
  "proposedCheckIn": "2026-11-23T08:00:00+07:00",
  "proposedCheckOut": "2026-11-23T17:00:00+07:00",
  "reason": "Thiết bị chưa ghi nhận giờ công"
}
```

Ngày/giờ đề xuất phải hợp lệ và không ở tương lai tại lúc gửi; lịch phải thuộc người gửi. Nếu có punch thực tế sau lúc gửi phiếu, final approval kiểm tra lại snapshot/version và không ghi đè dữ liệu đã thay đổi. API cũ gửi attendanceId vẫn tương thích.

## Kết quả kiểm tra ngày19/11/2026

- Backend build thành công,0 warning/error.
- Bộ tests Attendance Management/Attendance Configuration/Submission/Leave Workflow/inventory:73/73 qua.
- Full backend suite:542 tests,533 qua,9 lỗi cũ trong EmployeeCreationTests do kỳ vọng NV nhưng source hiện dùng TX. Không sửa quy tắc mã nhân viên trong thay đổi này.
- Frontend70/70 tests qua; npm run build thành công. File Excel được kiểm tra ZIP/XML, kiểu số và không chứa công thức từ tên nhân viên.
- Tests dùng database SQLite riêng; không sửa dữ liệu MySQL thật. Không có Migration mới, không apply Migration hoặc deploy Railway.

GET `/api/attendances/me` chỉ cần `WEB_MY_ATTENDANCE / VIEW`, không đọc Data Scope và không yêu cầu WEB_ATTENDANCE / VIEW. Backend lấy EmployeeId từ tài khoản ACTIVE đăng nhập, có hồ sơ nhân viên tồn tại; không liên kết trả HRM_AUTH_006. employeeId trong query không thay được người xem. Quyền quản lý daily/statistics/detail/filters/export vẫn theo WEB_ATTENDANCE; check-in/check-out dùng WEB_MY_ATTENDANCE / UPDATE không Scope; WEB_MY_ATTENDANCE VIEW không cấp quyền ghi hoặc xem người khác. Frontend My Attendance hiển thị theo screen mới; drawer quản lý chỉ hiển thị khi có WEB_ATTENDANCE VIEW. Cần cấp screen mới active và VIEW qua API phân quyền hiện có, không tự chuyển grant hoặc sửa DB.

Check-in và check-out: POST `/api/attendances/check-in` và `/api/attendances/check-out` chỉ cần `WEB_MY_ATTENDANCE / UPDATE`, không đọc Data Scope, không cần WEB_ATTENDANCE NEW/UPDATE. Server bắt buộc user ACTIVE có nhân viên liên kết hợp lệ và ca thuộc đúng nhân viên đó; ca của người khác trả404. API punch không bắt buộc VIEW, nhưng màn My Attendance cần thêm VIEW để tải danh sách. Giữ cửa sổ snapshot, QR/GPS, kỳ công khóa, requestKey/idempotency, transaction và audit. Các API quản lý vẫn giữ Scope theo action.
