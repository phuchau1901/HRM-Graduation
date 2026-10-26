# Notifications — Trung tâm thông báo

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **IMPLEMENTED**. Pipeline chung Web/Mobile hỗ trợ USER, USERS, ROLE, DEPARTMENT, ALL, CUSTOM.

## Phạm vi source

Source: `backend/HRM.API/Modules/Notifications/`.

Entity hiện có: `NotificationOutbox`, `NotificationRecipient`, `NotificationTarget`.

## Thành phần

NotificationsController → NotificationService → NotificationAudience → outbox → NotificationWorker/NotificationDispatcher → SignalRNotificationTransport.

Entity nội dung Notification đang đặt tại `Modules/System/Entities/Notification.cs`; Entity Target/Recipient/Outbox nằm trong module Notifications. Đây là một pipeline chung, không phải hai trung tâm thông báo.

Nguồn ANNOUNCEMENT đến từ API quản trị; WORKFLOW/SYSTEM/REMINDER dùng CreateInternalAsync với business event key ổn định. Firebase FCM chưa triển khai.


## Tài liệu module

- [Notifications API](API.md)
- [Phân phối, outbox và realtime](ARCHITECTURE.md)
- [Kiểm thử Notification](TESTS.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
