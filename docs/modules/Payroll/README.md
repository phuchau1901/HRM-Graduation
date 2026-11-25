# Payroll & Compensation

[API](API.md) · [Chính sách và công thức](CALCULATION.md) · [Database](../../guides/DATABASE.md) · [Postman](../../HRM-API.postman_collection.json)

## Audit và phần triển khai

Trước thay đổi: đã có 5 Entity/Fluent Configuration và bảng trong Initial migration: `salary_profiles`, `timesheet_periods`, `timesheet_details`, `payroll_periods`, `payroll_details`. Chưa có Controller, engine nghiệp vụ hoặc UI Payroll. `TimesheetLocks` chặn thay đổi công khi kỳ đóng nhưng chưa có API tổng hợp/chốt và snapshot nguồn công. Approval Workflow đã có registry module, nhiều cấp, người được giao, version và transaction.

Bổ sung trên chính 5 bảng: cấu hình lương có hiệu lực, snapshot công và lương, phiên bản, idempotency, trạng thái kỳ, tham chiếu Approval và xác nhận thanh toán. Chỉ thêm ba bảng thiếu: `salary_components`, `payroll_policies`, `payroll_adjustments`. API/UI Salary Configuration, Payroll Management, My Payslips; module con `PAYROLL` trong Approval Center, loại `PAYROLL_PERIOD`. Không sửa API Organization/Employees để trả lương.

Frontend: `/#/payroll/configuration`, `/#/payroll/management`, `/#/payroll/my-payslips`. Có loading, lỗi, empty state, phân trang, lọc, drawer, Excel và PDF Unicode; không có số tiền mock hoặc số liệu giả khi API lỗi.

## Quyền

| Màn hình | Action | Data Scope |
|---|---|---|
| `WEB_SALARY_CONFIGURATION` | VIEW; NEW hồ sơ/khoản/chính sách; UPDATE khoản, bản nháp, phát hành chính sách | SELF/DEPARTMENT/ALL cho đọc hồ sơ. Ghi hồ sơ DEPARTMENT/ALL; đóng hồ sơ cũ khi thay lương cần cả NEW và UPDATE với scope hợp lệ. Danh mục/chính sách chung chỉ ALL khi ghi |
| `WEB_PAYROLL` | VIEW, NEW tạo kỳ/công, UPDATE tính/gửi/điều chỉnh, APPROVE chốt công/chốt lương/thanh toán, EXPORT | Theo từng action. SELF chỉ đọc lương mình. DEPARTMENT quản lý batch đúng phòng ban. ALL quản lý toàn công ty |
| `WEB_MY_PAYSLIPS` | VIEW, EXPORT PDF | Chỉ nhân viên liên kết tài khoản đăng nhập; không cần scope cấu hình và không được mở rộng sang người khác |
| `WEB_APPROVALS` | VIEW/APPROVE và scope phù hợp | Đồng thời phải có WEB_PAYROLL VIEW/APPROVE; giao của scope hai màn hình phải bao phủ toàn batch và được giao đúng bước |

Migration thêm screen nếu chưa tồn tại, **không tự cấp grant**. Quyền hồ sơ nhân viên không cấp quyền lương. Tài khoản mất quyền/scope bị kiểm tra lại tại request/decision. Các khoản tiền, lý do thay đổi lương, policy và snapshot không được đưa vào generic Audit Log, push hoặc terminal log. Audit chỉ ID/trạng thái/ngày/hash; lịch sử tài chính được giữ ở hồ sơ, adjustment và snapshot có quyền riêng.

## Thứ tự vận hành

