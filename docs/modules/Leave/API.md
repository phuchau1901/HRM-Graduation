# Leave / Overtime / Approval API Specification

Tất cả route dưới `/api`, bearer authentication, ScreenPermission và BusinessExceptionFilter chung. List trả `{success:true,total,page,pageSize,data:[...]}`; detail/mutation trả DTO trực tiếp theo quy ước hiện tại. Lỗi400 validation,401 thiếu token,403 quyền/scope,404 không có hoặc ngoài phạm vi,409 trạng thái/version/trùng lịch/số dư/config/concurrency.

## Routes

| Method | Route | Screen/action |
| --- | --- | --- |
| GET | /leave-types | VIEW trên một trong WEB_LEAVE_TYPES, WEB_LEAVE_REQUESTS, WEB_OVERTIME_REQUESTS, WEB_ATTENDANCE_ADJUSTMENTS |
| POST | /leave-types | WEB_LEAVE_TYPES / NEW |
| PUT | /leave-types/{id:long} | WEB_LEAVE_TYPES / UPDATE |
| GET | /leave-balances/me | WEB_LEAVE_BALANCES / VIEW + own linked Employee |
| GET | /system-settings/leave-accrual | WEB_SYSTEM_SETTINGS / VIEW |
| PUT | /system-settings/leave-accrual | WEB_SYSTEM_SETTINGS / UPDATE (không áp dụng Data Scope) |
| POST | /system-settings/leave-accrual/run | WEB_SYSTEM_SETTINGS / UPDATE (không áp dụng Data Scope) |
| GET | /leave-balances | WEB_LEAVE_MANAGEMENT / VIEW + scope |
| PUT | /leave-balances | WEB_LEAVE_MANAGEMENT / UPDATE + scope DEPARTMENT/ALL |
| POST | /leave-balances/grants | WEB_LEAVE_MANAGEMENT / UPDATE + DEPARTMENT/ALL |
| POST | /leave-balances/{id:long}/adjustments | WEB_LEAVE_MANAGEMENT / UPDATE + DEPARTMENT/ALL |
| GET | /leave-balances/{id:long}/history | WEB_LEAVE_MANAGEMENT / VIEW + scope |
| GET | /leave-requests | WEB_LEAVE_REQUESTS / VIEW + scope |
| GET | /leave-requests/{id:long} | WEB_LEAVE_REQUESTS / VIEW + scope |
| POST | /leave-requests | WEB_LEAVE_REQUESTS / NEW + own employee |
| POST | /leave-requests/{id:long}/cancel | WEB_LEAVE_REQUESTS / UPDATE + own request |
| GET | /overtime-requests | WEB_OVERTIME_REQUESTS / VIEW + scope |
| GET | /overtime-requests/{id:long} | WEB_OVERTIME_REQUESTS / VIEW + scope |
| POST | /overtime-requests | WEB_OVERTIME_REQUESTS / NEW + own employee |
| POST | /overtime-requests/{id:long}/cancel | WEB_OVERTIME_REQUESTS / UPDATE + own request |
| GET | /attendance-adjustments | WEB_ATTENDANCE_ADJUSTMENTS / VIEW + scope |
| POST | /attendance-adjustments | WEB_ATTENDANCE_ADJUSTMENTS / NEW + own employee |
| POST | /attendance-adjustments/{id:long}/cancel | WEB_ATTENDANCE_ADJUSTMENTS / UPDATE + own request |
| GET | /approvals | WEB_APPROVALS / VIEW + scope |
| GET | /approvals/{id:long} | WEB_APPROVALS / VIEW + scope |
| POST | /approvals/{id:long}/approve | WEB_APPROVALS / APPROVE + scope + assigned current step |
| POST | /approvals/{id:long}/reject | WEB_APPROVALS / APPROVE + scope + assigned current step |
| GET | /approvals/{id:long}/history | WEB_APPROVALS / VIEW + scope |
| GET | /approval-workflow-settings | WEB_APPROVAL_SETTINGS / VIEW |
| PUT | /approval-workflow-settings | WEB_APPROVAL_SETTINGS / UPDATE |

List query: `page=1&pageSize=20` (max100), `view=MY|TEAM|ALL` (defaultALL), optional `employeeId`, `status`. Balances: `year`. Leave: `year` matches overlapping calendar years. Approvals: `requestType`. Leave types: `search` code/name. History is paginated in ID order. No employee details/names/counts outside action scope. TEAM additionally restricts current department, cannot use SELF.

## Payloads

