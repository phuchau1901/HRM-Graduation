# Đặc tả cơ sở dữ liệu MySQL — Intelex ERP

## 1. Phạm vi và số lượng bảng

Tài liệu này mô tả schema thực tế được tạo bởi EF Core migrations của Backend HRM.

- Database: `hrm`
- Character set: `utf8mb4`
- Bảng nghiệp vụ của ứng dụng: **39 bảng**
- Bảng hệ thống EF Core: `__EFMigrationsHistory`
- Tổng số bảng thường thấy sau migration: **40 bảng**
- Nguồn chuẩn để khởi tạo: `backend/backend/HRM.API/Migrations/`

### Migrations hiện tại

| Migration | Nội dung |
|---|---|
| `20261019074710_InitialHRMDatabase` | Tạo 35 bảng nghiệp vụ nền tảng |
| `20261019145341_AddNotificationCenter` | Thêm notification outbox/recipient/target và quyền action mở rộng |
| `20261026065757_AddUserAuthVersion` | Thêm version xác thực cho user, không tạo bảng mới |

Không nên tạo bảng thủ công khác với migration nếu chưa cập nhật Entity Framework model.

> **Lưu ý:** Cột `Khóa chính` trong các bảng bên dưới chỉ cho biết cột dùng để định danh bản ghi, không phải danh sách đầy đủ các cột của bảng. Mỗi bảng còn có các cột nghiệp vụ như tên, mã, trạng thái, ngày tháng, giờ, số tiền, nội dung và các khóa ngoại.

Ví dụ bảng `employees` không chỉ có `id`, mà còn có các cột chính:

```text
id                 INT              Primary Key
employee_code      VARCHAR(20)      Mã nhân viên
full_name          VARCHAR(150)     Họ tên
email              VARCHAR(255)     Email
date_of_birth      DATE             Ngày sinh
phone_number       VARCHAR(20)      Số điện thoại
hire_date          DATE             Ngày vào làm
department_id      INT              Foreign Key đến departments.id
employment_status  VARCHAR(20)      Trạng thái làm việc
created_at         DATETIME(6)      Thời điểm tạo
```

Các kiểu dữ liệu thường dùng trong schema:

| Kiểu | Dùng cho |
|---|---|
| `INT`, `BIGINT` | ID, số phút, số lượng |
| `VARCHAR` | Tên, mã, email, trạng thái |
| `TEXT` | Mô tả, ghi chú, nội dung dài |
| `DATE` | Ngày sinh, ngày vào làm, ngày bắt đầu/kết thúc |
| `DATETIME(6)` | Thời điểm tạo, check-in/out, duyệt đơn |
| `TIME` | Giờ bắt đầu/kết thúc ca |
| `DECIMAL` | Lương, số ngày phép, giờ tăng ca, điểm KPI |
| `TINYINT(1)` | Giá trị đúng/sai như active/paid |
| `JSON` | Snapshot hoặc dữ liệu có cấu trúc linh hoạt |

Muốn xem chính xác toàn bộ cột, kiểu dữ liệu, index và foreign key, cần đối chiếu file migration hoặc chạy `DESCRIBE <ten_bang>;` trong MySQL.

## 2. Danh sách 39 bảng nghiệp vụ

### Tổ chức, nhân sự và tài khoản

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `departments` | Phòng ban | `id` |
| `positions` | Chức vụ | `id` |
| `employees` | Hồ sơ nhân viên | `id` |
| `employee_histories` | Lịch sử thay đổi nhân viên | `id` |
| `contracts` | Hợp đồng lao động | `id` |
| `users` | Tài khoản đăng nhập | `user_id` |

### Phân quyền

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `roles` | Danh mục vai trò | `id` |
| `screens` | Danh mục màn hình/chức năng | `id` |
| `role_details` | Quyền New/View/Update/Delete/Approve/Export kiểu cũ | `(role_id, screen_id)` |
| `role_screen_actions` | Quyền action mở rộng | khóa theo role/screen/action |
| `user_roles` | Bảng nối user và role | `(user_id, role_id)` |
| `refresh_tokens` | Refresh token của tài khoản | `id` |

### Chấm công

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `shifts` | Ca làm việc | `id` |
| `work_schedules` | Lịch làm việc của nhân viên | `id` |
| `qr_sessions` | Phiên QR chấm công | `id` |
| `attendances` | Bản ghi check-in/check-out | `id` |
| `attendance_adjustments` | Yêu cầu điều chỉnh công | `id` |
| `attendance_requests` | Yêu cầu xử lý chấm công | `id` |

### Nghỉ phép và phê duyệt

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `leave_types` | Loại nghỉ phép | `id` |
| `leave_balances` | Số dư phép theo nhân viên/năm | `id` |
| `leave_requests` | Đơn nghỉ phép | `id` |
| `overtime_requests` | Đơn tăng ca | `id` |
| `approval_requests` | Yêu cầu phê duyệt tổng quát | `id` |
| `approval_steps` | Các bước/người duyệt | `id` |

