# Approvals API Specification

[Kiến trúc](ARCHITECTURE.md) · [Workflow settings](WORKFLOW_SETTINGS.md) · [Nghiệp vụ Leave](../Leave/API.md)

Backend controller: Modules/Approvals/Controllers/ApprovalsController.cs. Các URL hiện có được giữ nguyên.

| Method | Route | Permission |
| --- | --- | --- |
| GET | /api/approvals | WEB_APPROVALS VIEW + scope |
| GET | /api/approvals/{id:long} | WEB_APPROVALS VIEW + scope |
| POST | /api/approvals/{id:long}/approve | WEB_APPROVALS APPROVE + scope + assigned step |
| POST | /api/approvals/{id:long}/reject | WEB_APPROVALS APPROVE + scope + assigned step |
| GET | /api/approvals/{id:long}/history | WEB_APPROVALS VIEW + scope |
| GET | /api/approval-workflow-settings | WEB_APPROVAL_SETTINGS VIEW |
| PUT | /api/approval-workflow-settings | WEB_APPROVAL_SETTINGS UPDATE |

## List và module con

GET `/api/approvals?page=1&pageSize=20&module=LEAVE` trả riêng các requestType của module Leave, gồm LEAVE và LEAVE_CANCELLATION. `module=OVERTIME` hoặc `module=ATTENDANCE` cho hai module khác đang đăng ký. Bỏ module để xem tất cả các yêu cầu trong scope. Module chưa đăng ký =>400.

Query khác giữ nguyên: view=MY|TEAM|ALL (defaultALL), employeeId, status, requestType; pageSize tối đa100. Bộ lọc module áp ở SQL sau giới hạn nhân viên theo scope và trước count/paging. Không tải tất cả rồi lọc client. TEAM giới hạn phòng ban hiện tại, không cho scope SELF. RequestType được xác định bởi registry module, không có module column mới trong DB.

List trả `{success,total,page,pageSize,data:[...]}` với mỗi dòng `{id,requestType,referenceId,employeeId,employeeName,requestedByUserId,status,createdAt,version,currentStepNo}`.

Detail trả `{request,steps,details}`. Steps gồm `{id,stepNo,approverUserId,approverEmployeeId,decision,comment,decidedAt}`. Details do module con cung cấp: LeaveView, OvertimeView hoặc AttendanceAdjustment hiện có; các field JSON không đổi. Module mới phải trả DTO an toàn trong phạm vi nhân viên của approval.

## Approve/reject

```json
{ "version": 1, "reason": "Đã kiểm tra" }
```

Dùng version của approval, không dùng version của đơn nghiệp vụ. Trả `{id,status,version}`. Người gọi phải là User của bước pending đầu tiên và vẫn liên kết đúng Employee đã chốt (nếu có snapshot), có APPROVE scope bao phủ nhân viên, không vi phạm chính sách tự duyệt. Duyệt trùng/stale/completed =>409. Người không được giao =>403 nếu record trong scope; ngoài scope hoặc không có =>404. Thiếu token401, thiếu quyền403, validation400.

Cấp cuối gọi handler nghiệp vụ trong cùng transaction. Handler lỗi thì rollback cả bước/quyết định, thay đổi domain, audit và notification. Từ chối cũng gọi handler để trả trạng thái/giải phóng quota đúng nghiệp vụ. Lịch sử và nội dung thông báo dùng cơ chế hiện có, không gửi trùng khi retry.

## History và settings

History query page/pageSize, đọc AuditLog scoped theo approval và thứ tự ID tăng dần. Không đổi cấu trúc `{id,actorUserId,action,beforeJson,afterJson,createdAt}`.

Settings vẫn `{version,routes}` và lưu JSON key APPROVAL_WORKFLOWS. Routes tối đa100, requestType phải thuộc một handler đã đăng ký, không trùng; mỗi route1–10 bước. Hiện có4 requestType thuộc3 module. USER cấu hình employeeId, Team Lead/Department Manager tự lấy từ bảng tổ chức, HR legacy vẫn hỗ trợ. Xem [đặc tả settings](WORKFLOW_SETTINGS.md).

### Performance / KPI

Module PERFORMANCE, requestType KPI_EVALUATION. Cấu hình workflow bằng API settings hiện có; /api/approvals?module=PERFORMANCE. Detail cần thêm WEB_KPI_EVALUATION VIEW + scope; quyết định cần WEB_KPI_EVALUATION APPROVE + scope bên cạnh WEB_APPROVALS APPROVE và đúng bước. KPI luôn cấm tự duyệt kể cả allowSelfApproval=true. Kết thúc cập nhật KPI target trong transaction chung. [KPI API](../Performance/API.md).