POST leave-types / PUT leave-types/{id}:
```json
{"code":"ANNUAL","name":"Phép năm","paid":true,"requiresBalance":true,"isActive":true}
```
PUT balances (version0 to create, GET current version to update; server manages used/reserved):
```json
{"employeeId":12,"leaveTypeId":1,"year":2027,"entitledDays":12,"carriedOverDays":2,"version":0,"reason":"Cấp phép năm"}
```
POST leave-requests:
```json
{"leaveTypeId":1,"fromDate":"2027-01-04","toDate":"2027-01-05","reason":"Việc gia đình"}
```
POST overtime-requests (offset required by client contract; stored UTC):
```json
{"startAt":"2027-01-04T18:00:00+07:00","endAt":"2027-01-04T20:00:00+07:00","reason":"Hoàn tất công việc"}
```
POST attendance-adjustments:
```json
{"attendanceId":10,"proposedCheckIn":"2026-11-16T08:00:00+07:00","proposedCheckOut":"2026-11-16T17:00:00+07:00","reason":"Quên chấm công"}
```
Tạo đơn trả201: `{id,approvalId,status:"PENDING",version:1}`. Cancel dùng **version của đơn** từ list/detail. Approve/reject dùng **request.version của approval detail**, không dùng version của đơn:
```json
{"version":1,"reason":"Đã kiểm tra"}
```
Cancel trả WorkflowReceipt `{id,approvalId,status,version}`. Duyệt trả ApprovalReceipt `{id,status,version}`. Hủy phép đã duyệt trả approvalId mới của luồng hủy và status CANCELLATION_PENDING.

Approval detail: `{request:{id,requestType,referenceId,employeeId,employeeName,requestedByUserId,status,createdAt,version,currentStepNo},steps:[{id,stepNo,approverUserId,approverEmployeeId,decision,comment,decidedAt}],details:{...request data...}}`.
History: list `{id,actorUserId,action,beforeJson,afterJson,createdAt}` từ AuditLog. Adjustment trước/sau được ghi với action ATTENDANCE_ADJUSTED.
Balance DTO: `{id,employeeId,employeeName,leaveTypeId,leaveTypeName,year,entitledDays,usedDays,reservedDays,carriedOverDays,adjustmentDays,remainingDays,availableDays,version}`.

PUT approval-workflow-settings (GET lấy version hiện tại; danh sách routes thay toàn bộ cấu hình):
```json
{
  "version":0,
  "routes":[
    {"requestType":"LEAVE","allowSelfApproval":false,"steps":[
      {"approverType":"TEAM_LEAD"},
      {"approverType":"DEPARTMENT_MANAGER"},
      {"approverType":"USER","employeeId":12}
    ]},
    {"requestType":"OVERTIME","allowSelfApproval":false,"steps":[
      {"approverType":"USER","employeeId":12}
    ]},
    {"requestType":"ATTENDANCE_ADJUSTMENT","allowSelfApproval":false,"steps":[
      {"approverType":"USER","employeeId":12}
    ]}
  ]
}
```
GET/PUT settings trả `{version,routes}`. Tối đa100 route khác loại đã đăng ký, mỗi route1–10 bước. Thêm LEAVE_CANCELLATION để override quy trình hủy. Nhân viên không có Team có thể dùng luồng chỉ DEPARTMENT_MANAGER/USER; thiếu approver cấu hình báo400, không tự bỏ bước. Người vận hành đăng ký Screen/grants/scopes qua Administration API trước; xem [quy tắc và migration](README.md).

Xem [hướng dẫn cấu hình và quyền](WORKFLOW_SETTINGS.md) cùng [payload JSON đầy đủ](../../API/approval-workflow-settings.sample.json). Employee12 là ví dụ; cần thay bằng nhân viên thực tế có tài khoản liên kết.

## Bước duyệt USER theo EmployeeId

Chọn nhân viên duyệt, backend tự tìm tài khoản User đang ACTIVE liên kết qua users.employee_id; không yêu cầu role HR:
```json
{
  "version": 0,
  "routes": [
    {"requestType":"LEAVE","allowSelfApproval":false,"steps":[
      {"approverType":"USER","employeeId":12}
    ]}
  ]
}
```
Dùng version từ GET khi cập nhật. USER bắt buộc employeeId của nhân viên ACTIVE có User ACTIVE; userId trong payload USER không được dùng để chọn tài khoản và được chuẩn hóa về null khi lưu, roleCode không áp dụng. HR cũ vẫn dùng userId+roleCode. TEAM_LEAD/DEPARTMENT_MANAGER không nhận nhân viên chọn trực tiếp mà lấy quản lý Team/phòng ban của người gửi.

Khi gửi đơn, backend kiểm tra quyền/scope và chốt ApproverUserID cùng ApproverEmployeeId vào từng bước. Khi approve/reject, ngoài đúng UserID được giao, đúng thứ tự/version và APPROVE scope, phải còn liên kết users.employee_id đúng ApproverEmployeeId đã chốt; đổi/gỡ liên kết trả403, không thay đổi bước/số dư. Approval detail steps trả thêm approverEmployeeId. Chỉnh settings không đổi các bước của đơn đã gửi.

