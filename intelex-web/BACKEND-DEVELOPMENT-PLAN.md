# Kế hoạch phát triển Backend — Intelex ERP

## 1. Mục tiêu

Chuyển hệ thống từ dữ liệu demo/lưu trong `localStorage` sang Backend sử dụng dữ liệu thật trong MySQL, đồng thời đảm bảo:

- Dữ liệu được lưu tập trung trên server.
- Có xác thực JWT.
- Có phân quyền theo role và permission.
- Mỗi tài khoản chỉ xem được dữ liệu thuộc phạm vi của mình.
- Nghiệp vụ nhân sự có trạng thái, lịch sử và audit rõ ràng.
- Frontend chỉ gọi API, không tự xử lý nghiệp vụ quan trọng.

## 2. Hiện trạng Backend

### Đã có nền tảng

- Authentication, JWT, thông tin tài khoản hiện tại.
- Users, Roles, Screens, Permissions.
- Departments, Positions.
- Employees và Employee History.
- Contracts.
- Notifications và SignalR.
- Audit entity và middleware logging.
- Entity/configuration cho Attendance, Leave, Payroll và Performance/KPI.

### Chưa hoàn thiện

- API nghiệp vụ Attendance.
- API Leave, Overtime và Approval Workflow.
- API Projects, Tasks, Milestones và Timeline.
- API Timesheet và Payroll.
- API Performance/KPI.
- API Dashboard và Reports.
- API Documents/File Upload.
- API tra cứu Audit Logs.

## 3. Nguyên tắc phát triển

- Backend là nguồn dữ liệu chính khi chạy production.
- Frontend chỉ dùng permission để ẩn/hiện giao diện; Backend luôn phải kiểm tra quyền lại.
- Không dùng role switch hoặc `localStorage` làm cơ chế bảo mật.
- Mọi nghiệp vụ quan trọng phải xử lý trong service Backend.
- Dữ liệu nhạy cảm như lương, quyền và audit phải giới hạn theo role/data scope.
- Mỗi module phải có migration, validation, phân quyền, audit và test.
- Dùng soft delete nếu dữ liệu cần giữ lịch sử.
- API phải hỗ trợ phân trang, lọc và sắp xếp.

## 4. Lộ trình phát triển

## Giai đoạn 0 — Chuẩn hóa nền tảng

### Công việc

- Chuẩn hóa response thành công và response lỗi.
- Chuẩn hóa validation error.
- Chuẩn hóa phân trang.
- Bổ sung `createdAt`, `updatedAt`, `createdBy`, `updatedBy`.
- Bổ sung soft delete khi cần.
- Kiểm tra foreign key và migration.
- Hoàn thiện xử lý exception tập trung.
- Hoàn thiện logging.
- Cấu hình Development, Staging và Production.
- Bật Swagger/OpenAPI cho môi trường phát triển.

### Kết quả

- Tất cả API có response đồng nhất.
- Lỗi validation và lỗi quyền trả đúng HTTP status.
- Database migrate được từ đầu ổn định.

## Giai đoạn 1 — Authentication và Authorization

### Chức năng

- Đăng nhập, đăng xuất và refresh token.
- Thu hồi refresh token.
- Lấy user hiện tại và permissions.
- Đổi mật khẩu.
- Reset mật khẩu.
- Khóa/mở khóa tài khoản.
- Giới hạn đăng nhập sai.
- Phân quyền theo user, role, screen, action và data scope.
- Kiểm tra quyền ở từng API.

### API dự kiến

```http
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/auth/me
GET  /api/auth/permissions
POST /api/auth/change-password
```

## Giai đoạn 2 — Organization, Employees và Contracts

### Employees

- Danh sách, tìm kiếm, lọc và phân trang nhân viên.
- Thêm/sửa hồ sơ.
- Đổi phòng ban, chức vụ và team.
- Tạm ngưng hoặc cho nghỉ việc.
- Xem lịch sử thay đổi.

### Organization

