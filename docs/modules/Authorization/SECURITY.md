# Authorization — Chính sách quản trị

[Module](README.md) · [Database](../../guides/DATABASE.md)

## Quyền chức năng

Mọi API quản trị yêu cầu JWT, tài khoản ACTIVE và ScreenPermission; read/write còn kiểm tra live grants trong DB. WEB_USERS bảo vệ tài khoản, WEB_ROLES bảo vệ Role, WEB_PERMISSIONS bảo vệ screens/matrix/action catalog. ROLE name không tạo bypass. Metadata quản trị là global qua grant rõ ràng, không tự mở quyền Employee PII.

Matrix update cần WEB_PERMISSIONS/UPDATE **và** APPROVE. Assign Role và reset cần WEB_USERS/APPROVE; tạo tài khoản có Role cần thêm APPROVE ngoài NEW. User/Role đích có quyền cũ hoặc mới vượt tập quyền hiện tại của actor thì từ chối403. Unknown/inactive grants không được âm thầm biến thành quyền có thể ủy quyền.

Không tự sửa membership của chính mình; không sửa matrix của Role đang gán cho chính mình; không tự reset password qua API quản trị. Tạo Role rỗng không tự tạo grant. Quyền standard và extended độc lập: bỏ extendedActions khi patch giữ nguyên; [] gỡ các extended đã đăng ký của screen đang sửa; unknown action đã lưu giữ nguyên/read-only.

## Concurrency và transaction

GET detail trả ETag và version64 hex. PUT/PATCH/DELETE/reset/assign phải có `If-Match: "<version>"`; thiếu428, version cũ412. Weak/wildcard/multiple ETag bị từ chối. Đọc lại đúng resource sau khi matrix/membership thay đổi.

AdministrationService dùng Serializable transaction và no-op UPDATE khóa cùng row WEB_PERMISSIONS trước khi đọc quyền/version. Mọi mutation, audit và revocation commit cùng nhau; lỗi một phần matrix rollback toàn bộ. Deadlock/hạ tầng lỗi cần đọc lại và retry có chủ đích; không blind replay reset password.

## Bảo vệ quản trị cuối cùng và bootstrap

Mỗi mutation phải còn ít nhất một account ACTIVE với stored credential không rỗng và union grant trên các screen ACTIVE:

| Screen | Grant tối thiểu để phục hồi quản trị |
| --- | --- |
| WEB_USERS | VIEW, UPDATE, APPROVE |
| WEB_ROLES | VIEW, UPDATE |
| WEB_PERMISSIONS | VIEW, UPDATE, APPROVE |

Tạo dữ liệu còn cần NEW; xóa Role cần DELETE; delegation chỉ trong quyền actor. Không có bootstrap API hoặc tự seed grant. Nếu chưa có account phục hồi, operator phải duyệt quy trình bootstrap ngoài API với người giám sát và bản ghi thay đổi. Không cấp toàn quyền chỉ dựa vào tên ADMIN/ALLROLL.

Màn hình đang được Role tham chiếu không đổi Code/Platform tùy ý; không xóa cứng. Việc tắt screen không được làm mất quản trị cuối cùng. Kích hoạt screen có dormant grants vượt authority actor bị chặn.

## Reset và thu hồi phiên

Reset yêu cầu password hiện tại **của actor**, target nằm trong authority actor, If-Match và APPROVE. Password mới12..128;5 attempts/phút/actor/API instance. Không sinh/gửi password qua Notification, không log/audit credential. Chưa có MFA, forced-first-change hoặc two-person approval workflow trong schema; cần thiết kế riêng nếu chính sách tổ chức yêu cầu.

User profile/status/roles/reset và Role metadata/matrix, Screen edits làm tăng users.auth_version của account bị ảnh hưởng và revoke RefreshToken. Token cũ401 ở request tiếp theo; token mới lấy snapshot mới khi Login. Migration auth_version phải được duyệt/áp dụng trước binary mới.

ScreenPermission cho API nghiệp vụ dùng JWT snapshot. Sửa grant trực tiếp DB ngoài admin API không tự bump version: snapshot cũ có thể còn hiệu lực đến khi hết hạn15 phút; live admin check vẫn từ chối grant đã bị gỡ. Ghi ngoài API phải có quy trình revocation được duyệt. Request đã xác thực và đang chạy không thể bị hủy hồi tố.

SignalR gửi vào group theo UserId+session version hiện hành; socket cũ có thể còn mở nhưng không nhận lần gửi tiếp theo của version mới. Cần rollout hoàn tất các instance để tránh binary cũ bỏ qua av. Không rollback binary cũ mà giả định immediate revocation vẫn được giữ.
