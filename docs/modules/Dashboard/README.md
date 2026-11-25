# Dashboard — Intelex Workspace

## Audit và nguồn dữ liệu

Không có Dashboard API/component trước thay đổi này. Dự án dùng DbContext + services trực tiếp (không có repository chung), trạng thái nghiệp vụ là string đã được các module validation. Không thêm entity, bảng, migration hay quyền ngầm theo tên role.

| Module | Nguồn hiện có | Cách dùng |
|---|---|---|
| Employees | Employee, EmployeeHistory; employees | EmploymentStatus ACTIVE, HireDate; current headcount và hires theo kỳ |
| Organization | Department, Team, Position | Phòng ban từ Employee.DepartmentId; Team/manager đã dùng ở workflow, không cấp quyền bởi chức danh |
| Work / Attendance | WorkSchedule, Shift, Attendance, AttendanceAdjustment | Tái sử dụng AttendanceManagementService.BuildReadSql: employees × ngày LEFT JOIN schedules/punches, EXISTS approved leave; snapshot giờ ca, ca qua đêm, cửa sổ hợp lệ |
| Timesheets | TimesheetPeriod, TimesheetDetail | Attendance read model biết kỳ khóa; Dashboard không thay đổi công hoặc suy đoán giờ thực tế từ công quy đổi |
| Leave | LeaveRequest, LeaveBalance | APPROVED/CANCELLATION_PENDING; balance theo năm, chỉ chính chủ ở my-overview |
| Approvals | ApprovalRequest, ApprovalStep | Chỉ bước PENDING đầu tiên đang giao đúng user; scope theo người gửi, quyền domain của Payroll/KPI |
| KPI | KpiTarget, KpiPeriod | Trạng thái thật, FinalScore chỉ APPROVED; kỳ KPI giao với tháng hoặc legacy PeriodKey |
| Payroll | PayrollPeriod, PayrollDetail, PayrollPolicy | Tổng GrossSalary/Deductions/NetSalary từ kết quả tính đã snapshot và có InputHash, tách REVIEW/APPROVED/LOCKED/PAID; không sum salary_profiles |
| Contracts | Contract | ACTIVE, đã bắt đầu, EndDate từ hôm nay đến hôm nay +30 ngày |
| Notifications | NotificationRecipient, Notification | NotificationService inbox chỉ recipient đăng nhập và PUBLISHED |
| Authorization | JWT, ScreenPermission, IPermissionService, EmployeeDataScope | Live grants theo từng module/action; không suy ADMIN/HR/MANAGER từ role code |

## API và quyền

Tất cả route GET, JWT bắt buộc; response `{success:true,data:...}` và Cache-Control no-store. Không có screen WEB_DASHBOARD mới: khả năng xem từng chỉ tiêu kế thừa quyền nguồn. Dashboard có thể truy cập sau login, nhưng không tự cấp quyền dữ liệu khác.

Query chung: `year=2026&month=10&departmentId=1`. Year 2000..2100, month 1..12; mặc định năm/tháng hiện tại Asia/Ho_Chi_Minh. Filter phòng ban là tùy chọn, luôn giao với scope, không mở rộng scope; lọc ngoài scope trả403. my-overview luôn chính chủ, UI không áp filter phòng ban vào phần cá nhân.

| Endpoint | Quyền dữ liệu |
|---|---|
| `/api/dashboard/summary` | Composite: WEB_EMPLOYEES VIEW (employees); WEB_ATTENDANCE VIEW (attendance); WEB_LEAVE_REQUESTS VIEW (approvedLeaveRequests); WEB_CONTRACTS VIEW (expiringContracts), mỗi phần scope riêng. Thiếu quyền phần nào trả null phần đó; lỗi dữ liệu/config trả lỗi, không đổi thành 0 |
| `/api/dashboard/attendance-trend` | WEB_ATTENDANCE VIEW + scope |
| `/api/dashboard/department-distribution` | WEB_EMPLOYEES VIEW + scope |
| `/api/dashboard/pending-tasks` | WEB_APPROVALS VIEW + scope; chỉ công việc đang đến lượt user có APPROVE + scope, loại trừ tự duyệt khi policy cấm, nhân viên được gán khác liên kết hiện tại; Payroll/KPI kiểm tra thêm VIEW/APPROVE domain |
| `/api/dashboard/kpi-overview` | WEB_KPI_EVALUATION VIEW + scope |
| `/api/dashboard/payroll-overview` | WEB_PAYROLL VIEW + scope nhân viên; không cần quyền hồ sơ nhân viên để được cấp quyền xem lương |
| `/api/dashboard/my-overview` | JWT; identity liên kết user ACTIVE. Attendance cần WEB_MY_ATTENDANCE VIEW; leave cần WEB_LEAVE_BALANCES VIEW; phiếu lương cần WEB_MY_PAYSLIPS VIEW — các phần này chỉ ownership, không scope. KPI cần WEB_KPI_EVALUATION VIEW, scope rồi giới hạn chính chủ. Thông báo chỉ inbox chính chủ |

