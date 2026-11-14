# EmployeeCode tự động và tạo User kèm Employee

[Profiles API](PROFILES_API.md#employeecode-tự-động-chỉ-đọc) · [Users API](../Authorization/USERS_API.md#tạo-user-kèm-employee-trong-một-transaction) · [Database](../../guides/DATABASE.md) · [Frontend](../../../web-admin/README.md)

## Audit

- Employee.Id là INT AUTO_INCREMENT/ValueGeneratedOnAdd, EmployeeCode VARCHAR(20) NOT NULL có unique index, DepartmentId INT NOT NULL, TeamId INT NULL và PositionId BIGINT NULL.
- EmployeeCreateRequest trước đây bắt buộc code client; nay bỏ field đó. DTO sửa thực tế là EmployeeProfileRequest, trước/sau đều không có field sửa code.
- EmployeesController giữ route/permissions/status; POST trả EmployeeDto sau khi transaction commit, có mã server cấp. Không thêm endpoint.
- Users.EmployeeId có FK Restrict đến Employees.Id và unique index uq_users_employee_id; EmployeeService và AdministrationService dùng chung scoped AppDbContext.
- Kiểm tra Configuration, Initial migration và current snapshot; không truy cập DB live để xác nhận schema/counter. Không thay đổi entity/configuration/snapshot hoặc thêm migration trong thay đổi này.
- Attendance/Contracts/History liên kết theo Employee.Id; không đổi ID/FK, không renumber mã cũ. Team/Department/Position validation và SELF/DEPARTMENT/ALL giữ nguyên.

## Thuật toán và transaction

EmployeeCodeGenerator lấy Id từ insert trong explicit transaction; code tạm unique dài 20 ký tự chỉ tồn tại trong transaction chưa commit. Dùng code chính thức `NV` + Id (`D6`, invariant culture) và save trước khi trả kết quả. Không SELECT MAX + 1, không process-local counter, không yêu cầu code client. Nếu mã theo Id đã tồn tại trong dữ liệu legacy, bỏ row provisional vừa tạo để tiêu thụ slot Id và thử Id kế tiếp. Không sửa row legacy. Unique/NOT NULL vẫn được database enforce.

Public EmployeeService.CreateAsync sở hữu transaction và gọi core CreateInTransactionAsync. API User dùng core đó trong transaction hiện có của AdministrationService: chỉ có một commit cho User/Employee/code/UserRoles/audit. Không nested transaction và không commit Employee trước User. Lỗi dữ liệu, database hoặc recovery guard rollback toàn bộ. Deadlock/lock-timeout MySQL 1213/1205 có thể retry cả transaction tối đa 3 lần, sau rollback/clear tracking; quyền được kiểm tra lại. Không retry duplicate key hoặc lỗi connection/commit có kết quả chưa xác định.

AUTO_INCREMENT MySQL 8 cấp Id độc lập giữa connection và không dùng lại high-water mark theo luồng API. DELETE Employee là deactivation. Không reset/reseed/truncate bảng để cấp lại Id; thao tác operator ngoài API phải bảo toàn identity. Code có thể nhảy số, không cam kết liên tục. Mã đã trả thành công giữ nguyên qua cập nhật hồ sơ, chuyển Department/Team/Position. Mã từ rollback chưa bao giờ được trả là mã đã cấp thành công.

## API contract

POST /api/employees: [JSON request](../../API/employee-create.sample.json). Không có employeeCode trong request. Code client gửi thêm bị bỏ qua. Response 201 có Id, employeeCode và toàn bộ EmployeeDto hiện có.

POST /api/users: [JSON request kèm Employee](../../API/user-create-with-employee.sample.json). Bổ sung createEmployee=false mặc định và employee?; createEmployee=true cần employee, cấm employeeId đồng thời. False giữ hai chế độ cũ: không liên kết hoặc gắn EmployeeId chưa có user. Không gửi employee khi false. Thêm employeeCode nullable vào AdminUserDto, bao gồm response tạo User/list/detail/mutation, không trả thêm Employee PII.

RBAC: User cần WEB_USERS/NEW; tạo kèm Employee cần live WEB_EMPLOYEES/NEW và NEW scope ALL hoặc DEPARTMENT đúng phòng. SELF không được tạo. RoleIds không rỗng vẫn cần WEB_USERS/APPROVE và không vượt quyền actor. Không tự cấp grant/role. User email và Employee email được validate riêng, không tự ghi đè nhau.

## File thay đổi chính

- `Modules/Employees/DTOs/EmployeeDtos.cs`: bỏ EmployeeCreateRequest.EmployeeCode.
- `Modules/Employees/Services/EmployeeCodeGenerator.cs`: sinh code theo identity, xử lý slot legacy và yêu cầu transaction.
- `Modules/Employees/Services/CreationTransactionRetry.cs`: retry giới hạn chỉ với deadlock/lock-timeout MySQL sau rollback.
- `Modules/Employees/Services/EmployeeService.cs`: chia public transaction và core dùng chung; validation không đổi quyền/scope.
- `Modules/Authorization/DTOs/AdministrationDtos.cs`: createEmployee/employee, validation tương hỗ, response EmployeeCode.
- `Modules/Authorization/Services/AdministrationService.cs`: tạo User kèm Employee atomic, live quyền bổ sung và trả code metadata.
- `Program.cs`: đăng ký EmployeeCodeGenerator.
- `EmployeeCreationTests.cs`: concurrency với nhiều connection SQLite/WAL, mã đầu/dữ liệu legacy, code readonly, database failures, rollback user/employee/roles/audit, quyền và compatibility.
- Test fixtures/callers: `AuthenticationApiTests.cs`, `AdministrationApiTests.cs`, `EmployeeApiTests.cs`, `TeamApiTests.cs`.
- `web-admin/src/forms.jsx`, `main.jsx`, `api.js`, `styles.css`, `forms.test.jsx` và cấu hình React/Vite.
- Profiles/Users API, hai Postman Collection, API inventory, tài liệu Database và JSON samples cập nhật cùng contract.

Các đường dẫn Modules/Program tính từ `backend/HRM.API`; test files từ `backend/HRM.API.Tests`.

## Kết quả kiểm chứng

- Backend: 228/228 tests đạt; includes model/snapshot checks và các tests User/Employee/Contracts/Team/Department/Position hiện có.
- Frontend: 6/6 component tests đạt, production build thành công.
- Concurrency: 10 request bắt đầu đồng thời, scoped contexts/connection riêng tới file SQLite/WAL; tất cả 201, mã/Id duy nhất và đúng format. Không gọi chung một SQLite connection cho bài test này.
- Database fault injection: lỗi bước update code và lỗi insert User sau khi Employee đã save đều rollback, không row provisional/orphan/role/audit tạo dở. Guard phục hồi quản trị lỗi cũng rollback cả hai.
- Kiểm thử không apply migration hoặc kết nối MySQL live. Source schema không đổi nên không cần migration mới. Không sửa dữ liệu legacy và không deploy Production/Railway.
