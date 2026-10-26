# Performance — KPI và đánh giá

[Danh mục tài liệu](../../README.md) · [API Inventory](../../API/README.md)

Trạng thái: **PARTIAL — model/hạ tầng có; API nghiệp vụ MISSING**. Đã có Entity/Fluent Configuration; chưa có API KPI/đánh giá.

## Phạm vi source

Source: `backend/HRM.API/Modules/Performance/`.

Entity hiện có: `KpiCriterion`, `KpiResult`, `KpiTarget`, `KpiTemplate`, `PerformanceReview`.

## Phạm vi và giới hạn

Model gồm mẫu KPI, tiêu chí, mục tiêu, kết quả và đánh giá. Công thức điểm, trọng số, chu kỳ, người đánh giá và quyền phê duyệt chưa thành API. Cần chốt các quy tắc này và scope trước triển khai; không suy quyền theo tên Role.

## Tài liệu module

- [Kiểm thử và quy trình chung](../../guides/TESTING.md)

Quy ước chung: [HTTP và phân quyền](../../guides/CONVENTIONS.md). Cấu trúc dữ liệu: [database và migrations](../../guides/DATABASE.md).
