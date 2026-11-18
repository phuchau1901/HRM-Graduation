# Cấu hình quy trình phê duyệt

[Approvals API](API.md) · [Module Approvals](README.md) · [Payload mẫu](../../API/approval-workflow-settings.sample.json)

## API và quyền

| API | Quyền |
| --- | --- |
| GET /api/approval-workflow-settings | WEB_APPROVAL_SETTINGS / VIEW |
| PUT /api/approval-workflow-settings | WEB_APPROVAL_SETTINGS / UPDATE |

Đây là cấu hình chung lưu trong `system_settings`, key `APPROVAL_WORKFLOWS`, không áp scope SELF/DEPARTMENT/ALL. Người cấu hình không bắt buộc có hồ sơ Employee hoặc quyền duyệt. Trên giao diện Approvals → Cấu hình luồng duyệt, cấp VIEW để xem và thêm UPDATE để chỉnh sửa.

API cấp các quyền trên cho role là PUT `/api/roles/{id}/permissions`, yêu cầu người quản trị có WEB_PERMISSIONS UPDATE + APPROVE. Người quản trị không cần tự có WEB_APPROVAL_SETTINGS; vẫn cần If-Match và screen active. Không dùng quyền cấu hình để duyệt đơn.

## Chọn người duyệt

| approverType | Field cấu hình | Xác định người duyệt khi gửi đơn |
| --- | --- | --- |
| TEAM_LEAD | Không nhập employeeId/userId | Employee gửi đơn → TeamId → teams.LeadEmployeeId → User liên kết |
| DEPARTMENT_MANAGER | Không nhập employeeId/userId | Employee gửi đơn → DepartmentId → departments.ManagerEmployeeId → User liên kết |
| USER | employeeId, số nguyên dương | Nhân viên được chọn → users.employee_id → User ACTIVE |
| HR, tương thích cũ | userId + roleCode | User ACTIVE cụ thể thuộc roleCode đã chọn |

USER chọn **nhân viên**, không nhập tài khoản User. Ví dụ `{"approverType":"USER","employeeId":12}`. Nhân viên phải ACTIVE và có tài khoản ACTIVE liên kết; role HR không bắt buộc. Với USER, userId gửi kèm không được dùng để chọn tài khoản và được chuẩn hóa về null khi lưu.

Các bước Team Lead/Trưởng phòng tự lấy người quản lý từ bảng Team/Department của người gửi, không bắt người cấu hình chọn lại quản lý. Team phải active và thuộc phòng ban tương ứng; phòng ban phải active. Thiếu quản lý/tài khoản hợp lệ báo lỗi lúc gửi đơn, không bỏ bước. Quyền và Scope của người duyệt được kiểm tra khi họ xem hoặc quyết định phiếu, không chặn người gửi tạo phiếu. Nhân viên không có Team cần một luồng không có TEAM_LEAD, ví dụ DEPARTMENT_MANAGER → USER. Hiện cấu hình theo loại yêu cầu toàn hệ thống, chưa có nhánh điều kiện theo từng Team/phòng ban.

## Ví dụ tạo hoặc sửa luồng

GET trước để lấy version. Chưa có cấu hình trả `{"version":0,"routes":[]}`. PUT gửi version vừa đọc cùng **toàn bộ** routes cần giữ; đây không phải patch một route. Chỉ dùng version0 khi chưa có cấu hình; version lệch trả409.

```json
{
  "version": 0,
  "routes": [
    {
      "requestType": "LEAVE",
      "allowSelfApproval": false,
      "steps": [
        { "approverType": "TEAM_LEAD" },
        { "approverType": "DEPARTMENT_MANAGER" },
        { "approverType": "USER", "employeeId": 12 }
      ]
    },
    {
      "requestType": "OVERTIME",
      "allowSelfApproval": false,
      "steps": [
        { "approverType": "DEPARTMENT_MANAGER" },
        { "approverType": "USER", "employeeId": 12 }
      ]
    },
    {
      "requestType": "ATTENDANCE_ADJUSTMENT",
      "allowSelfApproval": false,
      "steps": [{ "approverType": "USER", "employeeId": 12 }]
    }
  ]
}
```