### KPI và Performance

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `kpi_templates` | Mẫu bộ KPI | `id` |
| `kpi_criteria` | Tiêu chí thuộc bộ KPI | `id` |
| `kpi_targets` | Mục tiêu KPI gán cho nhân viên | `id` |
| `kpi_results` | Kết quả theo mục tiêu/tiêu chí | `id` |
| `performance_reviews` | Phiếu đánh giá hiệu suất | `id` |

### Timesheet và Payroll

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `timesheet_periods` | Kỳ tổng hợp công | `id` |
| `timesheet_details` | Công tổng hợp theo nhân viên | `id` |
| `salary_profiles` | Hồ sơ lương theo thời gian | `id` |
| `payroll_periods` | Kỳ tính lương | `id` |
| `payroll_details` | Chi tiết lương theo nhân viên | `id` |

### Hệ thống

| Bảng | Mô tả | Khóa chính |
|---|---|---|
| `notifications` | Nội dung thông báo | `id` |
| `notification_outbox` | Hàng đợi phát thông báo | `id` |
| `notification_recipients` | Người nhận thông báo | khóa ghép notification/user |
| `notification_targets` | Đối tượng nghiệp vụ liên quan | `id` |
| `audit_logs` | Nhật ký thao tác hệ thống | `id` |

## 3. Quan hệ chính giữa các bảng

### User, Employee và Role

```text
users 1 ─── 0..1 employees
users 1 ─── n user_roles n ─── 1 roles
roles 1 ─── n role_details n ─── 1 screens
roles 1 ─── n role_screen_actions n ─── 1 screens
users 1 ─── n refresh_tokens
```

- `users.employee_id` tham chiếu `employees.id`.
- Một employee có thể chưa có tài khoản đăng nhập.
- Một user có thể có một hoặc nhiều role.
- Quyền thực tế phải được kiểm tra tại Backend, không chỉ ở giao diện.

### Tổ chức và nhân sự

```text
departments 1 ─── n employees
employees 1 ─── n contracts
employees 1 ─── n employee_histories
employees 1 ─── n salary_profiles
```

### Chấm công

```text
employees 1 ─── n work_schedules n ─── 1 shifts
employees 1 ─── n attendances
work_schedules 1 ─── n attendances
qr_sessions 1 ─── n attendances
attendances 1 ─── n attendance_adjustments
attendances 1 ─── n attendance_requests
```

### Nghỉ phép và Approval

```text
employees 1 ─── n leave_balances n ─── 1 leave_types
employees 1 ─── n leave_requests n ─── 1 leave_types
employees 1 ─── n overtime_requests
approval_requests 1 ─── n approval_steps
users 1 ─── n approval_requests
users 1 ─── n approval_steps
```

### KPI, Timesheet và Payroll

```text
kpi_templates 1 ─── n kpi_criteria
kpi_templates 1 ─── n kpi_targets n ─── 1 employees
kpi_targets 1 ─── n kpi_results
kpi_targets 1 ─── n performance_reviews

timesheet_periods 1 ─── n timesheet_details n ─── 1 employees
timesheet_periods 1 ─── n payroll_periods
payroll_periods 1 ─── n payroll_details n ─── 1 employees
```

### Notifications và Audit

```text
notifications 1 ─── n notification_recipients n ─── 1 users
notifications 1 ─── n notification_outbox
notifications 1 ─── n notification_targets
users 1 ─── n audit_logs
```

## 4. Danh sách foreign key

