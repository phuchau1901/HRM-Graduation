# Leave / Overtime / Approval API Specification

Tất cả route dưới `/api`, bearer authentication, ScreenPermission và BusinessExceptionFilter chung. List trả `{success:true,total,page,pageSize,data:[...]}`; detail/mutation trả DTO trực tiếp theo quy ước hiện tại. Lỗi400 validation,401 thiếu token,403 quyền/scope,404 không có hoặc ngoài phạm vi,409 trạng thái/version/trùng lịch/số dư/config/concurrency.

## Routes

| Method | Route | Screen/action |
| --- | --- | --- |
| GET | /leave-types | WEB_LEAVE_TYPES / VIEW |
| POST | /leave-types | WEB_LEAVE_TYPES / NEW |
| PUT | /leave-types/{id:long} | WEB_LEAVE_TYPES / UPDATE |
| GET | /leave-balances | WEB_LEAVE_BALANCES / VIEW + scope |
| PUT | /leave-balances | WEB_LEAVE_BALANCES / UPDATE + scope DEPARTMENT/ALL |
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
{"employeeId":12,"leaveTypeId":1,"year":2027,"entitledDays":12,"version":0}
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

Approval detail: `{request:{id,requestType,referenceId,employeeId,employeeName,requestedByUserId,status,createdAt,version,currentStepNo},steps:[{id,stepNo,approverUserId,decision,comment,decidedAt}],details:{...request data...}}`.
History: list `{id,actorUserId,action,beforeJson,afterJson,createdAt}` từ AuditLog. Adjustment trước/sau được ghi với action ATTENDANCE_ADJUSTED.
Balance DTO: `{id,employeeId,employeeName,leaveTypeId,leaveTypeName,year,entitledDays,usedDays,reservedDays,availableDays,version}`.

PUT approval-workflow-settings (GET lấy version hiện tại; danh sách routes thay toàn bộ cấu hình):
```json
{
  "version":0,
  "routes":[
    {"requestType":"LEAVE","allowSelfApproval":false,"steps":[
      {"approverType":"TEAM_LEAD"},
      {"approverType":"DEPARTMENT_MANAGER"},
      {"approverType":"HR","userId":"configured-hr-user","roleCode":"HR"}
    ]},
    {"requestType":"OVERTIME","allowSelfApproval":false,"steps":[
      {"approverType":"HR","userId":"configured-hr-user","roleCode":"HR"}
    ]},
    {"requestType":"ATTENDANCE_ADJUSTMENT","allowSelfApproval":false,"steps":[
      {"approverType":"HR","userId":"configured-hr-user","roleCode":"HR"}
    ]}
  ]
}
```
GET/PUT settings trả `{version,routes}`. Tối đa4 route khác loại, mỗi route1–10 bước. Thêm LEAVE_CANCELLATION để override quy trình hủy. Nhân viên không có Team có thể dùng luồng chỉ DEPARTMENT_MANAGER/HR; thiếu approver cấu hình báo400, không tự bỏ bước. Người vận hành đăng ký Screen/grants/scopes qua Administration API trước; xem [quy tắc và migration](README.md).
