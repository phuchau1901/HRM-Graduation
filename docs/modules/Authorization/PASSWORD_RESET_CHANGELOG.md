# Reset password và gộp Teams vào Organization — Báo cáo thay đổi

Ngày: 2026-11-14. [API contract chi tiết](USERS_API.md#post-apiuserstargetuseridreset-password) · [Chính sách bảo mật](SECURITY.md).

## Audit trước thay đổi

Endpoint có sẵn `POST /api/users/{userId}/reset-password` nằm trong UsersController; route userId chính là targetUserId trong tài liệu. Contract cũ cần WEB_USERS/APPROVE, If-Match và currentPassword của actor, trả 200 AdminUserDto. ChangeUser xử lý reset cùng các mutation quản trị, dùng PasswordService, Dominates, catalog lock, EnsureRecovery, auth_version và refresh-token revocation.

Callers trong repo: AdministrationApiTests và hai Postman Collection. Web-admin chưa có runtime caller reset cũ; nay thêm trang mật khẩu. Không tìm thấy caller runtime trong mobile-app. Không thể xác nhận các client ngoài repo; client cũ cần đổi contract khi tích hợp.

## Contract mới trên route hiện có

| Type | Body | Authorization |
| --- | --- | --- |
| SELF_CHANGE | type, oldPassword, newPassword | JWT chính chủ, verify oldPassword; không cần WEB_USERS grant/bootstrap |
| ADMIN_RESET | type, newPassword | Actor khác target; live WEB_USERS/UPDATE và Dominates, giữ bảo vệ quản trị |

Thành công 204 không body, không If-Match. NewPassword 12..128, không blank. Confirm chỉ ở frontend. CurrentPassword cũ không còn là contract; thiếu type trả 400. ADMIN_RESET không dùng oldPassword để xác thực. Generic authentication failure 401, denied403, target missing404 sau kiểm tra quyền, rate429. Recovery guard hiện có vẫn có thể trả409 và rollback.

PasswordService/JWT/AuthService không sửa. Hash/salt mới, auth_version tăng một lần, refresh token bị revoke và success audit commit cùng transaction. Failed attempts được audit sau rollback, không serialize request/credential. Quota chung 5/phút/actor/API instance; rate-limited audit type UNKNOWN vì limiter chạy trước body binding. Auth middleware failures giữ cơ chế log hiện có.

## File backend cho reset password

- `backend/HRM.API/Modules/Authorization/DTOs/AdministrationDtos.cs`: PasswordResetTypes và DTO/conditional validation.
- `backend/HRM.API/Modules/Authorization/Controllers/AdministrationControllers.cs`: giữ route, conditional service authorization, 204, generic Auth error và audit filter.
- `backend/HRM.API/Modules/Authorization/Services/AdministrationService.cs`: ResetPassword riêng, live UPDATE/Dominates, identity check từ DB, transaction/credential/revocation; bỏ reset khỏi ChangeUser.
- `backend/HRM.API/Modules/Authorization/Services/PasswordResetAudit.cs`: success metadata builder, failure filter, audit sau rollback và 429.
- `backend/HRM.API/Program.cs`: đăng ký filter và audit rate-limit rejection; giữ chính sách quota hiện có.
- `backend/HRM.API.Tests/PasswordResetApiTests.cs`: tests mới cho cả hai mode, policy, live authorization, token/refresh, audit và rollback.
- `backend/HRM.API.Tests/AdministrationApiTests.cs`: cập nhật caller/tests contract cũ và tái sử dụng test fixture.
- `backend/HRM.API.Tests/ApiInventoryTests.cs`: reset là trường hợp conditional permission ở service, vẫn có Authorize và rate-limit/filter; business routes khác giữ ScreenPermission.

## Gộp Teams vào Organization

Năm file chuyển từ `Modules/Teams` sang `Modules/Organization`, đổi namespace tương ứng:

- `Entities/Team.cs`
- `Configurations/TeamConfiguration.cs`
- `DTOs/TeamDtos.cs`
- `Services/TeamService.cs`
- `Controllers/TeamsController.cs`

Cập nhật tham chiếu trong `Data/AppDbContext.cs`, `Program.cs`, `Modules/Organization/Entities/Department.cs`, `Modules/Employees/Entities/Employee.cs`, `Modules/Employees/Services/EmployeeService.cs`, `TeamApiTests.cs`, `TeamMigrationTests.cs`.

`AppDbContextModelSnapshot.cs` và `20261114092818_AddTeamsAndEmployeeTeam.Designer.cs` chỉ đổi tên namespace CLR của Team. Không đổi Up/Down/SQL/schema; migration Teams cũ vẫn chưa apply. Model/snapshot được test khớp. Giữ route `/api/teams`, `WEB_TEAMS`, quan hệ composite và data scopes cũ.

Tài liệu Teams chuyển vào Organization: `TEAMS.md`, `TEAMS_API.md`, `TEAMS_TESTS.md`. Postman Teams lồng dưới folder Organization; cập nhật liên kết từ README, API inventory, tài liệu Employee và Database.

## Frontend, Postman và đặc tả

- `web-admin/src/PasswordSettings.jsx`, `PasswordSettings.test.jsx`: form SELF old/new/confirm, ADMIN new/confirm và tài khoản đích; không gửi confirm; clear secrets khi đổi mode; SELF thành công yêu cầu login lại.
- `web-admin/src/main.jsx`, `api.js`, `styles.css`: tích hợp trang mật khẩu, xử lý 401 sai oldPassword cho phép retry, giữ logout khi token hết hiệu lực ở các request khác.
- `web-admin/README.md`: hướng dẫn tích hợp và quyền.
- `docs/modules/Authorization/USERS_API.md`, `SECURITY.md`, `TESTS.md`: contract, migration compatibility của caller, audit và tests.
- `docs/HRM-API.postman_collection.json`, `docs/API/HRM-API.postman_collection.json`: hai mẫu SELF_CHANGE/ADMIN_RESET, bỏ If-Match/currentPassword ở route reset, thay biến reauthPassword bằng oldPassword; giữ baseUrl hiện có của từng bản.
- `docs/API/README.md`, `docs/README.md`, `docs/modules/Organization/*`, các tài liệu Employee và `docs/guides/DATABASE.md`: group Teams và cập nhật đường dẫn.

## Kết quả kiểm chứng

- `dotnet build backend/HRM.API/HRM.API.csproj --no-restore`: thành công, 0 warnings / 0 errors.
- `dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj --no-restore`: 207 passed, 0 failed, 0 skipped.
- `npm --prefix web-admin test`: 13 passed.
- `npm --prefix web-admin run build`: thành công.
- Hai Postman Collection: 61 request examples / 58 production endpoints; request JSON và variables hợp lệ; reset body/headers đúng mode; Teams trong Organization.
- `git diff --check` và kiểm tra local documentation links: đạt.

Không tạo migration mới, không chạy migration, không cập nhật DB và không deploy Railway. Tests dùng SQLite/TestServer và SQL/model generation offline; chưa QA trình duyệt với backend live hoặc MySQL production. Không sửa file NOTE.TXT có sẵn trong workspace.
