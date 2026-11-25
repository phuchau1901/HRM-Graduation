# Dashboard — Intelex Workspace frontend

Dashboard tại `#/dashboard` dùng theme chung của Intelex: các biến trong
`assets/css/tokens.css`, icon có sẵn và hash router hiện tại. Không có theme,
role hoặc scope riêng cho Dashboard.

## Source

- `assets/js/pages/dashboard/dashboard-api.js`: bộ lọc, summary cards, các panel,
  trạng thái tải/lỗi/rỗng, quick actions và lifecycle API.
- `assets/js/pages/dashboard/dashboard-charts.jsx`: biểu đồ Recharts/React,
  được đóng gói thành `assets/js/dist/dashboard-charts.js`. Chỉ tải script khi có
  dữ liệu biểu đồ trên Dashboard. React được unmount khi đổi kỳ hoặc rời trang.
- `assets/css/dashboard.css`: style riêng, giới hạn trong `#dashboard-api-root`.
- `scripts/build-browser.js`: build ứng dụng hiện có và bundle biểu đồ riêng bằng esbuild.
- `tests/dashboard.test.js`: quyền nguồn, API, null/zero, markup và deep links.

## Bố cục và tương tác

Grid 12 cột: summary cards toàn chiều rộng; chấm công 8 cột, cơ cấu nhân sự
4 cột; tiếp theo là yêu cầu chờ duyệt, KPI, lương và phần cá nhân. Tự xếp lại
trên laptop/tablet/mobile. Sidebar, topbar và fonts không thay đổi.

Chấm công có thể bật/tắt Có mặt, Đi trễ, Về sớm, Vắng mặt và Thiếu chấm công.
Thiếu chấm công cộng hai chỉ tiêu thiếu giờ vào/ra do API cung cấp; không suy ra
vắng mặt từ record trống. Tooltip và bảng mở rộng hiển thị số thật theo ngày;
null được giữ nguyên, số 0 vẫn hiển thị 0. Donut dùng số nhân viên hiện tại
trong từng phòng, tổng ở giữa chỉ cộng các nhóm API đã trả về trong scope.
Chọn phòng ban trên donut/legend mở danh sách nhân viên đang làm việc của
phòng ban đó bằng filter `departmentId`, vẫn do API nhân viên kiểm soát scope.

Summary không tạo biến động so sánh hoặc ngưỡng đánh giá giả. Tooltip mô tả
định nghĩa từng chỉ tiêu. KPI trung bình chỉ lấy `averageApprovedScore` từ API.
Payroll sử dụng số tiền/currency API, phân biệt đối soát, đã duyệt, đã phát hành,
đã thanh toán. Quick actions chỉ hiện theo quyền VIEW của màn hình đích.

## API và bảo toàn quyền

Giữ nguyên 7 API GET theo
[tài liệu backend](https://github.com/phuchau1901/HRM-Graduation/blob/main/docs/modules/Dashboard/README.md):
`summary`, `attendance-trend`, `department-distribution`, `pending-tasks`,
`kpi-overview`, `payroll-overview`, `my-overview` dưới `/api/dashboard/`.
Không có request Payroll quản lý khi thiếu `WEB_PAYROLL/VIEW`.

Query quản lý là year/month/departmentId; cá nhân chỉ gửi year/month.
Null bị ẩn theo quyền không biến thành 0. Lỗi chỉ hiển thị trong panel tương ứng,
không thay bằng dữ liệu demo. Request cũ được abort và kiểm tra generation;
không polling. Làm mới thủ công và khi cửa sổ nhận focus. Thời điểm cập nhật
hiển thị theo giờ Việt Nam; có ghi chú nếu có panel chưa tải được.

Pending tasks là backlog hiện tại, không cắt theo tháng. Deep link giữ nguyên
`#/approvals?approvalId={id}`. Thông báo cá nhân vẫn mở popup và đánh dấu đọc
qua notification service hiện có.

## Kiểm tra

- `npm run build`
- `node --test tests/dashboard.test.js`
- `npm test` (bài kiểm tra proxy cần quyền mở cổng localhost)
- Chrome với transport API giả lập: 1440, 1280, 1024, 768, 390px; biểu đồ lazy
  loading, chọn metric, số liệu, filters, stale responses, lỗi từng panel,
  quyền cá nhân, không gọi Payroll khi thiếu quyền, thông báo và điều hướng.

Không sửa backend, database, migration, seed hoặc deploy. Không dùng phiên
đăng nhập thật để thay đổi dữ liệu. Kiểm tra dữ liệu DEV cần môi trường và
quyền truy cập phù hợp; các kiểm tra giao diện trên dùng dữ liệu giả lập.
