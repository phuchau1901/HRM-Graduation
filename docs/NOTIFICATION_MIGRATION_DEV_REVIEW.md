# Rà soát AddNotificationCenter theo Railway DEV

Migration: **20261019145341_AddNotificationCenter**, sau **20261019074710_InitialHRMDatabase**. Chỉ sửa source và xuất SQL; chưa chạy Migration/DDL/DML trên Railway.

## Kiểm tra DEV thực tế bằng SELECT

Đã kết nối qua cấu hình Development hiện có, chỉ đọc INFORMATION_SCHEMA, migration history, version/collation và COUNT(*). Không ghi connection string, hostname, username, password hoặc dữ liệu tài khoản vào báo cáo. Bằng chứng metadata: [notification-center-dev-inspection.json](notification-center-dev-inspection.json), có recordedAtUtc.

- MySQL **8.4.11**, database railway, InnoDB.
- `__EFMigrationsHistory` chỉ có `20261019074710_InitialHRMDatabase` / EF 8.0.13.
- notifications có **0 dòng**, sáu cột cũ đúng yêu cầu, PK id BIGINT AUTO_INCREMENT, index IX_notifications_user_id còn tồn tại.
- notifications không có FK, đặc biệt không có fk_notifications_user_id.
- Chưa có cột metadata mới và chưa tồn tại cả bốn bảng notification_targets/notification_recipients/notification_outbox/role_screen_actions.
- screens đúng id/code/name/platform/icon/is_active; chỉ có PK và unique IX_screens_code; không có self FK/index/cột legacy.
- users.user_id là varchar(100), PK; roles.id và screens.id là bigint signed, PK.
- users.user_id, notifications và database/server/default collation của utf8mb4 đều **utf8mb4_0900_ai_ci**. Bảng mới dùng utf8mb4 nên FK string tương thích với khóa users thực tế.

Không thấy dấu vết DDL mới áp dụng dở ở các đối tượng Notification hiện tại. Không cần script khôi phục đối tượng mới trước khi áp dụng bản sửa trên trạng thái vừa kiểm tra. Không thể suy luận từ metadata hiện tại liệu FK cũ đã từng bị xóa ở lần chạy trước; điều xác nhận được là FK hiện không tồn tại và Migration mới không cố xóa nó.

## Up đã sửa

Bỏ toàn bộ DropForeignKey cũ. Bỏ mọi thao tác lên schema screens. Không sửa Initial migration đã áp dụng. Giữ id/title/content/created_at và primary key notifications nguyên trạng.

| Bảng | Thay đổi khi operator áp dụng |
| --- | --- |
| notifications | Bỏ index IX_notifications_user_id, bỏ is_read/user_id; thêm 12 cột và 3 index; thêm FK created_by_user_id → users.user_id |
| notification_targets | Tạo mới: id BIGINT AUTO_INCREMENT, notification_id BIGINT FK, target_type VARCHAR(20), criteria_json JSON; index notification_id |
| notification_recipients | Tạo mới: PK(notification_id,user_id), user_id VARCHAR(100), FK notifications/users; read/delivery timestamps, attempts/status, event_id, lease và 2 index |
| notification_outbox | Tạo mới: notification_id BIGINT PK/FK, status/available_at/attempts/lease/last_error_code; 1 index due-job |
| role_screen_actions | Tạo mới, ứng dụng đang dùng cho JWT: PK(role_id,screen_id,action_code VARCHAR(40)), FK roles/screens, index screen_id |
| __EFMigrationsHistory | EF ghi thêm đúng record 20261019145341_AddNotificationCenter khi áp dụng thành công |

users, roles, role_details, screens, employees, departments và các bảng nghiệp vụ khác không có ALTER/DROP/INSERT/UPDATE/DELETE trong SQL. Các REFERENCES tới users/roles/screens chỉ khai báo FK của bảng/cột Notification mới, không thay đổi cột hoặc dữ liệu các bảng cha. Mọi FK mới dùng RESTRICT, không cascade xóa.

12 cột thêm vào notifications:

| Cột | MySQL | Nullable / default trong SQL |
| --- | --- | --- |
| cancelled_at | datetime(6) | NULL |
| created_by_user_id | varchar(100) | NULL |
| deduplication_key | varchar(64) | NOT NULL DEFAULT '', unique index |
| published_at | datetime(6) | NULL |
| recipient_count | int | NOT NULL DEFAULT 0 |
| reference_id | varchar(100) | NULL |
| reference_type | varchar(60) | NULL |
| request_hash | varchar(64) | NOT NULL DEFAULT '' |
| scheduled_at | datetime(6) | NULL |
| source | varchar(20) | NOT NULL DEFAULT '' |
| status | varchar(20) | NOT NULL DEFAULT '' |
| trace_id | varchar(64) | NOT NULL DEFAULT '' |