- CRUD phòng ban.
- CRUD chức vụ.
- Quản lý cấp quản lý.
- Gán nhân viên vào phòng ban/team.
- Cây tổ chức.

### Contracts

- Tạo và cập nhật hợp đồng.
- Gia hạn hợp đồng.
- Theo dõi ngày hết hạn.
- Trạng thái Draft, Active, Expired, Terminated.

### API dự kiến

```http
GET    /api/employees
GET    /api/employees/{id}
POST   /api/employees
PUT    /api/employees/{id}
PATCH  /api/employees/{id}/department
GET    /api/employees/{id}/history

GET    /api/departments
POST   /api/departments
PUT    /api/departments/{id}
DELETE /api/departments/{id}

GET    /api/positions
POST   /api/positions
PUT    /api/positions/{id}

GET    /api/employees/{id}/contracts
POST   /api/employees/{id}/contracts
PUT    /api/contracts/{id}
```

## Giai đoạn 3 — Attendance và Timesheet

### Attendance

- Check-in/check-out.
- Kiểm tra phiên chấm công trong ngày.
- Tính giờ làm việc, đi trễ, về sớm và tăng ca.
- Quản lý ca và lịch làm việc.
- QR check-in nếu cần.
- Tạo và duyệt điều chỉnh công.
- Khóa kỳ chấm công.

### Timesheet

- Tạo kỳ chấm công.
- Tổng hợp theo nhân viên, team và phòng ban.
- Tính công.
- Chốt và mở lại kỳ.
- Xuất CSV/Excel.

### API dự kiến

```http
POST /api/attendance/check-in
POST /api/attendance/check-out
GET  /api/attendance/me
GET  /api/attendance
GET  /api/attendance/summary

POST /api/attendance/adjustments
GET  /api/attendance/adjustments
POST /api/attendance/adjustments/{id}/approve
POST /api/attendance/adjustments/{id}/reject

GET  /api/timesheets/periods
POST /api/timesheets/periods
POST /api/timesheets/periods/{id}/calculate
POST /api/timesheets/periods/{id}/lock
POST /api/timesheets/periods/{id}/unlock
```

### Cần thống nhất

- Múi giờ `Asia/Ho_Chi_Minh`.
- Giờ làm việc chuẩn.
- Giờ nghỉ trưa.
- Quy tắc đi trễ/về sớm.
- Ngày lễ và ngày nghỉ.
- Quy tắc tính tăng ca.

## Giai đoạn 4 — Leave, Overtime và Approval Workflow

### Chức năng

- Danh mục loại phép.
- Số dư phép theo năm.
- Tạo, sửa, hủy và theo dõi đơn nghỉ.
- Kiểm tra trùng ngày và vượt số dư.
- Tạo, duyệt và từ chối đơn tăng ca.
- Chuỗi duyệt theo role/phòng ban.
- Cập nhật số dư sau khi đơn được duyệt.
- Tạo notification khi trạng thái thay đổi.

### Chuỗi mặc định

```text
Dev → Leader → Manager → HR
```

### API dự kiến

```http
GET  /api/leave/types
GET  /api/leave/balances
GET  /api/leave/requests
POST /api/leave/requests
GET  /api/leave/requests/{id}
POST /api/leave/requests/{id}/cancel
POST /api/leave/requests/{id}/approve
POST /api/leave/requests/{id}/reject

GET  /api/overtime/requests
POST /api/overtime/requests
POST /api/overtime/requests/{id}/approve
POST /api/overtime/requests/{id}/reject
```

### Quy tắc bắt buộc

- Người tạo đơn không tự duyệt đơn của mình.
- Người duyệt chỉ thấy đơn thuộc phạm vi.
- Không trừ phép nhiều lần.
- Đơn đã duyệt không được sửa trực tiếp.
- Mọi thao tác duyệt phải ghi audit.

## Giai đoạn 5 — Projects, Tasks, Milestones và Timeline

### Projects

- Tạo, sửa, đóng và lưu trữ dự án.
- Gán Manager, team và member.
- Theo dõi tiến độ, deadline và trạng thái.

