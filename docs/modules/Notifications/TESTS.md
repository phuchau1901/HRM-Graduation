# Notifications — Kiểm thử

[Module](README.md) · [Hướng dẫn chạy test](../../guides/TESTING.md)

## Source kiểm thử

Trong `backend/HRM.API.Tests/`: NotificationCenterTests, NotificationMigrationTests, AdministrationRealtimeTests.

## Các tình huống cần giữ

- USER/USERS/ROLE/DEPARTMENT/ALL/CUSTOM; ACTIVE filtering; hợp OR và loại trùng; ALL5000 user theo batch.
- JWT ownership inbox/read; thiếu SEND_ALL403; scheduled/create/publish/cancel đúng trạng thái.
- Idempotency-Key retry, payload conflict; worker rerun không nhân recipient; unique(notification_id,user_id), lease và retry.
- Offline inbox durable và reconnect sync; SignalR event không chứa PII, group theo session version; account khóa không nhận.
- Migration Notification không tùy tiện tác động screens hoặc các bảng nghiệp vụ ngoài phạm vi.

Automated tests dùng SQLite/TestServer, không chứng minh trạng thái grant/DDL của Railway. Các tình huống mới chưa có assertion tương ứng phải bổ sung test trước khi thay nghiệp vụ; đối chiếu tên method test trong source, không xem checklist này là kết quả chạy thực tế.

Khi test thủ công bằng Postman, chỉ dùng môi trường và tài khoản thử nghiệm đã được duyệt, lấy permission từ backend; không ghi password/token vào báo cáo.