Quyền theo vai trò thực tế:
- ADMIN/HR có scope ALL thấy số liệu toàn công ty ở các module được cấp quyền; HR không có Payroll không có số liệu lương.
- Manager DEPARTMENT chỉ thấy nhân viên thuộc phòng ban hiện tại của nhân viên liên kết user.
- Employee SELF/personal screens chỉ thấy dữ liệu cá nhân. Không bao giờ nhận quỹ lương người khác qua my-overview.
- Quyền hiển thị không thay quyền giao dịch tại màn hình đích. Người được giao duyệt không tự được cấp quyền đọc dữ liệu lương.

## Response DTO

| API | Các trường `data` |
|---|---|
| summary | `period`, `employees? {active,newHires,departures?,departuresNote}`, `attendance?`, `approvedLeaveRequests?`, `expiringContracts?` |
| attendance-trend | `period`, `scope`, `totals`, `days: [{date,metrics}]`; metrics gồm scheduled, eligible, present, late, early, absent, missingCheckIn, missingCheckOut, onLeave, unverified và presenceRate/lateRate/earlyRate/missingRate nullable |
| department-distribution | `[{departmentId,departmentName,employees}]` |
| pending-tasks | `total`, `items: [{id,requestType,employeeName,stepNo,createdAt,href}]` |
| kpi-overview | `period`, `assigned`, `approved`, `averageApprovedScore?`, `statuses: [{status,count}]` |
| payroll-overview | `period`, `scope`, `currency`, `employees`, `gross`, `deductions`, `net`, `statuses: [{status,employees,gross,deductions,net}]` |
| my-overview | `period`, `employeeLinked`, `employeeId?`, `employeeName?`, `attendance?`, `leave? {entitled,used,reserved,remaining,available}`, `kpi?`, `payroll?`, `unreadNotifications`, `notifications` (NotificationItem hiện có, tối đa5) |

`period = {periodKey,from,to,asOfDate}`. Các date là yyyy-MM-dd; timestamp trả UTC. Các chỉ tiêu bị ẩn vì quyền là null, không phải0. Empty hợp lệ trả mảng rỗng/count0; rate/average chưa có mẫu số trả null. Sai query400, JWT thiếu/không hợp lệ401, thiếu quyền/scope403, cấu hình nguồn chưa khởi tạo hoặc nhiều currency409. Không log payload lương.

## Định nghĩa chỉ tiêu

- `employees.active`: headcount ACTIVE tại ngày gọi (`period.asOfDate`), không phải headcount lịch sử cuối tháng. `newHires`: HireDate trong tháng chọn. Không có termination date hoặc audit trạng thái đủ chi tiết nên `departures=null` và note rõ; không suy số người nghỉ từ CreatedAt hay số hợp đồng hết hạn.
- Attendance: `scheduled` là lượt ca đã có đến hôm nay; `eligible` là ca có snapshot hợp lệ, đã hết cửa sổ check-in, không nghỉ phép/không ngày lễ. `present` có ít nhất một lượt punch trong các ca đủ điều kiện. Các rate cùng mẫu số eligible; không có mẫu số trả null, không fake 0%. `absent` chỉ sau CheckOutCloseUtc và thiếu cả hai lượt; thiếu checkout chỉ khi đã quá cửa sổ checkout. Không đếm ca tương lai. `missingRate` = (absent + missingCheckIn + missingCheckOut)/eligible. Late và Early là hai chỉ tiêu độc lập. `onLeave` là lượt nhân viên/ngày có approved leave, không phải tổng RequestedDays hay số ngày phép bị trừ; `approvedLeaveRequests` đếm đơn giao với tháng.
- Ca qua đêm gắn theo WorkSchedule.WorkDate và snapshot UTC; timezone nghiệp vụ Việt Nam. Snapshot thiếu trả `unverified`, không tự đoán ABSENT. Công HR quy đổi đủ ngày không xóa vi phạm hoặc thay giờ thực tế trong Dashboard.
- Distribution: nhân viên ACTIVE hiện tại đã tuyển, gom phòng ban; phòng không có nhân viên trong scope không trả tên/số lượng.
- KPI: số target theo trạng thái. Chỉ APPROVED có FinalScore mới vào average. Chưa có điểm trả null; tháng giao quý/năm có thể thấy target thuộc kỳ dài đó. Không tự đặt ngưỡng đạt 100%.
- Payroll: chỉ dòng có CalculationSnapshot thật và kỳ có InputHash; quản lý xem REVIEW/APPROVED/LOCKED/PAID, cá nhân chỉ LOCKED/PAID. Tổng tiền giữ DECIMAL ở MySQL; trạng thái REVIEW không có nghĩa đã thanh toán. Tách currency; nếu scope có nhiều currency trả409 để tránh cộng tiền khác đơn vị. VND được format trên UI, không lấy base salary thay thực lĩnh.
- Pending: backlog hiện tại, không cắt theo tháng chọn vì có phiếu tháng trước chưa xử lý. Filter phòng ban theo người gửi; total đếm đầy đủ, items tối đa20 theo thời gian mới nhất, link đến Approval Center để xử lý/phân trang. Payroll scope độc lập: WEB_APPROVALS theo sender, WEB_PAYROLL theo nhân viên nhận lương.
- Contracts sắp hết hạn dùng hôm nay +30 ngày, không neo vào tháng quá khứ. Chưa có hợp đồng phù hợp trả0 nếu có quyền, không có quyền trảnull.
- Leave balance: tổng phép các loại theo năm chọn, remaining = entitled + carry + adjustment − used; available trừ thêm reserved. Đây là số dư hiện hành của năm, không phục dựng số dư cuối tháng quá khứ.

