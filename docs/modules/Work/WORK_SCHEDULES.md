# Phân ca làm việc và phân ca hàng loạt

## Audit và phạm vi

- Tái sử dụng `shifts`, `work_schedules`, `attendances`, `leave_requests`, `timesheet_periods`, `system_settings`, `audit_logs` và pipeline Notification/Outbox hiện có.
- CRUD ca và lịch từng ngày đã có. Bổ sung lịch theo nhân viên, preview, bulk, copy và export; không tạo lại API CRUD hoặc bảng.
- `work_schedules.unique_work_key` đã có unique index; `version` concurrency token và `rules_snapshot_json` đã có. Không có thay đổi Entity/Fluent/schema hoặc Migration mới.
- TimesheetPeriod có `period_key` dạng `yyyy-MM`, không có khoảng ngày hoặc khóa theo Team. Kỳ có ClosedAt hoặc status khác OPEN/DRAFT được coi là khóa cho toàn tháng. Không suy ngược thời gian từ TimesheetDetail.
- Chưa có danh mục ngày lễ riêng. Bổ sung `holidayDates: ["2027-01-01"]` trong JSON Attendance Settings hiện có, chỉnh tại System Settings → Attendance Settings bằng quyền WEB_SYSTEM_SETTINGS. Không hardcode lịch lễ hoặc gọi dịch vụ bên ngoài.

## Giao diện

Attendance & Timekeeping → Ca & lịch làm việc → Lịch phân ca. Lịch tuần bắt đầu thứ Hai; chế độ tháng hiện đúng số ngày thực tế. Mỗi dòng là nhân viên, cột ngày, cột nhân viên cố định khi cuộn ngang. Màu ca được tính ổn định theo ID; mã ca lịch sử lấy từ snapshot.

Phòng ban, Team và mã/tên nhân viên lọc trên server; phân trang theo nhân viên (20/trang), kể cả nhân viên chưa có lịch. Metadata và danh sách nhân viên dùng Scope VIEW của WEB_WORK_SCHEDULES, không đòi thêm WEB_EMPLOYEES/WEB_SHIFTS. Chọn checkbox nhân viên để phân nhiều người, hoặc click ô trống để phân một ngày. Click ca để thay đổi; nút × hủy dùng DELETE và If-Match. Có skeleton, empty/error state và tải lại.

Form bulk hỗ trợ ALL, DEPARTMENT, TEAM, EMPLOYEE; chọn ca hoặc copy lịch, khoảng ngày, thứ trong tuần, loại trừ lễ và overwrite. Chỉ dòng READY được xác nhận; mọi dòng bị bỏ qua có lý do. Sửa bất kỳ tham số nào phải preview lại. Preview lỗi/stale không hiển thị kết quả thành công giả. Export tải CSV **trang nhân viên hiện tại**, cùng bộ lọc và khoảng ngày; lấy Scope EXPORT, không dùng Scope VIEW để cấp quyền export.

## API và quyền

Tất cả cần JWT. Kiểm tra quyền live và Data Scope theo action trên `WEB_WORK_SCHEDULES`.

| API | Quyền / Scope |
| --- | --- |
| GET /api/work-schedules/calendar | VIEW, SELF/DEPARTMENT/ALL |
| POST /api/work-schedules/bulk/preview | NEW, DEPARTMENT/ALL; nếu overwrite=true cần thêm UPDATE và Scope UPDATE bao phủ toàn bộ đối tượng |
| POST /api/work-schedules/bulk | Như preview, bắt buộc previewToken khớp |
| POST /api/work-schedules/copy | Như bulk, thêm VIEW/Scope VIEW trên nhân viên nguồn; bắt buộc copyFrom |
| GET /api/work-schedules/export | EXPORT, SELF/DEPARTMENT/ALL |
| POST /api/work-schedules | NEW, DEPARTMENT/ALL |
| PUT /api/work-schedules/{id} | UPDATE, DEPARTMENT/ALL, If-Match |
| PATCH /api/work-schedules/{id}/cancel | DELETE, DEPARTMENT/ALL, If-Match |

GET calendar/export: `from=2026-11-23&to=2026-11-29&page=1&pageSize=20`; thêm departmentId, teamId, employeeId, search. Calendar trả `{success,total,page,pageSize,employees,schedules,shifts,departments,teams,holidayDates}`. total là tổng nhân viên trong bộ lọc, schedules chỉ của nhân viên thuộc trang đó. pageSize tối đa100. Calendar/export từ1 đến92 ngày.