Migration `20261117043059_SnapshotApprovalEmployee` thêm cột nullable approver_employee_id + index/FK trên approval_steps; không tạo lại bảng và không backfill dữ liệu cũ. Chưa apply. Cấu hình USER cũ chỉ có userId cần sửa sang employeeId trước khi gửi đơn mới. Bước cũ có approver_employee_id=null vẫn dùng UserID đã giao, vì không có snapshot lịch sử để xác minh lại nhân viên; không tự đoán/backfill. Bước HR có tài khoản không liên kết nhân viên vẫn hỗ trợ theo chính sách HR cũ.

## Quản lý số dư phép mở rộng

Xem [Leave Balance Management](BALANCES_API.md) để biết công thức còn lại/khả dụng, bộ lọc, cấp hàng loạt idempotent, điều chỉnh có lý do, lịch sử và migration. PUT số dư đã có bắt buộc reason.

## Số dư của tôi và lịch cộng/reset phép hệ thống

[Đặc tả /me và System Settings](ACCRUAL_SETTINGS.md): lấy tổng phép/đã dùng/còn lại, cấu hình suất theo chức vụ, lịch cấp và thu hồi độc lập theo số tháng/năm từ ngày bắt đầu; mặc định loại ANNUAL. Chính sách disabled mặc định; không bật hoặc chạy trên DB thật trong đợt triển khai.

## Approvals là module cha

Các endpoint /approvals và /approval-workflow-settings chuyển controller/service sang [module Approvals](../Approvals/API.md), giữ nguyên URL/quyền/JSON. GET /approvals thêm query module=LEAVE để lọc nghỉ phép/hủy phép; không ảnh hưởng scope. UI chuẩn Approvals → Leave.

Cấp phép tự động version2: `settings.defaultDaysPerCycle` mặc định1 ngày/chu kỳ; `rules: []` hợp lệ. Không khớp chức vụ dùng mức mặc định ANNUAL, khớp thì dùng mức riêng và không cộng cả hai. Chi tiết: [ACCRUAL_SETTINGS.md](ACCRUAL_SETTINGS.md).

GET `/api/leave-balances` includes `employeeCode` (employees.EmployeeCode) in each data item alongside employeeId/employeeName. The field uses the existing scoped employee join, with no additional query. `/me` balance items and single-balance update responses use the same DTO.

GET `/api/leave-types` chấp nhận VIEW trên bất kỳ một màn hình: WEB_LEAVE_TYPES, WEB_LEAVE_REQUESTS, WEB_OVERTIME_REQUESTS, WEB_ATTENDANCE_ADJUSTMENTS. Không yêu cầu đồng thời và không áp Data Scope cho danh mục loại phép. NEW đơn thuần không thay thế VIEW. POST/PUT loại phép vẫn cần WEB_LEAVE_TYPES / NEW hoặc UPDATE tương ứng; quyền đọc danh mục không cấp quyền ghi.

POST `/api/leave-requests`: cần `WEB_LEAVE_REQUESTS / NEW`, không yêu cầu cấu hình Data Scope cho action NEW. Backend lấy nhân viên từ user đăng nhập; user và nhân viên phải ACTIVE, có liên kết hợp lệ. Không nhận employeeId để tạo thay người khác. Vẫn kiểm tra quyền NEW hiện hành, trùng lịch, số dư phép và quy trình duyệt. Quyền/scope của GET, hủy đơn và các loại phiếu khác giữ nguyên.

### Thời điểm kiểm tra quyền người duyệt

Khi gửi phiếu, hệ thống xác định người duyệt theo workflow và tạo các bước PENDING; không kiểm tra WEB_APPROVALS VIEW/APPROVE hoặc Data Scope của người duyệt ở bước gửi. Người nhận phải tồn tại, hoạt động, không trùng bước và tuân thủ chính sách tự duyệt. Người gửi nghỉ phép chỉ cần WEB_LEAVE_REQUESTS / NEW và nhân viên liên kết ACTIVE, không cần Scope NEW.

Quyền và Scope của người duyệt được kiểm tra khi xem/duyệt/từ chối. Chỉ người được giao ở bước hiện tại có WEB_APPROVALS / APPROVE và Scope phù hợp mới được quyết định. Chưa được cấp quyền duyệt không làm người gửi bị chặn tạo phiếu; người duyệt cần được cấu hình quyền trước khi xử lý.

POST `/api/overtime-requests`: chỉ cần `WEB_OVERTIME_REQUESTS / NEW`, không kiểm tra Data Scope NEW. Backend dùng nhân viên liên kết ACTIVE của user đăng nhập ACTIVE; employeeId gửi kèm không cho tạo thay. Thiếu quyền NEW trả403 HRM_AUTH_003; thiếu liên kết hoặc nhân viên không ACTIVE trả403 HRM_AUTH_006. Giữ kiểm tra thời gian, trùng lịch và khởi tạo workflow. GET, chi tiết, hủy và duyệt vẫn kiểm tra quyền/Scope như hiện tại.
