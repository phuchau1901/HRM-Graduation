# Authorization — Chính sách quản trị

[Module](README.md) · [Database](../../guides/DATABASE.md)

## Quyền chức năng

API quản trị yêu cầu JWT, tài khoản ACTIVE và ScreenPermission (reset password dùng kiểm tra theo type ở service); read/write còn kiểm tra live grants trong DB. WEB_USERS bảo vệ tài khoản, WEB_ROLES bảo vệ Role, WEB_PERMISSIONS bảo vệ screens/matrix/action catalog. ROLE name không tạo bypass. Metadata quản trị là global qua grant rõ ràng, không tự mở quyền Employee PII.

Matrix update cần WEB_PERMISSIONS/UPDATE **và** APPROVE. Assign Role cần WEB_USERS/APPROVE; ADMIN_RESET cần live WEB_USERS/UPDATE; SELF_CHANGE không cần quyền quản trị; tạo tài khoản có Role cần thêm APPROVE ngoài NEW. User/Role đích có quyền cũ hoặc mới vượt tập quyền hiện tại của actor thì từ chối403. Unknown/inactive grants không được âm thầm biến thành quyền có thể ủy quyền.

Không tự sửa membership của chính mình; không sửa matrix của Role đang gán cho chính mình; ADMIN_RESET không tự reset chính mình; SELF_CHANGE chỉ đổi password chính mình sau xác thực mật khẩu cũ. Tạo Role rỗng không tự tạo grant. Quyền standard và extended độc lập: bỏ extendedActions khi patch giữ nguyên; [] gỡ các extended đã đăng ký của screen đang sửa; unknown action đã lưu giữ nguyên/read-only.

## Concurrency và transaction

GET detail trả ETag và version64 hex. PUT/PATCH/DELETE/assign phải có `If-Match: "<version>"`; thiếu428, version cũ412. Weak/wildcard/multiple ETag bị từ chối. Đọc lại đúng resource sau khi matrix/membership thay đổi. Reset password trả 204 và không cần If-Match.

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

Endpoint reset hiện có nhận `type=SELF_CHANGE|ADMIN_RESET`, `oldPassword?`, `newPassword`. SELF_CHANGE chỉ nhắm JWT UserId và verify mật khẩu cũ, không cần grant quản trị/bootstrap. ADMIN_RESET nhắm tài khoản khác, kiểm tra live WEB_USERS/UPDATE và Dominates; không cần oldPassword, không tin type để cấp quyền. Admin branch giữ catalog lock và guard phục hồi hiện có. PasswordService/JWT không đổi.

Password mới 12..128, không blank; cả hai type chung 5 attempts/phút/actor/API instance, trước hashing. Thành công 204, tăng auth_version và revoke refresh token trong cùng transaction; token cũ401. Không yêu cầu If-Match và không trả user metadata. Audit metadata actor/target/type/timestamp/result/traceId, không chứa credential; failed attempts được audit riêng sau rollback, rate limited type UNKNOWN vì chưa bind body. Không log request DTO hoặc password/hash/salt. Xem [API và compatibility](USERS_API.md#post-apiuserstargetuseridreset-password). Chưa thêm MFA/forced-first-change/two-person workflow.

User profile/status/roles/reset và Role metadata/matrix, Screen edits làm tăng users.auth_version của account bị ảnh hưởng và revoke RefreshToken. Token cũ401 ở request tiếp theo; token mới lấy snapshot mới khi Login. Migration auth_version phải được duyệt/áp dụng trước binary mới.

ScreenPermission cho API nghiệp vụ dùng JWT snapshot. Sửa grant trực tiếp DB ngoài admin API không tự bump version: snapshot cũ có thể còn hiệu lực đến khi hết hạn15 phút; live admin check vẫn từ chối grant đã bị gỡ. Ghi ngoài API phải có quy trình revocation được duyệt. Request đã xác thực và đang chạy không thể bị hủy hồi tố.

SignalR gửi vào group theo UserId+session version hiện hành; socket cũ có thể còn mở nhưng không nhận lần gửi tiếp theo của version mới. Cần rollout hoàn tất các instance để tránh binary cũ bỏ qua av. Không rollback binary cũ mà giả định immediate revocation vẫn được giữ.
