# Approvals — Trung tâm phê duyệt

[API](API.md) · [Cấu hình workflow](WORKFLOW_SETTINGS.md) · [Kiến trúc và thêm module](ARCHITECTURE.md) · [Leave](../Leave/README.md)

Approvals là module cấp cao, dùng chung cho các nghiệp vụ cần phê duyệt. Module con Leave xử lý nghỉ phép/hủy phép; Overtime và Attendance xử lý các nghiệp vụ đã có. Không tạo bảng hoặc workflow song song.

```text
Approvals
├── Approval Center        /#/approvals
├── Leave                  /#/approvals/leave
├── Overtime               /#/approvals/overtime
├── Attendance             /#/approvals/attendance
└── Cấu hình luồng duyệt    /#/approvals/settings
```

Nhóm menu Approvals tách khỏi Human Resources. Quản lý đơn, loại phép, số dư và lịch cộng phép vẫn thuộc các nghiệp vụ nhân sự tương ứng. URL cũ /#/hr/approvals được hỗ trợ để mở trung tâm chung. Cấu hình dùng component chung của Approvals; đường dẫn tài liệu Leave/WORKFLOW_SETTINGS.md giữ liên kết tới tài liệu mới.

## Backend

- Entities/Configurations: ApprovalRequest, ApprovalStep thuộc Modules/Approvals, giữ nguyên bảng approval_requests/approval_steps và toàn bộ mapping/index/FK/version.
- Controllers/ApprovalsController: list/detail/approve/reject/history và settings, giữ URL/payload/response/quyền hiện có.
- Services/ApprovalWorkflowService: scope, giao người duyệt, thứ tự bước, version, transaction, audit và WORKFLOW notification.
- Services/IApprovalModule: điểm mở rộng cho module nghiệp vụ.
- Modules/Leave: LEAVE, LEAVE_CANCELLATION; trừ/giải phóng/hoàn phép qua LeaveBalanceAccounting của domain Leave.
- Modules/Overtime: OVERTIME; chỉ cấp ApprovedHours sau duyệt cuối.
- Modules/Attendance: ATTENDANCE_ADJUSTMENT; kiểm tra snapshot/version và cập nhật công an toàn.

Engine không switch theo requestType của Leave/Overtime/Attendance. Module handler nhận sự kiện hoàn tất/chi tiết; thêm nghiệp vụ mới bằng đăng ký handler, không sửa logic engine.

## Quyền và dữ liệu

WEB_APPROVALS VIEW để xem, APPROVE để duyệt/từ chối, scope SELF/DEPARTMENT/ALL theo action. VIEW/ALL không vượt quyền duyệt; vẫn cần đúng UserID, EmployeeId của bước được giao, đúng thứ tự/version và chính sách self-approval.

WEB_APPROVAL_SETTINGS VIEW/UPDATE quản lý cấu hình chung, không áp employee scope. Các mã quyền không đổi; không tự seed hoặc cấp thêm grant. Bộ lọc module không mở rộng scope hoặc tự cấp quyền xem domain khác.

## Schema và compatibility

Phần tách module không thay schema và không có migration mới. Current model snapshot cập nhật namespace CLR để khớp entity mới; các migration lịch sử giữ nguyên. RequestType, IDs, settings key APPROVAL_WORKFLOWS, AuditLog EntityType=ApprovalRequest và notification keys giữ nguyên để đọc lịch sử và chống thông báo trùng.

Các migration Leave trước đó vẫn cần được kiểm tra/apply bởi người vận hành nếu môi trường chưa có. Không apply migration, không deploy hoặc sửa dữ liệu live trong lần refactor này.

## Kết quả kiểm tra refactor — 2026-11-17

- Backend build thành công; workflow/balance/migration/inventory tests41/41 qua.
- Bộ đầy đủ439 tests:430 qua,9 lỗi cũ thuộc EmployeeCreationTests (NV/TX và các tình huống collision/rollback liên quan), không sửa module sinh mã trong refactor này.
- Frontend51/51 tests qua, gồm4 test module Approvals mới; production build thành công.
- Postman sắp thành nhóm Approvals cha với Shared Workflow và các module con; thêm3 ví dụ lọc module, tổng129 examples, vẫn119 REST routes.
- Không thêm migration cho refactor namespace/module, không apply migration, không deploy hoặc sửa database thật.
