# Báo cáo rà soát và tích hợp backend HRM

Ngày rà soát: 04/11/2026

## Kết luận nhanh

- Frontend Intelex hiện chạy độc lập bằng HTML/CSS/JavaScript thuần, dữ liệu demo lưu trong `localStorage` với key `intelex-erp-demo:v1`.
- Backend từ repository `https://github.com/phuchau1901/HRM-Graduation.git` đã được clone vào thư mục `backend/`.
- Backend build thành công bằng .NET 8 project sau khi restore NuGet.
- Backend công bố 52 REST endpoint và 1 SignalR notification hub.
- Chưa thể chuyển toàn bộ frontend sang backend thật vì backend hiện chưa có API nghiệp vụ cho các phần cốt lõi của giao diện: project, task, attendance, leave/approval, payroll, KPI, dashboard/report và documents.

## Tích hợp backend đã thực hiện sau đợt rà soát

- Thêm API client dùng `fetch` khi người dùng chủ động đăng nhập, lưu JWT session riêng với dữ liệu demo.
- Thêm nút đăng nhập/đăng xuất backend trong hộp thoại tài khoản của giao diện.
- Mở CORS Development cho frontend `http://127.0.0.1:4173` và `http://localhost:4173`.
- Seed tài khoản local `admin` để kiểm thử JWT.
- Đã kiểm tra thực tế: `POST /api/auth/login` từ frontend origin trả HTTP 200 và access token hợp lệ.
- Chưa thay dữ liệu demo trong các view bằng dữ liệu API; phần này cần làm theo từng module sau khi hoàn tất permission bootstrap và DTO mapping.
- API mặc định của frontend đã chuyển sang `https://hrm-graduation.up.railway.app`; có thể override bằng `window.INTELEX_API_BASE` khi chạy backend local.
- Railway hiện phản hồi endpoint Auth nhưng chưa trả CORS cho origin frontend local; cần cấu hình `Notifications:AllowedOrigins`/CORS production và redeploy backend trước khi đăng nhập từ trình duyệt.
- Frontend local đã có proxy cùng-origin `/api/*` → Railway để chạy được ngay cả khi Railway chưa bật CORS cho `127.0.0.1:4173`. Cách này chỉ có tác dụng khi chạy qua `node server.js`, không áp dụng khi mở trực tiếp `index.html` bằng `file://`.

## Chức năng đã có trên giao diện hiện tại

| Nhóm | Trạng thái frontend |
| --- | --- |
| Dashboard KPI, tiến độ dự án, hoạt động gần đây | Có, dữ liệu seed/localStorage |
| Project và task: danh sách, Kanban, tạo/sửa, giao việc, cập nhật trạng thái | Có, dữ liệu seed/localStorage |
| Nhân viên, team, hồ sơ, hợp đồng | Có, dữ liệu seed/localStorage |
| Chấm công check-in/check-out, lịch sử, lọc, CSV, in báo cáo | Có, mô phỏng localStorage |
| Nghỉ phép, tăng ca, điều chỉnh công, chuỗi duyệt Dev → Leader → Manager → HR | Có, mô phỏng localStorage |
| Reports và các bộ lọc theo team/ngày/phạm vi | Có, tính từ dữ liệu demo |
| Tài liệu: preview Markdown và metadata | Có; chưa upload file thật |
| Quản trị user, role, permission matrix, settings, audit log | Có, nhưng chỉ mô phỏng localStorage |
| Thông báo | Có, dữ liệu seed; chưa đồng bộ realtime thật |

## Chức năng backend đã triển khai và có thể nối vào UI

| Backend module | API hiện có | Khả năng ghép vào UI |
| --- | --- | --- |
| Auth | Login, `me`, permissions | Có thể thay role switch demo bằng JWT login thật |
| Authorization | Users, Roles, Screens, permission actions | Có thể thay quản trị user/role/quyền demo |
| Organization | Departments, Positions CRUD | Có thể thay danh mục phòng ban/chức vụ demo |
| Employees | Hồ sơ, đổi phòng ban, history | Có thể thay danh sách và form nhân viên demo |
| Contracts | CRUD hợp đồng theo employee | Có thể thay phần hợp đồng demo |
| Notifications | Inbox, unread count, read/read-all, announcements, SignalR hub | Có thể đồng bộ notification thật sau khi cấu hình CORS/JWT |

## Chức năng chưa có API backend, chưa thể tích hợp thật

| Nhóm | Tình trạng backend | Việc cần phát triển |
| --- | --- | --- |
| Projects / Tasks / Milestones / Timeline | Không có entity/controller/API | Thiết kế schema và CRUD, member scope, workflow task |
| Attendance | Có entity/configuration; API nghiệp vụ missing | Check-in/out, ca, lịch, QR, adjustment, khóa kỳ |
| Leave / Overtime / Approval | Có model; API nghiệp vụ missing | Tạo đơn, số dư, chuỗi duyệt, approve/reject/cancel, notification |
| Payroll / Timesheet | Có model/configuration; API missing | Chốt kỳ, tính công/lương, quyền xem dữ liệu nhạy cảm, export |
| Performance / KPI | Có model/configuration; API missing | Template, target, criterion, result, review và công thức điểm |
| Dashboard / Reports | Không có endpoint độc lập | API aggregate theo quyền/phạm vi, export CSV/PDF |
| Documents / Upload | Không có module/API upload | Lưu file, metadata, quyền truy cập, versioning |
| Audit log API | Có entity và ghi audit trong một số service; chưa có API tra cứu | Endpoint xem/lọc/export audit cho admin |

## Đánh giá tương thích dữ liệu

Frontend đang dùng các ID chuỗi demo như `usr-manager`, `prj-1`, `tsk-1` và các field như `name`, `role`, `teamId`, `projectId`. Backend dùng `UserId` chuỗi cho tài khoản nhưng `Employee.Id`, Department/Position và các khóa nghiệp vụ riêng. Vì vậy không nên ánh xạ trực tiếp bằng cách đổi tên field trong từng view; cần một lớp API adapter/normalizer và xác định mapping chính thức cho user–employee–department–team.

Backend cũng thực thi permission và data scope ở server. Frontend chỉ được dùng permission để ẩn/hiện UI; không được tiếp tục coi role switch hoặc `localStorage` là cơ chế bảo mật khi chuyển sang production.

## Kiểm thử đã thực hiện

- Frontend: `npm test` — 11/11 test pass.
- Backend: `dotnet build backend/backend/HRM.API/HRM.sln` — build thành công, 0 warning, 0 error.
- Backend tests: chưa chạy được vì máy thiếu runtime `Microsoft.NETCore.App 8.0.0`; hiện máy có .NET 3.1 và .NET 10.

## Thứ tự phát triển đề xuất

1. Bổ sung API Projects/Tasks và Attendance/Leave vì đây là các luồng chính đang có sẵn trên UI.
2. Tạo frontend API layer: base URL, JWT storage, refresh/session handling, error mapping và DTO normalizer.
3. Nối Auth + Employees + Organization + Contracts trước; giữ seed fallback chỉ cho demo/offline.
4. Nối Notifications/SignalR sau khi backend environment có JWT secret, database và CORS origin của frontend.
5. Nối các màn hình nghiệp vụ còn lại khi endpoint backend hoàn tất; sau đó bỏ dần các mutation trực tiếp trên `store.js`.