Employee12 chỉ là ví dụ; thay bằng ID nhân viên duyệt thực tế. Tối đa100 route khác requestType đã đăng ký trong engine, mỗi route1–10 bước. Thứ tự mảng steps là thứ tự duyệt. Các loại hiện có: LEAVE, OVERTIME, ATTENDANCE_ADJUSTMENT, LEAVE_CANCELLATION; module mới đăng ký handler để bổ sung loại. Nếu không khai báo LEAVE_CANCELLATION, yêu cầu hủy phép đã duyệt dùng luồng LEAVE.

## Kiểm tra khi gửi đơn và khi duyệt

Khi lưu cấu hình, backend kiểm tra định dạng/route trùng/version và nhân viên-tài khoản USER hợp lệ. Khi gửi đơn, backend chỉ xác định toàn bộ người duyệt hợp lệ và tạo bước PENDING, không yêu cầu họ đã có WEB_APPROVALS VIEW/APPROVE hoặc Scope. Quyền và Scope được kiểm tra khi người duyệt thao tác. Các cấp phải là những người khác nhau, không tự duyệt nếu allowSelfApproval=false. Không đủ điều kiện thì rollback cả tạo đơn/giữ phép.

Backend chốt ApproverUserID và ApproverEmployeeId vào ApprovalStep. Khi approve **hoặc reject**, phải đồng thời:

1. Có WEB_APPROVALS APPROVE và scope phù hợp.
2. Đúng UserID của bước pending đầu tiên, đơn đang pending và version khớp.
3. users.employee_id vẫn bằng approver_employee_id đã chốt, nếu bước có snapshot nhân viên. Đổi/gỡ liên kết trả403, không cập nhật bước hoặc số dư.
4. Không vi phạm chính sách tự duyệt.

Quyền VIEW/ALL không thay thế quyền APPROVE hoặc việc được giao bước duyệt. Sửa settings chỉ áp dụng đơn gửi sau đó, không đổi người duyệt của đơn đã gửi. Approval detail trả steps có approverEmployeeId để đối chiếu. Notify vẫn gửi cho User được giao.

Ví dụ bước trả về:

```json
{
  "id": 101,
  "stepNo": 1,
  "approverUserId": "approver-account",
  "approverEmployeeId": 12,
  "decision": "PENDING",
  "comment": null,
  "decidedAt": null
}
```

## Migration và cấu hình cũ

Migration mới `20261117043059_SnapshotApprovalEmployee` thêm cột nullable `approval_steps.approver_employee_id`, index và FK tới employees.Id, Restrict. Không tạo lại bảng, không backfill, không sửa snapshot cũ. Source có migration không xác nhận nó đã được apply ở môi trường của bạn; đợt thay đổi này không tự chạy migration/deploy. Cần schema mới trước khi dùng API duyệt với binary mới.

Cấu hình USER cũ chỉ có userId cần GET rồi PUT lại bằng employeeId, giữ các route còn lại và version hiện tại. Bước đã tồn tại có approver_employee_id=null vẫn theo UserID được giao, không thể kiểm tra nhân viên lịch sử chưa từng được lưu. Bước HR dùng tài khoản không liên kết nhân viên vẫn theo chính sách HR cũ. Không tự suy ra hoặc ghi đè người duyệt của đơn cũ.

## Lỗi thường gặp

| Tình huống | Kết quả |
| --- | --- |
| Thiếu quyền GET/PUT cấu hình | 403 |
| USER thiếu employeeId, nhân viên không ACTIVE hoặc không có User ACTIVE | 400 |
| Route/bước không hợp lệ, route trùng | 400 |
| Settings version cũ | 409; GET rồi chỉnh lại trên cấu hình mới |
| Chưa có route lúc gửi đơn | 409 |
| Sai người duyệt hoặc User đã đổi/gỡ liên kết nhân viên | 403 nếu bản ghi nằm trong scope; ngoài scope có thể404 |
| Duyệt trùng, sai version hoặc đơn đã kết thúc | 409 |
