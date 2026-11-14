# HRM Employees — ReactJS

Frontend list/detail Employee dùng departmentName, teamName, positionName trực tiếp từ API. Checkout web-admin trống trước thay đổi này, không có logic ghép catalog cũ để giữ lại. Dữ liệu runtime lấy API thật, không mock/hardcode danh mục.

```sh
npm ci
npm run dev
npm test
npm run build
```

Vite mặc định `127.0.0.1:5173`, proxy `/api` tới `https://localhost:7041` theo launchSettings backend; có thể cấu hình `VITE_API_TARGET` trong môi trường local. Development cho chứng chỉ local tự ký; production không tắt xác minh. Build output dist; khi host riêng cần reverse proxy /api cùng origin. Không tự khởi chạy backend với DB production để preview và không có bước deploy.

## API và phân quyền

Login qua /api/auth/login, token chỉ giữ trong memory, không lưu password/token vào storage/log. GET /api/employees dùng pagination/search hiện có; detail gọi /api/employees/{id}. List/detail không gọi departments/teams/positions để render tên. Các name null có placeholder trạng thái chưa gán. UI theo WEB_EMPLOYEES/VIEW/NEW/UPDATE; backend giữ quyết định scope và quyền.

Dropdown catalog chỉ được nạp khi mở EmployeeEditor, giữ API riêng và quyền WEB_DEPARTMENTS/VIEW, WEB_TEAMS/VIEW, WEB_POSITIONS/VIEW. Team lọc theo Department, reset khi đổi phòng trong form tạo. Catalog inactive hiện tại có thể giữ theo tên/ID từ Employee response. Không gửi names hoặc employeeCode trong payload ghi. Department của hồ sơ hiện có cố định trong form PUT, chuyển phòng vẫn qua API chuyên biệt hiện có.

Source: src/Employees.jsx, EmployeeEditor.jsx, api.js, main.jsx. Tests src/Employees.test.jsx kiểm tra tên backend, null, readonly code, không fetch catalog ở list/detail, chỉ fetch khi editor mở, RBAC và payload PositionId nullable. Tests dùng mocks riêng trong test; chưa QA trình duyệt với backend live.
