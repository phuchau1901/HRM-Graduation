# Teams — Đội nhóm

[API](TEAMS_API.md) · [Kiểm thử](TEAMS_TESTS.md) · [Database và migrations](../../guides/DATABASE.md) · [Frontend](../../../web-admin/README.md)

Một Department có nhiều Team; Team thuộc đúng một Department. Employee có thể chưa gán Team (`TeamId = null`). Khi đã gán, Team phải thuộc cùng Department với Employee. Team không tạo thêm loại data scope.

Source: `backend/HRM.API/Modules/Organization/`. Danh mục Team dùng mã quyền riêng `WEB_TEAMS` với `VIEW`, `NEW`, `UPDATE`, `DELETE`. Không suy quyền từ role ADMIN, không tự cấp quyền cho mọi role.

## Audit model trước triển khai

Đối chiếu source và snapshot, không kết nối database live:

| Thành phần | Trạng thái trước Teams | Quyết định triển khai |
| --- | --- | --- |
| Department | `departments.Id` INT; DepartmentCode unique; IsActive; quan hệ Employee Restrict | Giữ mapping, bổ sung collection Teams và kiểm tra tham chiếu khi xóa |
| Employee | `employees.Id` INT; DepartmentId INT NOT NULL; PositionId BIGINT NULL | Thêm TeamId INT NULL; không đổi ID, phòng ban, vị trí hoặc dữ liệu cũ |
| Position | `positions.id` BIGINT; Code unique; IsActive; FK PositionId Restrict | Không đổi model Position |
| Snapshot | Đã có `20261114091114_AddEmployeePosition` và scope metadata | Migration Teams kế tiếp, không viết lại migration cũ |
| Employee history | Lịch sử điều chuyển phòng ban có ngày hiệu lực và rule chống lùi ngày | Giữ nguyên; chuyển Team ghi AuditLog có before/after, không tạo dòng điều chuyển phòng ban giả |
| RBAC/scope | Grant chuẩn qua RoleDetail; scope SELF/DEPARTMENT/ALL theo screen/action | Dùng WEB_TEAMS cho catalog; giữ nguyên scope nhân viên |
| Frontend | `web-admin/` trống | Bổ sung React/Vite local cho Organization và Employees |

## Tính toàn vẹn và tương thích

- `teams.TeamCode` unique toàn hệ thống, normalize uppercase; DepartmentId của Team cố định sau khi tạo.
- FK `teams.DepartmentId → departments.Id`, Restrict.
- Alternate key `(teams.Id, teams.DepartmentId)` và composite FK `(employees.TeamId, employees.DepartmentId)` bảo vệ đúng phòng ban, kể cả ghi ngoài API. TeamId null vẫn hợp lệ.
- Xóa Team có nhân viên trả 409; ngừng hoạt động Team giữ các liên kết hiện có. Gán mới/đổi Team yêu cầu Team và Department hoạt động.
- PATCH chuyển phòng ban nhận TeamId của phòng mới; không gửi/null thì gỡ Team cũ trong cùng transaction.
- PUT hồ sơ không gửi teamId giữ Team hiện tại; gửi null gỡ Team. GET trả thêm TeamId, TeamName, kể cả `/unlinked`.
- Thay đổi Team của Employee tạo audit `EMPLOYEE_TEAM_CHANGED`, actor JWT, before/after TeamId và DepartmentId, traceId; cùng transaction với hồ sơ và notification. CRUD Team cũng có audit.

## Quyền và rollout

Migration chỉ tạo schema, không tạo screen hoặc grant. Quản trị viên có quyền quản lý screens có thể đăng ký screen `WEB_TEAMS` qua `POST /api/screens`, sau đó cấp grant có chọn lọc qua `PUT /api/roles/{roleId}/permissions` theo quy trình hiện có, dùng ETag/If-Match. Không sửa role đang gán cho actor. Người dùng đăng nhập lại sau thay đổi quyền.

UI cần `WEB_DEPARTMENTS/VIEW` để chọn Department, `WEB_TEAMS/VIEW` để chọn Team, và quyền nhân viên phù hợp để lưu. Quyền xem Team không mở quyền xem nhân viên. Chỉ các scope `SELF`, `DEPARTMENT`, `ALL` được hỗ trợ; không nhận `TEAM` như scope mới.

Migration `20261114092818_AddTeamsAndEmployeeTeam` đã được tạo, chưa apply DB. Cần áp dụng schema qua quy trình được phê duyệt trước khi chạy binary mới. Không seed dữ liệu, không deploy Railway trong thay đổi này.