1. Cấp quyền; tạo components, policy nháp với căn cứ pháp lý, phát hành policy. Cấu hình lương nhân viên bằng hồ sơ mới, lý do bắt buộc. Thay đổi lương dùng `supersedeProfileId`/`supersedeVersion` để đóng khoảng cũ, không thay số tiền lịch sử.
2. Hoàn tất Attendance Adjustment/Leave/Overtime/KPI liên quan. Tạo và tổng hợp bảng công tháng; xem lỗi/cảnh báo. Chốt công sau khi tháng kết thúc theo giờ Việt Nam.
3. Tạo batch lương toàn công ty hoặc một phòng ban từ công LOCKED. Chọn policy, tính; tất cả nhân viên phải hợp lệ mới lưu kết quả REVIEW. Có lỗi: OPEN, lưu danh sách lỗi, không phát hành kết quả một phần.
4. Điều chỉnh thu nhập/khấu trừ có lý do; tính lại. Cấu hình route `PAYROLL_PERIOD` trong Approval Settings. Các bước TEAM_LEAD/DEPARTMENT_MANAGER tự lấy quản lý Team/phòng ban của nhân viên liên kết user gửi duyệt, áp dụng cả kỳ toàn công ty; không lấy nhân viên đầu tiên trong bảng lương. USER/HR chọn người duyệt cụ thể như các module khác. Người gửi cần liên kết nhân viên ACTIVE. Phân công không cấp quyền duyệt: người được giao vẫn cần quyền và Data Scope bao phủ toàn kỳ. Không bật self approval. Người lập/gửi hoặc người tính không được quyết định duyệt.
5. Gửi duyệt → REVIEW kèm approvalId. Các quyết định qua `/api/approvals/{id}/approve|reject`, không có endpoint tắt bỏ Workflow. Từ chối trả REVIEW, gỡ liên kết pending để có thể sửa/tính lại/gửi lại; lịch sử approval vẫn được lưu.
6. Duyệt cuối → APPROVED. Chốt → LOCKED, phát hành phiếu cá nhân và một thông báo không chứa tiền cho mỗi nhân viên. Chỉ chuyển PAID khi có reference chứng từ và paidAt hợp lệ. Không tự chuyển PAID.

Không có endpoint sửa kỳ LOCKED/PAID hoặc mở lại âm thầm. Sai sót sau khóa phải dùng khoản điều chỉnh ở kỳ OPEN tiếp theo có lý do; không viết đè snapshot cũ.

## Migration cần duyệt

`20261123171325_CompletePayrollCompensation` — chưa apply, không deploy. Xem [database](../../guides/DATABASE.md#payroll--compensation).

Legacy salary chưa xác nhận `pay_basis`/components không được tự suy diễn. Dùng hồ sơ thay thế có hiệu lực phù hợp; legacy snapshot null phải được đối soát trước sử dụng, không tự tính lại lịch sử bằng cấu hình ca hiện tại. Không backfill số tiền, không xóa dòng cũ. Migration Down có thể không thực hiện được nếu sau nâng cấp đã có nhiều batch phòng ban cùng tháng (unique cũ chỉ period_key); cần quy trình rollback riêng có backup.

## Kiểm thử

`PayrollTests`: công chuẩn, phép có/không lương, lương tháng/giờ và thay đổi giữa tháng, OT qua đêm cắt tại ngày lễ, tax/insurance/rounding, KPI cần APPROVED, đầu vào lỗi, idempotency, đồng thời tạo kỳ trên SQLite file, điều chỉnh/hủy/tính lại, scope SELF/DEPARTMENT/ALL và nhiều role, lifecycle Workflow/khóa/thanh toán, PDF Unicode.

`PayrollMigrationTests`: chỉ thêm ba bảng, giữ năm bảng cũ, unique chống trùng, screen không tự cấp quyền, SQL MySQL và snapshot được kiểm tra offline. SQLite integration không thay thế kiểm thử đồng thời/DDL trên MySQL staging; không kết nối DB production trong lần triển khai này.

## Kết quả xác minh lần triển khai này

- `dotnet build backend/HRM.API/HRM.sln --no-restore -v minimal -p:UseSharedCompilation=false`: thành công, 0 warning / 0 error.
- `dotnet test ... --filter FullyQualifiedName~Payroll`: 19/19 pass (17 nghiệp vụ/engine và 2 migration).
- Toàn bộ backend: 619 pass / 9 fail / 628 tests. Các lỗi hiện có ở `EmployeeCreationTests`: test kỳ vọng tiền tố NV trong khi `EmployeeCodeGenerator` hiện sinh TX, bao gồm interceptor vẫn dò mã NV. Không thay đổi generator hoặc các test đó trong phạm vi Payroll.
- `npm run build` tại web-admin: thành công. `npm test`: 86/86 pass, gồm 6 tests UI Payroll.
- 35 route Payroll không trùng, khớp hai Postman Collection; `git diff --check` sạch.
- SQL migration được sinh offline với connection giả, snapshot/model và unique constraints được kiểm tra; không apply migration, không kết nối dữ liệu live, không đổi hoặc deploy Railway.

Giới hạn vận hành cần lưu ý: policy phải phủ trọn tháng; source preparation tối đa 2.000 nhân viên; phân bổ phép/break tuân theo dữ liệu hiện có như mô tả trong [CALCULATION](CALCULATION.md). Cần kiểm thử DDL và concurrency trên MySQL staging theo quy trình được duyệt trước khi đưa vào sử dụng thực tế.
