# Tài liệu Backend HRM.API

Tài liệu được tổ chức theo module, đối chiếu source tại `backend/HRM.API`. Mục tiêu là mô tả trạng thái hiện tại và cách tích hợp, không trộn báo cáo triển khai cũ với hướng dẫn vận hành. Cập nhật cấu trúc:2026-10-26.

## Bắt đầu

- [API Inventory — 52 REST endpoint và SignalR](API/README.md)
- [Cấu hình và chạy local](guides/DEVELOPMENT.md)
- [Quy ước HTTP, lỗi, phân quyền và CORS](guides/CONVENTIONS.md)
- [Database và migrations](guides/DATABASE.md)
- [Automated tests và Postman](guides/TESTING.md)
- [Postman Collection](HRM-API.postman_collection.json)

## Tài liệu từng module

| Thư mục | Nội dung | Trạng thái |
| --- | --- | --- |
| [Auth](modules/Auth/README.md) | Login, profile, password, JWT/session | API có |
| [Authorization](modules/Authorization/README.md) | User, Role, Screen, permission matrix, bootstrap | API có |
| [Organization](modules/Organization/README.md) | Departments, Positions | API có |
| [Employees](modules/Employees/README.md) | Hồ sơ, hợp đồng, lịch sử, data scope | API có |
| [Notifications](modules/Notifications/README.md) | Target, inbox, outbox, worker, SignalR | API có; FCM chưa có |
| [Attendance](modules/Attendance/README.md) | Ca, lịch, chấm công, QR, hiệu chỉnh | Chỉ model; API chưa có |
| [Leave](modules/Leave/README.md) | Nghỉ phép, tăng ca, approval | Chỉ model; API chưa có |
| [Payroll](modules/Payroll/README.md) | Lương và bảng công | Chỉ model; API chưa có |
| [Performance](modules/Performance/README.md) | KPI và đánh giá | Chỉ model; API chưa có |
| [System](modules/System/README.md) | Entity audit/notification, hạ tầng chung | Chưa có API độc lập |

## Cấu trúc

```text
docs/
  README.md
  API/README.md                 # Inventory và đường dẫn đặc tả
  guides/                       # HTTP, development, database, testing
  modules/
    Auth/                       # README, API, SECURITY, TESTS
    Authorization/              # README, Users/Roles/Screens/Permissions API, SECURITY, TESTS
    Organization/               # README, Departments/Positions API, TESTS
    Employees/                  # README, Profiles/Contracts/History API, DATA_SCOPE, TESTS
    Notifications/              # README, API, ARCHITECTURE, TESTS
    Attendance/                 # README trạng thái thực tế
    Leave/                      # README trạng thái thực tế
    Payroll/                    # README trạng thái thực tế
    Performance/                # README trạng thái thực tế
    System/                     # README trạng thái thực tế
```

Mỗi endpoint được mô tả tại file API của module với Method/URL, permission, parameters, request/response và lỗi/validation; checklist test nằm trong endpoint hoặc TESTS.md cùng thư mục. Không tạo tài liệu API cho route chưa được triển khai.

## Duy trì tài liệu

Sửa tài liệu module cùng thay đổi source và cập nhật API Inventory khi thêm/bỏ route. Tài liệu dùng giá trị minh họa/placeholder, không chứa credential thật. Schema/grant/migration application state phải xác minh riêng tại môi trường đích. Đợt viết lại này chỉ chỉnh Markdown; Postman, SQL và backup hiện có được giữ nguyên.

File Markdown phẳng cũ đã được thay thế bởi cây thư mục này. Bản sao trước khi viết lại được giữ ngoài repository tại `/private/tmp/hrm-docs-rewrite-20261026-before.tar.gz`; không lưu thêm bản tài liệu lỗi thời trong cây tài liệu mới.