Bulk preview ví dụ:

```http
POST /api/work-schedules/bulk/preview
```

```json
{
  "operationId": "2e4caf9b-f89e-4ed2-926b-3efec8870468",
  "target": "EMPLOYEE",
  "employeeIds": [12, 15],
  "shiftId": 3,
  "from": "2026-11-23",
  "to": "2026-11-29",
  "weekdays": [1, 2, 3, 4, 5],
  "excludeHolidays": true,
  "overwrite": false
}
```

- IDs phải là dữ liệu thực tế trong Scope; không dùng cứng ID ví dụ. Ngày trước hiện tại không được ghi lịch mới.
- Target EMPLOYEE dùng employeeIds không trùng; DEPARTMENT cần departmentId; TEAM cần teamId; ALL là tất cả **trong Scope NEW**, không mặc định toàn hệ thống. Với target EMPLOYEE, bất kỳ ID ngoài Scope đều trả404, không trả thông tin nhân viên bị cấm.
- Tối đa500 nhân viên và5000 employee-days trong một đợt; khoảng ngày tối đa92. Chia đợt nếu vượt giới hạn. Weekdays là ISO 1=thứ Hai..7=Chủ nhật, không trùng. Các ngày không được bật trong Attendance Settings vẫn không thể phân.
- Response preview: `{previewToken,ready,skipped,items}`; mỗi item có employeeId/employeeCode/employeeName/workDate/shiftId/outcome/scheduleId/version/rules. Không ghi DB hoặc gửi thông báo khi preview.
- Xác nhận POST `/bulk` với cùng payload và thêm `previewToken` từ preview. Response `{operationId,created,updated,skipped,items}`. Kết quả chỉ ghi các item READY, các item khác giữ nguyên.
- Retry lỗi mạng phải giữ nguyên operationId và payload. Cùng operationId nhưng khác payload hoặc actor trả409. Không tạo operationId mới để retry cùng đợt.
- Preview token bị ràng buộc vào actor, payload, nhân viên, settings version, shift version và kết quả/phiên bản lịch. Trạng thái thay đổi trả409, phải preview lại. Confirm luôn chạy lại đầy đủ kiểm tra trong transaction, không tin kết quả ở client.

Copy: dùng payload trên, bỏ shiftId và thêm `"copyFrom":"2026-11-16"`. Preview vẫn gọi `/bulk/preview`, xác nhận gọi `/copy`. Khoảng nguồn có cùng độ dài với khoảng đích. Map lịch từng nhân viên theo offset ngày; mỗi ô nguồn phải có đúng một lịch chưa hủy. Thiếu/nhiều ca nguồn hoặc ca đã ngừng hoạt động bị bỏ qua. Copy không chỉnh nguồn, tạo snapshot mới từ ca/cấu hình hiện hành ở ngày đích. Chọn các ngày đích trong tương lai; không copy nguyên kết quả Attendance.

## Ràng buộc nghiệp vụ

Kiểm tra ACTIVE, HireDate, ca active, ngày/thứ hợp lệ, giờ ca chưa bắt đầu, phép APPROVED/CANCELLATION_PENDING, lịch trùng và ca qua đêm chồng ngày kế tiếp. Không overwrite nếu có Attendance, status khác SCHEDULED, snapshot cũ không xác nhận, lịch đã bắt đầu hoặc tháng công khóa. Mặc định không overwrite lịch tồn tại. Bulk dùng một ca/ngày; ô có nhiều lịch hiện hữu được bỏ qua để tránh âm thầm xóa một ca.

Các lý do preview: READY, INACTIVE, BEFORE_HIRE, PAST_DATE, HOLIDAY, NON_WORKING_DAY, PERIOD_LOCKED, APPROVED_LEAVE, SOURCE_MISSING_OR_MULTIPLE, SHIFT_INACTIVE, MULTIPLE_SCHEDULES, ATTENDANCE_OR_CLOSED, EXISTS, STARTED_OR_LEGACY, STARTED, OVERLAP, OVERLAP_OR_LEGACY. Không ghi đè hoặc xóa lịch sử để khắc phục xung đột.

Luồng phân ca đơn cũng bổ sung kiểm tra HireDate, phép đã duyệt, chồng ca và kỳ công khóa. Kỳ gốc của lịch được chuyển ngày/nhân viên cũng không được khóa. Hủy lịch khóa bị chặn. Lịch đã hủy không bị xóa vật lý; bulk có thể dùng lại đúng record nếu chưa có nghiệp vụ và không xung đột key lịch khác.