## Frontend

`/#/dashboard` là trang mặc định sau đăng nhập. Dùng layout hiện có, Recharts + React-is cho biểu đồ, lazy-load chart chunk. Filter tháng/phòng, refresh thủ công và khi cửa sổ lấy focus, không polling job. Có skeleton, empty, error từng panel, tooltip, VND, trạng thái chưa có dữ liệu khác lỗi API. Abort request cũ khi đổi filter, không cho response kỳ cũ ghi đè kỳ mới.

Cards/quick actions dùng hash routes hiện tại. Pending link `#/approvals?approvalId={id}` tự mở drawer, vẫn gọi API detail/history có authorization. Scope không dựa vào ẩn UI; client grants chỉ quyết định request/hiển thị module. Không có số liệu mock. Phần cá nhân và inbox không bị filter phòng ban của khối quản lý.

## Kiểm thử và triển khai

- DashboardTests: dữ liệu tháng10/2026 trong SQLite cô lập; lịch không có attendance, missing checkout, leave, late+early, chưa hết cửa sổ, scope phòng ban/SELF, KPI, số lương thực tế và chỉ phiếu đã phát hành, thiếu quyền, live revocation, pending đúng bước, rỗng, query invalid/JWT.
- Dashboard.test.jsx: loading, API thật qua mock transport, zero vs lỗi, route cards/tasks, không gọi managed Payroll khi thiếu quyền, filter/refetch, response cũ, notification read, VND.
- ApiInventoryTests: 211 routes duy nhất; JWT + quyền nguồn có chủ đích ở composite/personal endpoint.
- [Kiểm thử Railway DEV](DEV_CHECKS.md): opt-in MySQL read-only, không migration/seed/background worker. Chưa được thực thi nếu chưa cấu hình môi trường.
- Không có migration hoặc database table mới. Không tự deploy hoặc đổi Railway.

## Kết quả kiểm tra cục bộ (25/11/2026)

Backend build thành công. Toàn bộ `dotnet test`: 665 passed, 9 failed thuộc EmployeeCreationTests (test kỳ vọng prefix NV, generator hiện trả TX), 1 skipped là MySQL DEV opt-in vì thiếu connection/actor. Không sửa generator hoặc test cũ ngoài phạm vi Dashboard. Dashboard và inventory tests đều passed. Frontend `npm test`: 97 passed; `npm run build` thành công, biểu đồ thành chunk riêng. Bộ dependency có các advisory dev-tool Vitest/tinypool đã tồn tại; không tự nâng major hoặc chạy audit fix force trong thay đổi Dashboard.

## File tạo/sửa

- Tạo Backend: `Modules/Dashboard/Controllers/DashboardController.cs`, `DTOs/DashboardDtos.cs`, `Services/DashboardService.cs`, `Services/DashboardPending.cs`. Đăng ký DI tại `Program.cs`.
- Tạo Frontend: `src/dashboard/Dashboard.jsx`, `DashboardCharts.jsx`, `dashboard.css`, `Dashboard.test.jsx`; sửa `main.jsx` (route/menu/default), `approvals/ApprovalCenter.jsx` và test (deep link), package.json/lock (Recharts, React-is, testing-library DOM).
- Tests Backend: `DashboardTests.cs`, `DashboardMySqlDevTests.cs`; cập nhật `ApiInventoryTests.cs`.
- Tài liệu: README này, DEV_CHECKS.md, `docs/API/README.md`, hai bản Postman collection, docs index và web-admin README.