### Tasks

- Tạo task và giao việc.
- Cập nhật trạng thái, ưu tiên và deadline.
- Comment, file đính kèm và lịch sử thay đổi.

### Milestones/Timeline

- Tạo milestone.
- Gán task vào milestone.
- Theo dõi ngày bắt đầu/kết thúc.
- Cảnh báo trễ hạn.

### API dự kiến

```http
GET    /api/projects
POST   /api/projects
GET    /api/projects/{id}
PUT    /api/projects/{id}
POST   /api/projects/{id}/members
DELETE /api/projects/{id}/members/{userId}

GET    /api/projects/{id}/tasks
POST   /api/tasks
GET    /api/tasks/{id}
PUT    /api/tasks/{id}
PATCH  /api/tasks/{id}/status
PATCH  /api/tasks/{id}/assignee

GET    /api/projects/{id}/milestones
POST   /api/milestones
PUT    /api/milestones/{id}
```

## Giai đoạn 6 — Payroll và Salary

### Chức năng

- Hồ sơ lương.
- Lương cơ bản, phụ cấp và khấu trừ.
- Tính lương theo công, phép và tăng ca.
- Tạo, tính, duyệt và khóa kỳ lương.
- Phiếu lương cá nhân.
- Giới hạn quyền xem dữ liệu lương.
- Xuất bảng lương.

### Quy trình

```text
Tạo kỳ lương
→ Tính dữ liệu công
→ Tính phép/tăng ca
→ Tính lương
→ HR kiểm tra
→ Duyệt
→ Khóa kỳ
→ Xuất phiếu lương
```

### API dự kiến

```http
GET  /api/payroll/periods
POST /api/payroll/periods
POST /api/payroll/periods/{id}/calculate
GET  /api/payroll/periods/{id}/details
POST /api/payroll/periods/{id}/approve
POST /api/payroll/periods/{id}/lock
GET  /api/payroll/me/payslips
```

## Giai đoạn 7 — KPI và Performance

### Chức năng

- Tạo KPI template và tiêu chí.
- Gán KPI cho nhân viên/team.
- Đặt target và nhập kết quả.
- Tính điểm.
- Nhân viên tự đánh giá.
- Leader/Manager đánh giá.
- HR tổng hợp và khóa kỳ đánh giá.

### API dự kiến

```http
GET  /api/kpi/templates
POST /api/kpi/templates
PUT  /api/kpi/templates/{id}
GET  /api/kpi/targets
POST /api/kpi/targets
PUT  /api/kpi/targets/{id}
GET  /api/kpi/results
POST /api/kpi/results
PUT  /api/kpi/results/{id}
GET  /api/performance/reviews
POST /api/performance/reviews
POST /api/performance/reviews/{id}/submit
POST /api/performance/reviews/{id}/approve
```

## Giai đoạn 8 — Dashboard và Reports

### Dashboard

- Tổng số nhân viên.
- Nhân viên đang làm việc/nghỉ phép.
- Yêu cầu chờ duyệt.
- Tiến độ task và project.
- Tổng giờ công và tăng ca.
- Hợp đồng sắp hết hạn.

### Reports

- Báo cáo nhân sự.
- Báo cáo chấm công.
- Báo cáo nghỉ phép/tăng ca.
- Báo cáo project/task.
- Báo cáo payroll.
- Báo cáo KPI.
- Xuất CSV/Excel/PDF.

### API dự kiến

```http
GET /api/dashboard/summary
GET /api/dashboard/workload
GET /api/dashboard/attendance
GET /api/dashboard/approvals

GET /api/reports/employees
GET /api/reports/attendance
GET /api/reports/leave
GET /api/reports/projects
GET /api/reports/payroll
```

## Giai đoạn 9 — Documents và File Storage

### Chức năng

- Upload file và lưu metadata.
- Phân loại theo công ty, phòng ban, dự án hoặc nhân viên.
- Phân quyền xem/tải.
- Preview và download.
- Xóa tài liệu.
- Version tài liệu.
- Giới hạn loại file và dung lượng.

