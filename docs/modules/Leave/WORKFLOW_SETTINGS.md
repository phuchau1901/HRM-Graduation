# Cấu hình workflow đã chuyển sang Approvals

Tài liệu chuẩn hiện nằm tại [Approvals / Workflow Settings](../Approvals/WORKFLOW_SETTINGS.md).

Màn hình: Approvals → Cấu hình luồng duyệt (`/#/approvals/settings`). Screen code vẫn là WEB_APPROVAL_SETTINGS; GET cần VIEW, PUT cần UPDATE. API `/api/approval-workflow-settings` và payload cũ giữ nguyên; USER vẫn cấu hình bằng employeeId.

[Kiến trúc module cha/con](../Approvals/ARCHITECTURE.md) · [API Approvals](../Approvals/API.md)

### Thời điểm kiểm tra quyền người duyệt

Khi gửi phiếu, hệ thống xác định người duyệt theo workflow và tạo các bước PENDING; không kiểm tra WEB_APPROVALS VIEW/APPROVE hoặc Data Scope của người duyệt ở bước gửi. Người nhận phải tồn tại, hoạt động, không trùng bước và tuân thủ chính sách tự duyệt. Người gửi nghỉ phép chỉ cần WEB_LEAVE_REQUESTS / NEW và nhân viên liên kết ACTIVE, không cần Scope NEW.

Quyền và Scope của người duyệt được kiểm tra khi xem/duyệt/từ chối. Chỉ người được giao ở bước hiện tại có WEB_APPROVALS / APPROVE và Scope phù hợp mới được quyết định. Chưa được cấp quyền duyệt không làm người gửi bị chặn tạo phiếu; người duyệt cần được cấu hình quyền trước khi xử lý.