| Bảng con | Cột | Bảng cha | Cột cha |
|---|---|---|---|
| `employees` | `department_id` | `departments` | `id` |
| `users` | `employee_id` | `employees` | `id` |
| `contracts` | `employee_id` | `employees` | `id` |
| `employee_histories` | `employee_id` | `employees` | `id` |
| `employee_histories` | `changed_by_user_id` | `users` | `user_id` |
| `employee_histories` | `old_department_id`, `new_department_id` | `departments` | `id` |
| `employee_histories` | `old_position_id`, `new_position_id` | `positions` | `id` |
| `user_roles` | `user_id` | `users` | `user_id` |
| `user_roles` | `role_id` | `roles` | `id` |
| `role_details` | `role_id` | `roles` | `id` |
| `role_details` | `screen_id` | `screens` | `id` |
| `role_screen_actions` | `role_id` | `roles` | `id` |
| `role_screen_actions` | `screen_id` | `screens` | `id` |
| `refresh_tokens` | `user_id` | `users` | `user_id` |
| `work_schedules` | `employee_id` | `employees` | `id` |
| `work_schedules` | `shift_id` | `shifts` | `id` |
| `attendances` | `schedule_id` | `work_schedules` | `id` |
| `attendances` | `check_in_qr_id`, `check_out_qr_id` | `qr_sessions` | `id` |
| `attendance_adjustments` | `employee_id`, `attendance_id` | `employees`, `attendances` | `id` |
| `attendance_requests` | `employee_id`, `attendance_id` | `employees`, `attendances` | `id` |
| `leave_balances` | `employee_id`, `leave_type_id` | `employees`, `leave_types` | `id` |
| `leave_requests` | `employee_id`, `leave_type_id` | `employees`, `leave_types` | `id` |
| `overtime_requests` | `employee_id` | `employees` | `id` |
| `approval_requests` | `requested_by_user_id` | `users` | `user_id` |
| `approval_steps` | `approval_request_id`, `approver_user_id` | `approval_requests`, `users` | `id`, `user_id` |
| `kpi_criteria` | `template_id` | `kpi_templates` | `id` |
| `kpi_targets` | `employee_id`, `template_id`, `assigned_by_user_id` | `employees`, `kpi_templates`, `users` | `id`, `id`, `user_id` |
| `kpi_results` | `criterion_id`, `target_id` | `kpi_criteria`, `kpi_targets` | `id` |
| `performance_reviews` | `target_id`, `reviewed_by_user_id` | `kpi_targets`, `users` | `id`, `user_id` |
| `timesheet_periods` | `closed_by_user_id` | `users` | `user_id` |
| `timesheet_details` | `period_id`, `employee_id` | `timesheet_periods`, `employees` | `id` |
| `salary_profiles` | `employee_id` | `employees` | `id` |
| `payroll_periods` | `timesheet_period_id`, `approved_by_user_id` | `timesheet_periods`, `users` | `id`, `user_id` |
| `payroll_details` | `payroll_period_id`, `employee_id` | `payroll_periods`, `employees` | `id` |
| `notifications` | `user_id` | `users` | `user_id` |
| `notification_outbox` | `notification_id` | `notifications` | `id` |
| `notification_recipients` | `notification_id`, `user_id` | `notifications`, `users` | `id`, `user_id` |
| `notification_targets` | `notification_id` | `notifications` | `id` |
| `audit_logs` | `actor_user_id` | `users` | `user_id` |

## 5. Thứ tự khởi tạo dữ liệu

1. `departments`, `positions`, `shifts`, `leave_types`.
2. `roles`, `screens`.
3. `employees`.
4. `users` với `employee_id` tương ứng.
5. `user_roles`.
6. `role_details`, `role_screen_actions`.
7. `contracts`, `work_schedules`, `salary_profiles`.
8. `leave_balances`.
9. KPI templates, criteria và targets.
10. Timesheet/payroll periods nếu cần seed dữ liệu kỳ.
11. Notifications và audit logs phát sinh sau cùng.

## 6. Quy tắc import Users từ Frontend

Các user như `usr-manager`, `usr-hr`, `usr-admin`, `usr-01`… hiện chỉ là dữ liệu demo trong `localStorage`, không phải users SQL.

Khi import dữ liệu thật:

- Tạo employee trước.
- Tạo user sau đó và gán `users.employee_id` vào `employees.id`.
- Gán role qua `user_roles`.
- Không dùng mã `usr-manager` làm `employee_id`, vì `employee_id` là số nguyên.
- Mật khẩu phải hash bằng PasswordService của Backend.
- Nhân viên không cần đăng nhập chỉ tạo trong `employees`, không bắt buộc tạo trong `users`.

## 7. Các bảng chưa có nhưng Frontend đang cần

Migration hiện tại **chưa có** bảng cho các chức năng Project/Task/Documents:

- `projects`
- `project_members`
- `tasks`
- `task_comments`
- `milestones`
- `documents`
- `document_versions`
- `file_attachments`

Giao diện đang hiển thị các phần này bằng dữ liệu demo; không được xem là dữ liệu MySQL thật.

## 8. Kiểm tra trước khi tạo production

- Chạy `dotnet ef database update` trên database rỗng.
- Kiểm tra 39 bảng nghiệp vụ và `__EFMigrationsHistory`.
- Kiểm tra toàn bộ foreign key/index/unique key.
- Kiểm tra charset `utf8mb4` và timezone.
- Tắt `AuthSeed` development ở production.
- Không dùng mật khẩu development trong production.
- Seed role/permission chính thức.
- Import employee trước user.
- Kiểm tra tài khoản Admin và data scope.
- Thiết lập backup/restore database.

## 9. Kết luận

Backend hiện đã có schema nền tảng cho HRM: nhân sự, phân quyền, chấm công, nghỉ phép, KPI, payroll, notification và audit. Tuy nhiên, Project/Task/Documents vẫn cần thiết kế entity, migration và quan hệ riêng trước khi tích hợp production.

