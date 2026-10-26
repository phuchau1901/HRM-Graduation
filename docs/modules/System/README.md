# System — Audit và hạ tầng dùng chung

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **PARTIAL — model/hạ tầng có; API nghiệp vụ MISSING**. Có Entity AuditLog, Notification và tích hợp audit; chưa có API quản trị System độc lập.

## Phạm vi source

Source: `backend/HRM.API/Modules/System/`.

Entity hiện có: `AuditLog`, `Notification`.

## Phạm vi và giới hạn

AuditLog lưu actor, action, entity/type/id, JSON trước/sau và thời gian. API quản trị bổ sung traceId trong JSON; không lưu password/hash/salt/token. Notification là entity nội dung dùng bởi module Notifications. API Dashboard/Reports và API tra cứu/export audit chưa triển khai; không giả định endpoint public cho bảng audit.

## Tài liệu module

- [Kiểm thử và quy trình chung](../../guides/TESTING.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
