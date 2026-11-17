# Cấu hình workflow đã chuyển sang Approvals

Tài liệu chuẩn hiện nằm tại [Approvals / Workflow Settings](../Approvals/WORKFLOW_SETTINGS.md).

Màn hình: Approvals → Cấu hình luồng duyệt (`/#/approvals/settings`). Screen code vẫn là WEB_APPROVAL_SETTINGS; GET cần VIEW, PUT cần UPDATE. API `/api/approval-workflow-settings` và payload cũ giữ nguyên; USER vẫn cấu hình bằng employeeId.

[Kiến trúc module cha/con](../Approvals/ARCHITECTURE.md) · [API Approvals](../Approvals/API.md)
