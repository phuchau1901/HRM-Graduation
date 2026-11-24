# Cấu trúc trang theo menu

- `dashboard/`: Tổng quan.
- `my-workspace/`: Nghỉ phép cá nhân và số dư phép từ API.
- `human-resources/`: Nhân viên, cơ cấu tổ chức, hợp đồng.
- `approval-center/`: Nghỉ phép, tăng ca, điều chỉnh công và phê duyệt.
- `notifications/`: Hộp thư thông báo và popup chi tiết.
- `reports/`: Báo cáo chấm công và xuất báo cáo.
- `administration/`: Tài khoản, role và nhật ký hệ thống.
  - `master-data/`: Các danh mục dùng chung.
  - `system-settings/`: Chính sách mật khẩu, chấm công và quy trình phê duyệt.
- `shared/`: Các bộ render đang được dùng bởi nhiều nhóm menu, gồm Workspace, Team, Project, Documents và các trang vận hành.

Các trang dùng chung tiếp tục được nhập từ `shared/`; không sao chép chúng vào từng nhóm. Khi thêm hoặc di chuyển module, cập nhật import và danh sách module trong `scripts/build-browser.js`, sau đó chạy `npm run build` và `npm test`. File trong `assets/js/dist/` được sinh tự động.

- `work/work-schedules.js`: lịch phân ca tuần/tháng, phân hàng loạt và sao chép qua preview, xuất CSV; route `/work/schedules`, quyền `WEB_WORK_SCHEDULES`.

- `attendance/attendance-management.js`: `/workspace/attendance` dùng `/me`; `/hr/attendance` dùng daily/statistics/filters/detail/export. Giao diện cá nhân dùng `WEB_MY_ATTENDANCE`, quản trị dùng `WEB_ATTENDANCE`; điều chỉnh dùng quyền riêng `WEB_ATTENDANCE_ADJUSTMENTS`. Backend phải hỗ trợ quyền cá nhân tại các endpoint /me, detail và punch trước khi chỉ cấp WEB_MY_ATTENDANCE cho tài khoản.

- `performance/kpi-results.js`: `/performance/kpi-results`, quyền `WEB_KPI_EVALUATION`; danh sách, thống kê, tự đánh giá, đánh giá quản lý và theo dõi phê duyệt qua module PERFORMANCE.

- `administration/system-settings/terminal-logging.js`: cấu hình log terminal theo user và module tại System Settings; quyền `WEB_SYSTEM_SETTINGS`, lưu bare settings với ETag/If-Match.

- `performance/kpi-templates.js`: `/performance/kpi-templates`, quyền `WEB_KPI_CONFIGURATION` với scope VIEW/NEW/UPDATE; mẫu KPI, chỉ tiêu, danh mục đơn vị, kỳ đánh giá và giao/copy KPI. Đơn vị chỉ tiêu tải từ `/api/kpi/configuration/units?isActive=true` qua tất cả trang; giữ mã đơn vị cũ khi sửa. Link cũ `WEB_KPI_TEMPLATES` chuyển sang đường dẫn mới.

- `payroll/salary-configuration.js`: `/payroll/configuration`, quyền `WEB_SALARY_CONFIGURATION`, hồ sơ có hiệu lực, thay lương bằng supersede, khoản thu nhập/khấu trừ và chính sách có phiên bản.
- `payroll/payroll-management.js`: `/payroll/management` và `/payroll/timesheets`, cùng quyền `WEB_PAYROLL`; phiếu lương, thống kê/Excel, kỳ công, tổng hợp/tính, điều chỉnh/hủy, gửi duyệt PAYROLL_PERIOD, chốt và ghi nhận thanh toán.
- `payroll/payroll-common.js`: kiểm tra dữ liệu tiền/ngày, quyền/action/scope, phân trang, picker nhân viên theo endpoint riêng của Payroll và xử lý xung đột. Các đường dẫn `/screens/WEB_PAYROLL`, `/screens/WEB_SALARY_PROFILES`, `/screens/WEB_TIMESHEETS` chuyển sang route tương ứng.

- `my-workspace/my-payslips.js`: `/workspace/payslips`, quyền `WEB_MY_PAYSLIPS` VIEW/EXPORT không scope; danh sách và chi tiết chỉ LOCKED/PAID của nhân viên đăng nhập, tải PDF từ `/api/payslips/me/{id}/pdf`, không đọc snapshot HR. Link `/screens/WEB_MY_PAYSLIPS` chuyển sang đường dẫn mới.
