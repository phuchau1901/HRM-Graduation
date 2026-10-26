# Auth — Mật khẩu, JWT và phiên

[Module](README.md) · [API](API.md)

## PasswordService

Mật khẩu mới dùng PBKDF2-HMAC-SHA256, mặc định600.000 iterations, salt ngẫu nhiên32 byte từ RandomNumberGenerator, key32 byte. Salt lưu riêng Base64 ở users.salt VARCHAR(44) nullable; password_hash lưu `PBKDF2-SHA256!600000!BASE64_HASH`.

Verify đọc thuật toán và iterations từ hash, kiểm tra canonical format, Base64 và kích thước, iterations100.000..1.000.000; so sánh CryptographicOperations.FixedTimeEquals. Hash/salt không hợp lệ bị từ chối, không fallback sang plaintext. PasswordService nhận tối đa1024 ký tự; API tạo/reset quản trị có chính sách riêng12..128 ký tự. Không trim/normalize password, không trả hoặc log credential.

Legacy ASP.NET Identity V2/V3 được đọc theo cấu trúc nhị phân có giới hạn, không dùng trực tiếp PasswordHasher để ghi mới. Login legacy thành công hoặc custom hash có work factor thấp sẽ tạo hash/salt mới; compare-and-swap ngăn ghi đè password vừa đổi. Login thất bại không sửa credential và có dummy work cho account không tồn tại/credential lỗi.

## JWT

HS256, xác thực signing key/issuer/audience/lifetime; sub chứa UserId chuỗi. Mặc định token15 phút, ClockSkew30 giây; giới hạn token8192 byte theo cấu hình. Không đổi SigningKey trong source hoặc tài liệu. Claim hrm_p chứa snapshot action theo screen, hrm_pv=1; role chỉ là metadata, không tự cấp quyền.

Claim av chứa users.auth_version được lấy từ lần xác thực credential. Middleware kiểm tra User ACTIVE và version DB mỗi request. Token thiếu av chỉ được chấp nhận khi version DB=0. Phiên bị thu hồi trả401 và cần Login lại. Chi tiết các thay đổi làm thu hồi phiên: [Authorization Security](../Authorization/SECURITY.md).

/me và /me/permissions đọc quyền UI mới nhất từ DB, chỉ trả màn hình có VIEW sau OR nhiều Role. JWT có thể chứa action khác VIEW dù screen không xuất hiện trong danh sách UI.

## Giới hạn Login

LoginRateLimiter:5 lần/phút/client address và30 lần/phút/API instance, không xếp hàng; tính cả thành công. Sai mật khẩu/account không tồn tại/bị khóa dùng cùng lỗi401 chung. Limiter cục bộ theo process; nhiều replica cần cơ chế shared/gateway được duyệt. Không tin X-Forwarded-For từ client khi chưa cấu hình proxy tin cậy.

## Seed Development

Source AuthSeeder hiện chỉ có account admin và Role ADMIN, không phải danh sách5 demo account của thiết kế trước đây. Chỉ chạy khi Development và AuthSeed:Enabled=true; password lấy riêng từ user-secrets AuthSeed:Passwords:admin. Seed idempotent, không khôi phục password/Role/grant đã sửa. Role ADMIN không tự có quyền.

Không bật seed trên Railway Production. Việc seed là ghi DB, chỉ chạy sau khi có chấp thuận cho môi trường đích. Không có thao tác seed trong đợt viết tài liệu này.
