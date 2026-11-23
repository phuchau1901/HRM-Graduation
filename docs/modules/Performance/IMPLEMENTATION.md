# KPI — Nghiệp vụ và triển khai

## Vòng đời

DRAFT (đã giao, đã snapshot) → IN_PROGRESS (nhân viên bắt đầu) → SUBMITTED (đã điền đủ kết quả) → REVIEWED (reviewer được giao tính điểm, nhận xét, mở workflow) → APPROVED / REJECTED (quyết định cuối của engine Approval). REJECTED là kết thúc; không tự quay về draft hoặc mở khóa. Kỳ chỉ chốt khi không còn target chưa kết thúc; không có API mở lại.

Không suy reviewer từ tên role. Assignment chỉ định reviewerEmployeeId, tài khoản đăng nhập phải liên kết đúng nhân viên này và có APPROVE/scope. Reviewer không được là chủ KPI; bulk ALL hỗ trợ alternateReviewerEmployeeId riêng cho KPI của reviewer chính. Người quyết định approval phải đúng bước được giao, giữ chính sách nhiều cấp của engine. Duyệt bởi người khác trong bước kế tiếp được hỗ trợ; người đánh giá và người duyệt có thể trùng nếu cấu hình, nhưng cả hai luôn khác nhân viên được đánh giá.

## Công thức

- HIGHER: min(maxScore, actual / target ×100).
- LOWER: min(maxScore, target / actual ×100); actual=0 cho maxScore; target phải dương.
- QUALITATIVE: nhập điểm0..maxScore, dùng trực tiếp.
- MILESTONE: điểm của ngưỡng lớn nhất đã đạt (score tăng/giữ nguyên theo threshold), chưa đạt mốc đầu bằng0.
- Điểm từng chỉ tiêu làm tròn hai chữ số AwayFromZero; tổng Σ(score×weight/100) rồi làm tròn hai chữ số AwayFromZero. Tổng weight chính xác100. MaxScore cấu hình1..200, mặc định100.
- Rating báo cáo hiện tại: EXCEEDS>=100, MEETS>=80, BELOW<80; finalScore vẫn là giá trị tính theo công thức, không ép về100 nếu metric cho vượt100.

Chặn precision vượt lưu trữ thay vì âm thầm làm tròn target/weight. Kiểm tra số thập phân dùng invariant limits để không gây500 khi API chạy locale vi-VN.

## Dữ liệu / tích hợp

Kỳ theo tháng/quý/năm là DateOnly, UI lấy năm mặc định theo Asia/Ho_Chi_Minh. Audit/notification/review timestamps lưu UTC. Không tự sử dụng UTC date để chọn kỳ. Snapshot giữ mục tiêu, trọng số, maxScore, unit, direction, method, source, milestones. Catalog chỉnh sau không đổi snapshot template; template đã publish không sửa, dùng mã/version mới. Giao snapshot DRAFT cũng đã đóng băng cấu hình.

Notification khi giao: một notification theo batch, danh sách user nhận theo nhân viên, eventKey dựa kỳ+target đầu tiên; giao lại không tạo lại notification. Submit báo reviewer; review/final báo theo engine Approval. Tất cả cùng transaction; lỗi workflow/notification rollback cả nghiệp vụ. Audit lưu assignment snapshot, thay đổi actual/evidence, input reviewer, chuyển trạng thái và chốt kỳ.

Chỉ có MANUAL vì Projects/Tasks chưa có API thực tế. Bằng chứng là link tài liệu ngoài; chưa có upload file/object storage nên không giả lập. Không có job auto tính KPI hoặc auto phê duyệt.

## Kiểm thử

`PerformanceTests`: HIGHER/LOWER/QUALITATIVE/MILESTONE, target và trọng số sai, tổng có trọng số, locale validation qua HTTP, giao idempotent, snapshot immutable, lifecycle, assigned reviewer/no self review, no self approval, approval kết thúc, đóng kỳ khóa kết quả, SELF list/statistics không leak, DEPARTMENT không giao ngoài phạm vi, copy kỳ trước, rollback khi workflow thiếu, concurrency cùng version và XLSX.

Frontend `performance/PerformanceWorkspace.test.jsx`: dữ liệu API thật qua adapter, filter/paging, error không giả số, quyền VIEW, start version, tạo kỳ. API Inventory kiểm tra route duy nhất + JWT/ScreenPermission và model snapshot không pending.

Chạy `dotnet build backend/HRM.API/HRM.API.csproj`, `dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj`, trong web-admin `npm test` và `npm run build`. Không apply migration. Kết quả liên quan KPI/Approval/API inventory/schema: 27/27 đạt. Frontend: 78/78 đạt; npm run build đạt. dotnet build đạt, không warning/error. Bộ backend đầy đủ còn các lỗi cũ EmployeeCreationTests do tests mong prefix NV trong khi source dùng TX; xem kết quả chạy cuối bên dưới.

Các test SQLite xác minh transaction/concurrency ở cấp nghiệp vụ; chưa thay thế kiểm thử cạnh tranh trên MySQL staging sau khi người vận hành duyệt Migration. SQL Migration được kiểm tra offline, không dùng connection production.

## Kết quả xác nhận 2026-11-23

- `dotnet build backend/HRM.API.Tests/HRM.API.Tests.csproj --no-restore`: đạt, 0 warning / 0 error (bao gồm Backend API).
- Test chọn KPI + Approval + inventory + migration/model: 27 đạt / 27.
- `dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj --no-build`: **570 đạt, 9 lỗi / 579**. Chín lỗi đều thuộc EmployeeCreationTests hiện có: kỳ vọng NV nhưng source EmployeeCodeGenerator dùng TX, bao gồm test mã legacy/rollback dựa trên tiền tố NV. Không sửa module mã nhân viên trong phạm vi KPI.
- `npm run build`: đạt. `npm test`: **78 đạt / 78**, 11 file.
- `git diff --check`: đạt. Hai Postman Collection JSON hợp lệ, folder Performance có25 request riêng biệt.
- Migration được kiểm tra offline về hai bảng mới, index thay thế trước khi drop index employee FK, model không pending. Không chạy database update, không sửa DB thực tế, không deploy Railway. Chưa chạy concurrency trên MySQL thực tế.

## Bổ sung KPI Unit Catalog

Migration `20261123111950_AddKpiUnitCatalog` tạo kpi_units, seed11 đơn vị, import code legacy vào chính catalog mới và thêm nullable FK unit_id cho metric. Không đổi unit string/snapshot cũ, không backfill FK hàng loạt. GET/POST units và GET/PUT units/{id} dùng KPI Configuration; ghi global scope ALL, version và audit. Chọn metric mới cần code active; metric cũ được giữ code inactive/legacy. Frontend tab Đơn vị KPI quản lý danh mục và dropdown tải units active từ API, không còn list cố định.

Kiểm thử KPI/Units/API Inventory/Approval/schema: 30/30 đạt. Frontend: 80/80 đạt. Backend và Frontend build thành công; git diff --check đạt. Chưa apply Migration, chưa deploy; chưa chạy Migration trên MySQL thực tế.
