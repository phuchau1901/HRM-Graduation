# Notifications — Phân phối và realtime

[Module](README.md) · [API](API.md)

## Lưu trữ

| Bảng | Vai trò |
| --- | --- |
| notifications | Một nội dung chung; source/status/creator/thời gian/reference/dedup key |
| notification_targets | Tiêu chí recipient tại draft/schedule |
| notification_recipients | Một dòng/account; read/delivery/retry state; unique(notification_id,user_id) |
| notification_outbox | Job phân phối, lịch, lease/attempt/retry |

UserId là VARCHAR(100), tham chiếu users.user_id. Không nhân bản cùng nội dung5000 lần. Entity Notification vẫn ở System; không tạo Entity Notification thứ hai.

## Target và quyền

| Type | Tiêu chí | Action WEB_NOTIFICATIONS |
| --- | --- | --- |
| USER | Đúng1 UserIds | SEND_USER |
| USERS | Nhiều UserIds | SEND_GROUP |
| ROLE | Một/nhiều RoleIds | SEND_GROUP |
| DEPARTMENT | Một/nhiều DepartmentIds | SEND_GROUP |
| ALL | Không cần danh sách ID | SEND_ALL |
| CUSTOM | FilterCode=ACTIVE_EMPLOYEES | SEND_GROUP |

Target dùng đúng một loại tiêu chí, không trộn ID khác loại trong cùng target. Có1..50 target và tổng ID liệt kê tối đa1000; ALL không cần gửi5000 ID. User nhận phải ACTIVE; DEPARTMENT/CUSTOM còn lọc Employee ACTIVE. CUSTOM chỉ dùng allowlist backend ACTIVE_EMPLOYEES, không nhận SQL/expression tùy ý. Các target hợp OR, distinct UserId.

## Vòng đời

ANNOUNCEMENT không có scheduledAt tạo DRAFT; có scheduledAt tương lai tạo SCHEDULED. Publish draft chuyển SCHEDULED và tạo/đánh thức outbox, không gửi đồng bộ toàn bộ recipients trong request. Worker đến hạn resolve recipients một lần, ghi batch trong transaction và chuyển PUBLISHED. Recipient đã phát hành không tự thay khi Role/phòng ban đổi. CANCELLED áp dụng trước khi phát hành; không thu hồi thông báo đã PUBLISHED.

WORKFLOW/SYSTEM/REMINDER gọi CreateInternalAsync với business event key ổn định và dùng cùng pipeline. Mutation Employee gọi trong transaction nghiệp vụ hiện có.

Idempotency-Key bắt buộc khi tạo announcement, không rỗng và tối đa100 ký tự. Cùng key/actor/source và payload trả kết quả cũ; payload khác bị xung đột. Outbox lease và transaction ngăn worker lặp tạo recipient trùng; retry không đồng nghĩa network exactly-once. Client nên dedup theo notificationId/eventId.

NotificationOptions: WorkerEnabled opt-in; PollSeconds mặc định5, RecipientBatchSize250, DeliveryBatchSize100. Không tự bật worker hoặc seed khi schema chưa sẵn sàng. Xem source NotificationDispatcher cho giới hạn/retry/backoff cụ thể.

## Web và Mobile

SignalR hub `/hubs/notifications`, event `notification.available`, payload `{notificationId,eventId}`. UserIdentifier lấy sub canonical; group delivery do server lập theo UserId+auth_version. Không cho client tự chọn group của người khác.

Realtime chỉ là tín hiệu; nội dung durable nằm ở DB/API. Offline/reconnect gọi lại inbox và unread-count. Sau revoke cần Login lấy token mới; socket cũ không nhận version mới. Không push thông tin lương, sức khỏe, nhân sự chi tiết. FCM Mobile chưa triển khai.

Audit ghi create/publish/cancel/group distribution/retry/failure, actor/target/count/notification/time/trace. Không log token, password hoặc nội dung nhạy cảm. CORS Notification dùng allowlist cấu hình hiện có; không mở origin wildcard.