NotificationService luôn gán source/status/dedup/hash/trace khi tạo bản ghi. Không thay đổi default hoặc kiểu dữ liệu của các cột giữ lại. Không cần data backfill vì DEV đã được xác nhận 0 notification; Migration này có tiền điều kiện bảng vẫn trống lúc áp dụng. Không dùng bản này để chuyển một database đã có thông báo cần bảo toàn người nhận/đã đọc.

Index mới: IX_notifications_created_by_user_id, IX_notifications_deduplication_key (unique), IX_notifications_status_scheduled_at; index notification_targets.notification_id; index notification_outbox(status,available_at,locked_until); hai index recipient theo user/read và delivery/due; index role_screen_actions.screen_id. PK recipient là unique key notification_id + user_id theo yêu cầu.

## Down

Down dừng ngay bằng NotSupportedException, trước khi tạo bất kỳ DDL nào. Không thêm lại FK user legacy hoặc cột/index/FK Screen không tồn tại. Lý do: sau khi hệ thống chạy, một notification có thể có nhiều recipient và trạng thái đọc/gửi riêng; tự hạ về user_id/is_read có thể làm mất dữ liệu. Rollback dữ liệu cần conversion/backup được duyệt riêng. Không cung cấp SQL downgrade tự động có khả năng mất dữ liệu.

## Designer, Snapshot và kiểm chứng

Designer hiện mang đúng ID 20261019145341; Designer/Snapshot hiện tại đã khớp model Screen sáu cột nên không cần sửa trong lần này. Không thay đổi entity/configuration hoặc Initial migration để làm khớp một schema suy đoán.

- `dotnet build HRM.API.csproj`: thành công, **0 warning / 0 error**.
- `dotnet ef migrations has-pending-model-changes --project HRM.API.csproj --startup-project HRM.API.csproj`: **No changes have been made to the model since the last migration.**
- Ba test Migration đều đạt: Up đúng baseline/table scope/kiểu/FK/index; Snapshot và target model khớp; Down dừng trước DDL.
- Toàn bộ suite: **121 pass, 1 fail, 122 total**, không skip. Lỗi còn lại AuthSeederTests kỳ vọng 4 Role nhưng seeder hiện chỉ có ADMIN (không liên quan Migration, không sửa seed).
- Test InitialMigration...HasPendingModelChanges trước đây lỗi nay đã đạt vì Snapshot hiện tại khớp model.

has-pending-model-changes so sánh source model với Snapshot, không xác nhận Migration đã chạy trên MySQL. Trạng thái database vẫn chỉ có Initial; AddNotificationCenter vẫn chưa áp dụng.

SQL nâng cấp để duyệt: [notification-center-migration.sql](notification-center-migration.sql). Script xuất đúng phạm vi Initial → AddNotificationCenter, không chạy lại CREATE TABLE của Initial. Lệnh đã dùng từ backend/HRM.API (connection design-time là localhost giả, không mở Railway):

```sh
dotnet ef migrations script 20261019074710_InitialHRMDatabase 20261019145341_AddNotificationCenter --project HRM.API.csproj --startup-project HRM.API.csproj --no-build --output ../../docs/notification-center-migration.sql
```

[notification-center-preflight.sql](notification-center-preflight.sql) chỉ gồm SELECT để kiểm tra lại trạng thái trước lần áp dụng được duyệt. MySQL DDL có implicit commit: START TRANSACTION trong script không bảo đảm rollback toàn bộ schema. Nếu lần triển khai sau thất bại, cần đọc lại metadata trước khi chạy lại; không tự sửa migration history hoặc bỏ qua mọi lỗi bằng IF EXISTS.

## File sửa/tạo trong lần rà soát

- Sửa backend/HRM.API/Migrations/20261019145341_AddNotificationCenter.cs.
- Sửa backend/HRM.API.Tests/NotificationMigrationTests.cs.
- Xuất lại docs/notification-center-migration.sql.
- Cập nhật docs/NOTIFICATION_CENTER.md; tạo báo cáo này, preflight SELECT và metadata inspection JSON.

Giữ toàn bộ thay đổi chưa commit và các file người dùng đã di chuyển. Backup trước sửa: /private/tmp/hrm-notification-migration-fix/before.tar.gz. Không chạy database update, Migration, DDL hay SQL ghi dữ liệu trên Railway.
