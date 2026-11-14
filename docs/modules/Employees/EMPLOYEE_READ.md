# Employee GET — Tên tổ chức, projection và audit migration

[API Specification](PROFILES_API.md#response-đọc-nhân-viên-và-tên-danh-mục) · [JSON list](../../API/employee-list-response.sample.json) · [JSON detail](../../API/employee-detail-response.sample.json) · [Database](../../guides/DATABASE.md)

## Audit source/configuration/snapshot

| Quan hệ | Mapping hiện có | Migration trong source |
| --- | --- | --- |
| Employee → Department | employees.DepartmentId INT NOT NULL → departments.Id INT, Restrict; tên departments.DepartmentName VARCHAR(150) | InitialHRMDatabase |
| Employee → Position | employees.PositionId BIGINT NULL → positions.id BIGINT, Restrict; tên positions.name VARCHAR(150) | 20261114091114_AddEmployeePosition |
| Employee → Team | employees.TeamId INT NULL; composite FK (TeamId, DepartmentId) → teams.(Id, DepartmentId), Restrict | 20261114092818_AddTeamsAndEmployeeTeam |
| Team → Department | teams.DepartmentId INT NOT NULL → departments.Id, Restrict | AddTeamsAndEmployeeTeam |

Employee.Id/EmployeeCode và các field hồ sơ giữ nguyên. Team và Position là quan hệ tùy chọn; Department bắt buộc trong model hiện tại. Response names được khai báo string? và LEFT JOIN giữ row nếu danh mục legacy bị thiếu, không đổi DepartmentId thành nullable hoặc bỏ ràng buộc dữ liệu.

Current AppDbContextModelSnapshot có TeamId/PositionId, cả hai FK/index và mapping catalog. Không thay entity/configuration/migration/snapshot cho thay đổi GET này; không cần migration mới. Model/snapshot được kiểm tra offline trong test hiện có.

## Trạng thái DB đích: chưa xác minh, không suy đoán đã apply

`DefaultConnection` không có giá trị trong appsettings.json/appsettings.Development.json được kiểm tra trong checkout. Chưa có kết quả truy vấn schema hoặc __EFMigrationsHistory từ DB đích trong lần sửa này. Cấu hình runtime/user-secrets bên ngoài source có thể khác; báo cáo này không kết luận migration đang pending hoặc đã applied tại Railway.

| Migration | Có trong source | Applied/Pending trên DB đích |
| --- | --- | --- |
| 20261114091114_AddEmployeePosition | Có | Chưa xác minh |
| 20261114092818_AddTeamsAndEmployeeTeam | Có | Chưa xác minh |

Nếu DB đích thiếu PositionId/TeamId, operator cần đối chiếu schema và migration history trước khi chạy binary; không tạo lại migration trùng và không thay bằng field NULL giả trong query. Model khớp snapshot không chứng minh DB đã có cột. Việc này không tự apply migration hoặc deploy.

Có thể kiểm tra metadata read-only trên môi trường được phê duyệt:

```sql
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME IN ('employees', 'departments', 'teams', 'positions')
  AND COLUMN_NAME IN ('DepartmentId', 'DepartmentName', 'TeamId', 'TeamName', 'PositionId', 'Id', 'id', 'name');

SELECT TABLE_NAME
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '__EFMigrationsHistory';
```

Nếu __EFMigrationsHistory tồn tại, đọc các ID và đối chiếu với migrations trong source:

```sql
SELECT MigrationId
FROM __EFMigrationsHistory
WHERE MigrationId IN ('20261114091114_AddEmployeePosition',
                      '20261114092818_AddTeamsAndEmployeeTeam');
```

Các câu trên là hướng dẫn kiểm tra, không được thực thi lên DB live trong lần triển khai này. Migration history và cột thực tế đều cần kiểm tra nếu môi trường từng chỉnh DDL thủ công.

## Contract và truy vấn

Giữ `GET /api/employees`, `GET /api/employees/{id}`, route/ScreenPermission WEB_EMPLOYEES/VIEW và các scope SELF/DEPARTMENT/ALL. Detail ngoài scope/không tồn tại vẫn 404; thiếu JWT401, thiếu action/scope403. Không thêm scope Team, không yêu cầu quyền catalog chỉ để đọc tên trong hồ sơ được phép xem.

EmployeeDto giữ 13 field cũ và bổ sung departmentName, positionName nullable; teamName đã có trước. Các field bắt buộc theo yêu cầu đều có: id, employeeCode, fullName, email, departmentId/name, teamId/name, positionId/name, employmentStatus. dateOfBirth, phoneNumber, hireDate, createdAt vẫn có để tương thích. List giữ success/total/page/pageSize/data, detail vẫn object trực tiếp. `/unlinked` cũng dùng DTO/projection này.

EmployeeService.ProjectEmployees dùng query syntax `select new EmployeeDto` (EF Select), AsNoTracking và LEFT JOIN cả ba bảng. Team JOIN đồng thời TeamId/DepartmentId để giữ đúng quan hệ. Không Include/materialize entity để map trong memory cho GET, không gọi một query catalog trên mỗi nhân viên. Không lọc IsActive của catalog trong projection, giữ tên của liên kết hiện có sau khi catalog ngừng hoạt động.

Thứ tự: auth/scope → Employee filter → Count → OrderBy(Id) → Skip/Take → JOIN/Select DTO. Phần dữ liệu list có một query Count và một query rows với JOIN cho cả trang; các query xác thực/scope hiện có có số lượng cố định. Detail chỉ có một query rows sau bước scope. Mọi bảng catalog có key unique nên JOIN không nhân đôi Employee hoặc làm sai Count.

Response tạo/sửa/chuyển Department dùng cùng projection sau khi save và trước commit; quyền ghi/scope tương ứng giữ nguyên, không yêu cầu thêm VIEW. Điều này tránh trả names cũ/null do navigation chưa load khi trả EmployeeDto. Contracts/history DTO và nghiệp vụ không đổi.

## Frontend

Checkout web-admin trống trước lần thay đổi này; bổ sung React/Vite Employees list/detail/editor dùng API thật. List/detail đọc trực tiếp departmentName/teamName/positionName, hiển thị trạng thái chưa gán khi null, không tải cả catalog hoặc find/map để ghép tên. Tên/ID không hardcode runtime.

Editor được mount riêng khi mở tạo/sửa, lúc đó mới nạp `/api/departments`, `/api/teams?departmentId=...`, `/api/positions` cho dropdown theo quyền hiện có. Đổi Department khi tạo reset Team; mã Employee chỉ đọc/tự sinh như contract cũ. Không thay các API catalog hoặc tự cấp quyền. [Hướng dẫn frontend](../../../web-admin/README.md).

## File và kiểm chứng

- `backend/HRM.API/Modules/Employees/DTOs/EmployeeDtos.cs`: departmentName/positionName nullable, giữ field cũ.
- `backend/HRM.API/Modules/Employees/Services/EmployeeService.cs`: projection dùng chung, GET no-tracking/scoped, response write lấy names trước commit.
- `backend/HRM.API.Tests/EmployeeReadApiTests.cs`: tên, null, legacy LEFT JOIN, inactive catalogs, RBAC/scope/paging, query count và no-tracking.
- `backend/HRM.API.Tests/EmployeeApiTests.cs`: bổ sung hook SQL interceptor trong test harness, không đổi production DB config.
- `web-admin/src/Employees.jsx`, `EmployeeEditor.jsx`, `api.js`, `main.jsx`, `styles.css`, `Employees.test.jsx`, cấu hình React/Vite.
- Profiles API, Postman Collection (hai bản), JSON response samples, Database/README/Tests docs.

Kết quả kiểm chứng:

- Test API đọc mới: 9/9 đạt; bộ EmployeeReadApiTests + EmployeeApiTests ban đầu 22/22 đạt trước khi thêm test legacy LEFT JOIN.
- Frontend: 6/6 component tests đạt; Vite production build thành công.
- Toàn bộ backend: 237 tests, 228 passed / 9 failed / 0 skipped. Cả 9 failed thuộc EmployeeCreationTests cũ: source HEAD đã dùng prefix TX nhưng các expected value còn NV (bao gồm case legacy collision được dựng bằng NV). File EmployeeCodeGenerator và EmployeeCreationTests không thay đổi trong tác vụ này. Không đổi prefix hoặc chỉnh test tạo mã ngoài phạm vi GET để che lỗi.
- Model/snapshot/migration tests hiện có nằm trong nhóm passed; không có thay đổi entity/configuration/snapshot.
- dotnet build thành công: 0 warnings / 0 errors. Frontend production build đạt. Hai Postman Collection hợp lệ với 62 request examples / 58 endpoint; 3 response GET chứa đủ trường ID/name, giữ envelope list. JSON samples, local links và git diff --check đạt.

 Không tạo/apply migration, không chỉnh dữ liệu DB live, không deploy Railway. Kiểm thử SQLite/TestServer và snapshot offline không thay thế kiểm thử migration trên bản sao MySQL được phê duyệt.
