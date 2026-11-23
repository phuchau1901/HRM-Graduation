# Kiến trúc Approvals và cách mở rộng

[Overview](README.md) · [API](API.md)

## Ranh giới module

```text
Modules/Approvals/
  Entities/                  ApprovalRequest, ApprovalStep
  Configurations/            Mapping các bảng approval hiện có
  DTOs/                      Query, action, settings, response dùng chung
  Controllers/               /api/approvals và /api/approval-workflow-settings
  Services/
    ApprovalWorkflowService  Start, query, decide, cancel pending, settings
    IApprovalModule          Hợp đồng extension của module nghiệp vụ
    ApprovalAudit            Lịch sử dùng chung
  Modules/
    Leave/                   LeaveApprovalModule
    Overtime/                OvertimeApprovalModule
    Attendance/              AttendanceAdjustmentApprovalModule

Modules/Leave/               Đơn, loại phép, quota, accrual và accounting
Modules/Attendance/Services/ AttendanceCorrectionRules dùng khi gửi/duyệt sửa công
```

LeaveWorkflowService chỉ tạo/hủy đơn và gọi engine; không còn các endpoint hoặc logic quyết định chung. Generic core không phụ thuộc LeaveWorkflowService/DTO/Entity của domain Leave. Adapter modules mới phụ thuộc domain tương ứng. Program.cs là nơi đăng ký engine/handlers, không có service dependency cycle.

Domain tạo request, giữ quota nếu cần và gọi StartAsync **trong cùng AppDbContext transaction**. Engine không cho submission/cancel pending ngoài transaction. Engine chốt bước, audit và thông báo người duyệt đầu tiên. Domain hủy pending xử lý dữ liệu của mình rồi gọi CancelPendingAsync; việc hủy không bắt buộc người gửi có quyền Approval APPROVE.

Khi approve/reject, engine kiểm tra scope/quyền, User/Employee được giao, version/thứ tự, rồi gọi CompleteAsync của handler đăng ký theo RequestType. Adapter chỉ xử lý dữ liệu nghiệp vụ và lịch sử liên quan; engine lưu trạng thái bước/approval và phát thông báo. Mọi SaveChanges tham gia transaction chung, không tự commit trong handler.

## Thêm một loại phê duyệt khác

1. Tạo module con, ví dụ `Modules/Approvals/Modules/Travel/TravelApprovalModule.cs`, implement IApprovalModule.
2. Khai báo Code ổn định (ví dụ TRAVEL), RequestTypes (ví dụ TRAVEL_REQUEST, tối đa30 ký tự dạng A-Z/0-9/_). Một requestType chỉ được đăng ký bởi một handler.
3. GetDetailsAsync trả chi tiết an toàn, kiểm tra record.ReferenceID và EmployeeId tương ứng. Không đưa PII của nhân viên khác vào DTO.
4. CompleteAsync kiểm tra linkage/trạng thái và mutate domain khi duyệt cuối/từ chối. Dùng DB context/transaction chung, không Begin/Commit transaction riêng hoặc gửi external notification ngoài outbox.
5. Nếu có loại yêu cầu phụ dùng workflow của loại chính, implement WorkflowFallback; Leave cancellation đang dùng cách này.
6. Đăng ký `AddScoped<IApprovalModule, TravelApprovalModule>()` tại Program.cs. Domain Travel tự tạo request rồi gọi StartAsync; không có API generic cho client tùy ý gắn requestType/referenceId.
7. Cấu hình route qua API settings, giữ version hiện tại. RequestType chưa đăng ký bị từ chối, không cần thêm tên Travel vào regex/switch của engine.
8. Frontend thêm presenter trong `src/approvals/modules/` và một entry vào `src/approvals/modules.js` gồm code, label, page, path, requestTypes, Details. Navigation, route và loại yêu cầu cấu hình dùng registry đó. Parent Approval Center không cần thêm switch nghiệp vụ.
9. Viết tests linkage, quyền/scope, approve/reject và rollback khi handler lỗi. Chỉ thêm migration nếu chính nghiệp vụ mới cần schema; tách module approval hiện tại không đổi schema.

Root API luôn giữ quyền WEB_APPROVALS theo action; module có yêu cầu bảo mật riêng cần kiểm tra bổ sung trong handler. Không dùng quyền VIEW để bỏ kiểm tra APPROVE. Role name không tạo bypass.

## Frontend

ApprovalCenter là list/detail/history/action dùng chung. LeaveDetails chỉ trình bày nghiệp vụ nghỉ phép; OvertimeDetails và AttendanceDetails tương tự. Child route gửi query module về server để lọc dữ liệu/paging. Nhóm menu Approvals gồm inbox chung, các module con và settings với quyền độc lập. Settings-only user không phải có WEB_APPROVALS VIEW.

URL `/#/hr/approvals` và cách gọi component LeaveWorkspace mode=approvals cũ được forward tới component cha mới để tương thích; các entry mới dùng `/#/approvals/...`. Legacy settings-only Leave Management có thể reuse component cấu hình của Approvals; menu chuẩn đã ở Approvals.

## Kiểm tra

ApprovalModulesTests có module Travel giả chỉ trong tests để chứng minh thêm requestType không sửa engine, cấu hình5 loại, lấy detail theo handler và rollback khi handler đã SaveChanges rồi lỗi. Có test bộ lọc Leave/Overtime không trộn dữ liệu, thiếu quyền duyệt, từ chối type chưa đăng ký và model không có pending schema changes.

Các test Leave/Overtime/Attendance/quota vẫn chạy qua engine mới; entity table names, audit EntityType, notification keys, routes và payload giữ compatibility. Không apply migration/deploy trong refactor này.

### Module authorization hooks

IApprovalModule có hai hook mặc định no-op để giữ hành vi các module hiện có: AuthorizeReadAsync trước khi trả domain details và AuthorizeDecisionAsync trước khi thay đổi bất kỳ bước nào. Performance dùng chúng để yêu cầu quyền/scope KPI tương ứng, cấm tự duyệt và chặn kỳ đã khóa. Không chỉ kiểm tra tại CompleteAsync: kiểm tra decision áp dụng từng bước trung gian, trước audit/notification/domain mutation. Adapter không phụ thuộc KpiService để tránh vòng DI với ApprovalWorkflowService.