### Lưu trữ

- Local storage khi phát triển.
- S3, Cloudflare R2 hoặc Azure Blob khi production.
- Không lưu file nhị phân trực tiếp trong database.

### API dự kiến

```http
GET    /api/documents
POST   /api/documents
GET    /api/documents/{id}
GET    /api/documents/{id}/download
DELETE /api/documents/{id}
POST   /api/documents/{id}/versions
```

## Giai đoạn 10 — Notifications và Audit Logs

### Notifications

- Thông báo tạo đơn.
- Thông báo duyệt/từ chối.
- Thông báo task được giao.
- Thông báo task sắp đến hạn.
- Thông báo hợp đồng sắp hết hạn.
- Đếm chưa đọc.
- Đánh dấu một hoặc tất cả đã đọc.
- Realtime qua SignalR.

### Audit Logs

Ghi nhận các sự kiện:

- Đăng nhập/đăng xuất.
- Tạo, sửa, xóa dữ liệu.
- Duyệt/từ chối yêu cầu.
- Thay đổi role/permission.
- Thay đổi lương.
- Tải/xóa tài liệu.
- Khóa/mở kỳ công hoặc kỳ lương.

### API dự kiến

```http
GET  /api/notifications
POST /api/notifications/{id}/read
POST /api/notifications/read-all

GET  /api/audit-logs
GET  /api/audit-logs/{id}
```

## 5. Thứ tự ưu tiên

### Ưu tiên 1 — Bắt buộc

1. Chuẩn hóa API response và exception.
2. Hoàn thiện Authentication/Authorization.
3. Hoàn thiện Employees/Organization/Contracts.
4. Attendance.
5. Leave/Overtime/Approval.
6. Notifications và Audit.

### Ưu tiên 2 — Nghiệp vụ chính trên giao diện

7. Projects.
8. Tasks.
9. Milestones/Timeline.
10. Dashboard và Reports.

### Ưu tiên 3 — Nghiệp vụ mở rộng

11. Timesheet.
12. Payroll.
13. KPI/Performance.
14. Documents/File Storage.

## 6. Điều kiện cần thống nhất trước khi code

- Danh sách role chính thức.
- Permission của từng role.
- Data scope của từng role.
- Quy tắc workflow duyệt.
- Quy tắc tính công, phép và tăng ca.
- Quy tắc tính lương.
- Múi giờ và ngày lễ.
- Quy tắc khóa kỳ dữ liệu.
- Mức độ bảo mật dữ liệu lương.
- Database production.
- Nơi lưu file production.
- Chính sách backup database.
- Domain frontend và CORS production.

## 7. Tiêu chuẩn hoàn thành mỗi module

Một module chỉ được xem là hoàn thành khi có đủ:

- Entity và migration.
- DTO request/response.
- Controller.
- Service nghiệp vụ.
- Validation.
- Phân quyền và data scope.
- Audit log.
- Notification nếu cần.
- Swagger/OpenAPI.
- Unit test.
- Integration test.
- Phân trang/lọc/sắp xếp.
- Kiểm thử trên MySQL thật.
- Frontend gọi API thành công.
- Không còn mutation dữ liệu chính trong `localStorage`.

## 8. Cách sử dụng tài liệu này cho các lần phát triển sau

Khi bắt đầu một module mới, cần nêu rõ:

1. Giai đoạn/module muốn triển khai.
2. Chức năng cụ thể cần làm trước.
3. Role nào được phép sử dụng.
4. Quy tắc nghiệp vụ cần áp dụng.
5. Có cần thay đổi database hay không.
6. Có cần tích hợp frontend ngay hay chỉ làm API trước.

Ví dụ:

> Dựa vào `BACKEND-DEVELOPMENT-PLAN.md`, hãy triển khai Giai đoạn 3 — Attendance, bắt đầu với check-in/check-out và lịch sử chấm công cá nhân. Hãy tạo migration, API, validation, phân quyền và test trước; chưa cần nối frontend.