## Transaction, snapshot và thông báo

Dùng transaction Serializable, khóa catalog cho bulk và employee locks theo ID; xác nhận khóa trước khi kiểm tra lại. Unique key hiện có chống duplicate, Version bảo vệ cập nhật. Deadlock/lock timeout/duplicate MySQL trả409 để retry. Receipt lưu AuditLog EntityType=ScheduleBatch, EntityID=operationId dạng N; kiểm tra actor, request hash và phạm vi nhân viên hiện hành trước khi replay; giảm Scope sau khi phân ca không cho đọc receipt chứa nhân viên ngoài phạm vi mới. Không có bảng receipt mới.

Mỗi lịch lưu snapshot giờ UTC, timezone, mã ca, break/grace, cửa sổ punch, QR/GPS/location và settings version. Sửa Shift hoặc Settings không viết lại snapshot cũ. Audit từng thay đổi và receipt nằm trong cùng transaction với lịch.

NotificationService.CreateInternalAsync dùng source SYSTEM và referenceType WORK_SCHEDULE; event key ổn định theo operationId/employee. Mỗi nhân viên nhận một notification cho cả đợt, không nhận một notification mỗi ngày. Nhân viên chưa có user ACTIVE vẫn được phân lịch, chỉ bỏ qua thông báo. Single create/update/cancel cũng gửi thông báo; thay nhân viên thông báo cho cả người cũ/mới. Outbox và Audit commit/rollback cùng lịch. Retry không phát sinh thông báo trùng.

## Kiểm thử và triển khai

Tests gồm phân hàng loạt, snapshot, notification gom, retry/idempotency, ngày lễ, tuyển dụng, phép đã duyệt, khóa kỳ, lịch có Attendance, stale preview, copy, Scope theo action, ca qua đêm, export, request đồng thời và rollback khi lỗi DB. Frontend tests lịch tuần/tháng, lọc/phân trang, preview/confirm/copy, lỗi và quyền.

Không có Migration mới. Không apply migration, không deploy Railway, không sửa dữ liệu thật. Cần schema các module đã được triển khai trước đó, bao gồm Notification/Outbox và version/snapshot lịch. Các ngày/ID trong Postman phải cập nhật theo môi trường trước khi chạy.

### Kết quả kiểm tra ngày19/11/2026

- Backend build: thành công,0 warning/error.
- Tests phân ca + Attendance Configuration + inventory:19/19 qua, gồm request đồng thời, rollback và receipt khi giảm Scope.
- Full backend suite:508 tests,499 qua,9 lỗi cũ trong EmployeeCreationTests (kỳ vọng prefix NV, source hiện dùng TX); các tests khác qua.
- Frontend:61/61 tests qua; npm run build thành công.
- Không có Migration mới, không apply migration, không deploy Railway hoặc thay đổi dữ liệu thật.

## Tổ chức source sau khi tách Work

API, DTO, WorkScheduleService, Entity/Configuration ca và lịch nằm trong Modules/Work. Namespace EF legacy của Shift/WorkSchedule được giữ để không đổi model/schema. AttendanceOperationsService, AttendanceRules và API chấm công/QR thuộc Modules/Attendance. System chỉ giữ settings/password policy và audit dùng chung. Frontend WorkWorkspace/WorkScheduleCalendar nằm tại web-admin/src/work. URL, screen code, scope, snapshot, idempotency và số route giữ nguyên.

Build Backend/Frontend thành công; bộ kiểm thử liên quan tách module61/61 qua và frontend61/61 qua. Không có Migration mới, không apply Migration hoặc deploy.

## Tự động phân lịch đầu tuần

Job thuộc `Modules/Work`: WorkScheduleWorker và RunAutomaticSchedules (internal, không mở API bỏ qua RBAC). Từ 00:00 Chủ nhật theo **Asia/Ho_Chi_Minh**, cửa sổ đích là thứ Hai–Chủ nhật ngay sau đó. Worker kiểm tra khi khởi động và mỗi300 giây (mặc định), đồng thời rút ngắn thời gian chờ khi sắp đến00:00 Chủ nhật để đánh thức ở mốc tuần mới. Việc xử lý còn phụ thuộc API đang chạy và độ trễ hệ thống. Nếu server khởi động muộn từ thứ Hai–thứ Bảy, chỉ điền các ngày/ca chưa bắt đầu trong tuần hiện tại, không backfill những tuần đã qua.

