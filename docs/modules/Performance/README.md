# Performance Management — KPI

[API Specification](API.md) · [Nghiệp vụ, bảo mật và kiểm thử](IMPLEMENTATION.md)

Đã triển khai source Backend và Intelex Workspace cho KPI Configuration và KPI Evaluation. Trạng thái này không có nghĩa đã chạy Migration, cấp quyền hay deploy.

## Audit

| Thành phần trước triển khai | Kết quả / cách tận dụng |
| --- | --- |
| `kpi_templates`, `kpi_criteria` | Đã có Entity, Fluent Mapping và Migration. Criteria là các dòng của template, không phải danh mục độc lập. Mở rộng applicability, version, mục tiêu và snapshot công thức. |
| `kpi_targets`, `kpi_results`, `performance_reviews` | Đã có bảng; chưa có Controller, Service hoặc DTO nghiệp vụ. Tận dụng để lưu giao KPI, kết quả và đánh giá. |
| Kỳ KPI, danh mục chỉ tiêu | Chưa có bảng; bổ sung `kpi_periods`, `kpi_metrics`. |
| Frontend | Chưa có màn KPI; thêm hai màn thuộc Performance Management, dùng API thật. |
| Approval Workflow | Đã có engine nhiều bước. Đăng ký module PERFORMANCE / requestType KPI_EVALUATION, không tạo engine hoặc bảng approval mới. |
| Projects / Tasks | Chưa có API nghiệp vụ thực tế trong repository; chỉ hỗ trợ source MANUAL, không mô phỏng tích hợp. |
| Notifications / Audit Logs | Dùng dịch vụ và bảng hiện có, cùng transaction. |

## Màn hình và quyền

- `WEB_KPI_CONFIGURATION`: VIEW đọc cấu hình; NEW tạo kỳ, chỉ tiêu, template, giao/copy KPI; UPDATE sửa chỉ tiêu, template draft, phát hành, chốt kỳ.
- `WEB_KPI_EVALUATION`: VIEW danh sách/chi tiết/thống kê; UPDATE bắt đầu, lưu và gửi kết quả **của chính mình**; APPROVE đánh giá khi là reviewer được giao; EXPORT xuất Excel.
- Cấu hình scope theo **từng action** SELF / DEPARTMENT / ALL. Thiếu scope bị từ chối. Quản trị kỳ và danh mục dùng scope ALL vì là cấu hình dùng chung. Ghi template/giao KPI dùng DEPARTMENT hoặc ALL, SELF không được giao KPI.
- Phê duyệt cuối dùng `WEB_APPROVALS / VIEW, APPROVE` và scope hiện có; chi tiết KPI còn yêu cầu `WEB_KPI_EVALUATION / VIEW`, quyết định yêu cầu `WEB_KPI_EVALUATION / APPROVE` + scope và đúng bước được giao. VIEW/ALL không cấp quyền duyệt.

Frontend: `/#/performance/configuration`, `/#/performance/evaluation`, phê duyệt tại `/#/approvals/performance`. Các tab cấu hình: Kỳ KPI, Chỉ tiêu, KPI Templates, Giao KPI.

## Migration cần được người vận hành xem và chạy riêng

`20261123090752_CompletePerformanceManagement` tạo **chỉ hai bảng mới**, mở rộng năm bảng KPI cũ, nullable FK để giữ nguyên dữ liệu legacy. Unique `(employee_id, period_id)` bảo đảm một bộ KPI mỗi nhân viên/kỳ; legacy period_id NULL không bị gộp/xóa. Tạo index thay thế trước khi bỏ index employee FK để tránh lỗi MySQL “needed in a foreign key constraint”.

Migration đăng ký hai screen nếu chưa có, **không cấp grant hoặc scope tự động**. Down giữ screen để tránh xóa cấu hình phân quyền đã có. Không backfill snapshot cho KPI cũ; bản ghi thiếu snapshot không được sửa hoặc đánh giá, cần đối soát và giao bộ mới đúng kỳ. Không có cơ chế tự mở lại KPI đã chốt.

Không tự apply Migration hoặc deploy Railway. Xem kết quả build/test được ghi trong [IMPLEMENTATION.md](IMPLEMENTATION.md).
