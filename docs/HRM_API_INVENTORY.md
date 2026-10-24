# API Inventory — audit trước triển khai (2026-10-24)

Đã quét toàn bộ source HRM.API, không tính bin/obj, bản backup migration, wwwroot demo hoặc test-only controller. Chỉ tìm thấy 3 controller production, 11 REST endpoint và 1 SignalR hub. Entity/configuration không được tính là API đã triển khai.

| Module / nhóm | API có trước | Trạng thái | Thiếu / cần bổ sung |
| --- | --- | --- | --- |
| Auth | POST /api/auth/login; GET /api/auth/me; GET /api/auth/me/permissions | IMPLEMENTED | Giữ nguyên; login anonymous là ngoại lệ có chủ đích |
| Notifications | GET /api/notifications; GET unread-count; PATCH {id}/read; PATCH read-all; POST announcements; POST {id}/publish; POST {id}/cancel; /hubs/notifications | IMPLEMENTED | Giữ nguyên; FCM là giai đoạn sau, việc deploy/migration cần xác nhận riêng |
| Organization / Departments | GET /api/departments | PARTIAL | GET chi tiết, POST, PUT, DELETE có kiểm tra tham chiếu; validation, tests, spec |
| Organization / Positions | Chỉ entity/configuration | MISSING | List/detail/create/update/delete, validation, RBAC, tests |
| Employees / Profiles | Chỉ entity/configuration | MISSING | CRUD không xóa hồ sơ lịch sử, phân trang/tìm kiếm, SELF/DEPARTMENT/ALL |
| Employees / Contracts | Chỉ entity/configuration | MISSING | List/detail/create/update, ngày bắt đầu/kết thúc, FK, scope, notification |
| Employees / History | Chỉ entity/configuration | MISSING | Read history, chuyển phòng ban có lịch sử và người thực hiện; không có PositionId hiện tại trên Employee |
| Attendance / Shifts, WorkSchedules, Attendance, Adjustments, Requests, QR | Chỉ entity/configuration | MISSING | Chưa có command/controller nghiệp vụ |
| Leave / Overtime / Approvals | Chỉ entity/configuration | MISSING | Quy trình phê duyệt và chuyển trạng thái cần thiết kế khi tới module |
| Payroll / Timesheets | Chỉ entity/configuration | MISSING | Chưa có API/tính lương/chốt kỳ |
| Performance / KPI | Chỉ entity/configuration | MISSING | Chưa có API/tính KPI |
| Dashboard / Reports | Không có controller/service | MISSING | Chưa định nghĩa metric/data scope/export |
| Authorization management | PermissionService + policy/handler có sẵn, chưa có CRUD quyền | PARTIAL | Giữ nền tảng; không tự tạo lại JWT/Login hoặc gán quyền ADMIN |

## Ràng buộc phát hiện

- Department/Employee dùng bảng lowercase nhưng tên cột PascalCase; giữ nguyên mapping.
- Employee không có PositionId: không thể cung cấp API gán chức danh hiện tại chỉ bằng suy đoán từ lịch sử.
- Data Scope chưa có schema/service/claim nào. Thiết kế đợt đầu phải fail closed và có cấu hình Backend tường minh, không tin UserId/department/scope do request truyền để mở rộng quyền.
- Mã WEB_DEPARTMENTS đã dùng trong source. Mã mới cho chức năng chưa có endpoint cần được provision/đối chiếu catalog và cấp quyền riêng; không tự thêm quyền database.
- Chưa có event nghiệp vụ approval để nối Notification; sẽ tái sử dụng CreateInternalAsync khi bổ sung thao tác hợp đồng/chuyển phòng ban.

Tài liệu này lưu kết quả trước khi viết code. Trạng thái sau triển khai và spec nằm trong HRM_API_SPEC.md.

## Sau đợt Organization → Employees

| Module | Trạng thái source | Kết quả |
| --- | --- | --- |
| Auth / JWT | IMPLEMENTED, giữ nguyên | 3 REST API, không xây dựng lại |
| Notification Center | IMPLEMENTED, giữ nguyên | 7 REST + hub; EmployeeService gọi service/outbox hiện có |
| Departments | IMPLEMENTED | 5 endpoint; GET cũ được mở rộng phân trang, giữ success/total/data |
| Positions | IMPLEMENTED | 5 endpoint; cần đối chiếu/provision WEB_POSITIONS và grant khi triển khai |
| Employee Profiles | IMPLEMENTED | List/detail/create/update/soft-deactivate, SELF/DEPARTMENT/ALL |
| Employee Contracts | IMPLEMENTED | List/detail/create/update; date/status/overlap validation, audit/notification atomic; chưa có signing/approval workflow |
| Employee History | IMPLEMENTED cho chuyển phòng ban; PARTIAL cho chức danh | GET history + PATCH department; chưa sửa schema để có PositionId hiện tại |
| Các module Attendance trở đi | MISSING | Giữ thứ tự kế tiếp; không triển khai nửa vời khi hai module đầu chưa kiểm thử |

Sau triển khai có **6 controller production, 31 REST endpoint + 1 SignalR hub**. Có test inventory runtime đảm bảo không trùng method/route và 21 action Organization/Employees đều có JWT + ScreenPermission. Mã mới WEB_POSITIONS/WEB_CONTRACTS chưa được ghi vào database, Data Scope ALL/DEPARTMENT cần cấu hình Backend tường minh. IMPLEMENTED ở đây là source + kiểm thử cục bộ, không khẳng định đã deploy/cấp quyền Railway.