Ví dụ: Chủ nhật22/11/2026, job tạo lịch23–29/11/2026. Với từng nhân viên, tìm tuần thứ Hai–Chủ nhật gần nhất trước tuần đích có lịch SCHEDULED/CLOSED, rồi map đúng thứ sang tuần đích. Mỗi nhân viên có thể dùng tuần nguồn khác nhau. Không có lịch nguồn thì bỏ qua, không tự đoán ca hoặc áp ca của người khác. Ô nguồn nhiều ca, ca đã inactive hoặc cấu hình ca không hợp lệ không được tự ghi đè lịch sử. Snapshot mới dùng cấu hình ca/quy tắc hiện hành, không sửa nguồn.

Điều kiện nhân viên/hợp đồng:

- Nhân viên ACTIVE, đã tới HireDate.
- Có ít nhất một hợp đồng status ACTIVE, StartDate đã bắt đầu và EndDate chưa qua hoặc null ở ngày chạy; không dùng DRAFT/CANCELLED/TERMINATED/EXPIRED để phân tự động.
- Từng ca đích phải được một hợp đồng ACTIVE bao phủ từ ngày bắt đầu đến ngày kết thúc ca, gồm ca qua đêm. Hết hợp đồng giữa tuần thì chỉ phân các ngày còn hiệu lực; không dùng thời gian trống giữa hợp đồng để phân ca.
- Chỉ điền ô hoàn toàn chưa có WorkSchedule. Lịch đã tạo thủ công hoặc đã CANCELLED đều giữ nguyên, không tự khôi phục lịch đã hủy. Giữ kiểm tra ngày làm việc, ngày lễ, phép đã duyệt, trùng ca, Attendance, snapshot và kỳ công khóa.

Cấu hình dùng API System hiện có:

```http
GET /api/system-settings/attendance
PUT /api/system-settings/attendance
If-Match: "version-tu-GET"
```

Gửi **toàn bộ cấu hình Attendance** cùng `"autoScheduleEnabled":true` để bật, false để tắt. Khi field chưa tồn tại, mặc định true theo yêu cầu tự phân lịch. Giao diện: System Settings → Attendance Settings → Tự động phân lịch hàng tuần. GET cần WEB_SYSTEM_SETTINGS VIEW, PUT cần UPDATE; không Scope. Không có API chạy job nội bộ bằng quyền nhân viên.

Tắt toàn bộ hosted worker bằng biến môi trường `WorkScheduleAutomation__WorkerEnabled=false`. `WorkScheduleAutomation__PollSeconds` nhận30..3600, mặc định300. Không cần cron/job Railway ngoài ứng dụng. Backend phải đang chạy để thực thi; server khởi động lại sẽ tiếp tục kiểm tra kỳ hiện tại.

Mỗi transaction tối đa100 nhân viên, khóa settings/employee và dùng unique key hiện có. Receipt theo nhân viên/tuần ở AuditLog: EntityType=ScheduleAutomation, EntityID=`weekly:yyyyMMdd:employeeId` (yyyyMMdd là thứ Hai), Action=SCHEDULE_AUTO_COMPLETED, actor=null. Chỉ ghi hoàn tất khi đã tạo ít nhất một lịch. Không tạo được ngày nào thì không đánh dấu để có thể thử lại sau khi cấu hình/hợp đồng/lịch nguồn được sửa. Khi đã ghi receipt, thay đổi hợp đồng/quy tắc trong tuần không tự chạy lại kỳ đó; dùng phân ca thủ công có kiểm soát nếu cần bổ sung.

Lịch, audit và notification/outbox commit cùng transaction. Lỗi giữa đợt rollback cả đợt; đợt đã commit không bị chạy lại. Nhiều replica không tạo trùng receipt/lịch/thông báo. Gom một notification cho mỗi nhân viên/tuần. Log `Weekly scheduling evaluated` chứa weekFrom/status/created/employees/skipped; lỗi được retry lần kiểm tra sau. Không có bảng hoặc Migration mới, không apply Migration hoặc deploy tự động.

Không tự xóa lịch đã phân khi hợp đồng thay đổi sau đó; lịch hiện có cần được xử lý bằng nghiệp vụ phân/hủy lịch với quyền tương ứng. Kiểm thử cuối: backend build thành công; full suite527 tests có518 qua,9 lỗi cũ prefix NV/TX; frontend62/62 qua và build thành công.
