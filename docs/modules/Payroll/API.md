# Payroll API Specification

[Hướng dẫn vận hành](README.md) · [Công thức](CALCULATION.md)

Tất cả endpoint yêu cầu JWT còn hiệu lực, screen/action live và scope theo bảng quyền trong README. Response có `Cache-Control: no-store`. ID BIGINT. `page=1&pageSize=20`, tối đa pageSize=100; tìm kiếm `search` tối đa 150 ký tự.

| Method | Endpoint | Screen / action |
|---|---|---|
| GET | `/api/payroll/employees` | `WEB_PAYROLL` / VIEW |
| GET | `/api/payroll/export` | `WEB_PAYROLL` / EXPORT |
| GET | `/api/payroll/lookups` | `WEB_PAYROLL` / VIEW |
| GET | `/api/payroll/payslips` | `WEB_PAYROLL` / VIEW |
| GET | `/api/payroll/payslips/{id:long}` | `WEB_PAYROLL` / VIEW |
| GET | `/api/payroll/periods` | `WEB_PAYROLL` / VIEW |
| POST | `/api/payroll/periods` | `WEB_PAYROLL` / NEW |
| GET | `/api/payroll/periods/{id:long}/adjustments` | `WEB_PAYROLL` / VIEW |
| POST | `/api/payroll/periods/{id:long}/adjustments` | `WEB_PAYROLL` / UPDATE |
| POST | `/api/payroll/periods/{id:long}/adjustments/{adjustmentId:long}/cancel` | `WEB_PAYROLL` / UPDATE |
| POST | `/api/payroll/periods/{id:long}/calculate` | `WEB_PAYROLL` / UPDATE |
| POST | `/api/payroll/periods/{id:long}/lock` | `WEB_PAYROLL` / APPROVE |
| POST | `/api/payroll/periods/{id:long}/paid` | `WEB_PAYROLL` / APPROVE |
| POST | `/api/payroll/periods/{id:long}/submit` | `WEB_PAYROLL` / UPDATE |
| GET | `/api/payroll/policies` | `WEB_PAYROLL` / VIEW |
| GET | `/api/payroll/statistics` | `WEB_PAYROLL` / VIEW |
| GET | `/api/payroll/timesheets` | `WEB_PAYROLL` / VIEW |
| POST | `/api/payroll/timesheets` | `WEB_PAYROLL` / NEW |
| GET | `/api/payroll/timesheets/{id:long}` | `WEB_PAYROLL` / VIEW |
| POST | `/api/payroll/timesheets/{id:long}/calculate` | `WEB_PAYROLL` / UPDATE |
| POST | `/api/payroll/timesheets/{id:long}/lock` | `WEB_PAYROLL` / APPROVE |
| GET | `/api/payslips/me` | `WEB_MY_PAYSLIPS` / VIEW |
| GET | `/api/payslips/me/{id:long}` | `WEB_MY_PAYSLIPS` / VIEW |
| GET | `/api/payslips/me/{id:long}/pdf` | `WEB_MY_PAYSLIPS` / EXPORT |
| GET | `/api/salary-configuration/components` | `WEB_SALARY_CONFIGURATION` / VIEW |
| POST | `/api/salary-configuration/components` | `WEB_SALARY_CONFIGURATION` / NEW |
| PUT | `/api/salary-configuration/components/{id:long}` | `WEB_SALARY_CONFIGURATION` / UPDATE |
| GET | `/api/salary-configuration/employees` | `WEB_SALARY_CONFIGURATION` / VIEW |
| GET | `/api/salary-configuration/lookups` | `WEB_SALARY_CONFIGURATION` / VIEW |
| GET | `/api/salary-configuration/policies` | `WEB_SALARY_CONFIGURATION` / VIEW |
| POST | `/api/salary-configuration/policies` | `WEB_SALARY_CONFIGURATION` / NEW |
| PUT | `/api/salary-configuration/policies/{id:long}` | `WEB_SALARY_CONFIGURATION` / UPDATE |
| POST | `/api/salary-configuration/policies/{id:long}/publish` | `WEB_SALARY_CONFIGURATION` / UPDATE |
| GET | `/api/salary-configuration/profiles` | `WEB_SALARY_CONFIGURATION` / VIEW |
| POST | `/api/salary-configuration/profiles` | `WEB_SALARY_CONFIGURATION` / NEW |

## Response và query

- Danh sách: `{success:true,total,page,pageSize,data:[...]}`. Object/ghi: `{success:true,data:{...}}`. Lookups: `{departments:[{id,name}],teams:[{id,name,departmentId}],components:[...]}`. Employees lookup: paginated `{id,employeeCode,fullName,departmentId,teamId}`.
- Calculate trả `{success,id,status,version,employees,errors}`. HTTP 200 với success=false là nghiệp vụ tính phát hiện lỗi, không phải hoàn thành trả lương. Chi tiết lỗi trong period.errorsJson hoặc source details. Không tạo kết quả một phần.
- Lỗi theo BusinessException format chung: 400 validation, 403 permission/scope, 404 không tồn tại/ngoài scope, 409 version/trạng thái/dữ liệu thay đổi/xung đột.
- Profiles/Payslips/Statistics hỗ trợ `employeeId`, `departmentId`, `teamId`, `search`; Payslips/Statistics thêm `periodKey=yyyy-MM`, `status`. Periods lọc periodKey/status/departmentId. Scope áp trước filter/count/sum/paging.
- Periods chỉ trả batch có thể quản lý trọn vẹn (ALL hoặc phòng ban tương ứng). SELF xem dòng lương mình qua payslips/statistics, không thấy lỗi của toàn batch. Timesheets list chỉ trả lỗi chung cho ALL; details lọc dòng theo scope.
- PayrollRow: id, payrollPeriodId, periodKey, employeeId, employeeCode, employeeName, departmentName, teamName, status, gross, deductions, net, currencyCode. Profiles row: `{profile:{id,employeeID,...},employeeCode,employeeName}` (entity legacy dùng JSON employeeID).
- Detail: `{row,result,snapshot}`. result gồm baseSalary/allowances/overtimePay/kpiBonus/gross/tax/insurance/employerInsurance/deductions/net/lines; mỗi line có code/name/kind/amount/taxableAmount/taxDeductible/formula. My Payslips snapshot=null; không trả profile/rules HR. Chỉ LOCKED/PAID.
- Statistics: `{success:true,data:{employees,gross,deductions,net,currencyCode}}`, cùng filter và scope danh sách, 0 chỉ khi thực sự không có dòng.
- EXPORT Payroll trả XLSX với tối đa 10.000 dòng sau scope/filter; vượt thì 400 yêu cầu thu hẹp. PDF own yêu cầu WEB_MY_PAYSLIPS/EXPORT, đúng employee liên kết và kỳ LOCKED/PAID, font tiếng Việt được nhúng. Không nhận employeeId để giả mạo chủ thể.

## Payload

### Components

```json
{
  "code": "MEAL",
  "name": "Phụ cấp ăn",
  "kind": "EARNING",
  "taxable": true,
  "taxDeductible": false,
  "overtimeIncluded": false,
  "isActive": true,
  "version": 0
}
```

Kind EARNING/DEDUCTION. Code/kind bất biến sau tạo. BASE/ALLOWANCE/NIGHT/OVERTIME/KPI/TAX và INS_* dành riêng cho engine. UPDATE truyền version hiện tại. Danh mục chung chỉ scope ALL được ghi.

### Hồ sơ lương và thay đổi lương

Xem [salary-profile.sample.json](../../API/salary-profile.sample.json). Tiền không âm, tối đa 1.000.000.000.000, tối đa hai chữ số thập phân; reason bắt buộc. PayBasis MONTH/DAY/HOUR. Items `{componentId,amount,prorate}` dùng component active, không trùng. Ngày không trước HireDate, không chồng lấn. Tạo bản mới thay bản hiện có: thêm supersedeProfileId và supersedeVersion, EffectiveFrom phải sau ngày bắt đầu bản trước. Số tiền bản cũ giữ nguyên, chỉ đóng EffectiveTo; supersede cần thêm UPDATE và scope UPDATE bao phủ nhân viên bên cạnh NEW. Không chỉnh khoảng ảnh hưởng kỳ submitted/approved/locked/paid.

### Policy

Xem [payroll-policy.sample.json](../../API/payroll-policy.sample.json): **chỉ là dữ liệu kiểm thử, không phải tỷ lệ luật Việt Nam**. PUT draft truyền version. Publish `{version,supersedePolicyId:null,supersedeVersion:null}`. Giải thích toàn bộ rules trong [CALCULATION](CALCULATION.md). Policy không bao phủ toàn tháng hoặc sai currency bị từ chối khi tính, không tự fallback.

### Timesheet và Payroll period

- POST timesheets: `{periodKey:"2026-10"}` (idempotent nếu source tháng đã có).
- POST periods: `{periodKey:"2026-10",departmentId:null}` (null=ALL). Không tạo global và department batch chồng nhau cùng tháng. Hai department khác nhau có thể tách batch; unique employee/month vẫn chống trả trùng do chuyển phòng.
- POST calculate: `{version:1,requestKey:"operation-unique-key",policyId:1}`; policyId chỉ dùng Payroll, tùy chọn nếu chỉ có đúng một policy phủ tháng. Mỗi lần tính mới dùng key mới; retry giữ nguyên key. Cùng key gần nhất trả receipt hiện tại trước check stale version; không dùng key với policy khác.
- POST submit / lock: `{version:2}`. Lock Timesheet yêu cầu hết tháng theo Asia/Ho_Chi_Minh, snapshot/hash hợp lệ và không có lỗi; còn OPEN/DRAFT thì chỉ được tổng hợp lại.
- POST paid: `{version:5,reference:"BANK-TRANS-123",paidAt:"2026-11-17T12:00:00+07:00"}`. Có chứng từ, sau lockedAt, không tương lai. Không chuyển PAID trực tiếp từ REVIEW/APPROVED.

### Adjustments

POST `{employeeId:1,componentId:1,amount:500000,reason:"Thưởng theo quyết định",requestKey:"bonus-batch-unique"}`. Key toàn cục unique; dùng lại với payload khác trả 409. GET trả lịch sử bao gồm cancelled; cancel `{version:1}` giữ dòng cũ và đánh dấu hủy. OPEN hoặc REVIEW chưa pendingapproval; thay đổi làm mất hiệu lực kết quả, phải tính lại.

### Approval

Cấu hình qua API hiện có `/api/approval-workflow-settings`, giữ các route khác và thêm `{requestType:"PAYROLL_PERIOD",allowSelfApproval:false,steps:[{approverType:"HR",userId:"hr-payroll",roleCode:"HR"}]}` hoặc USER employeeId. Bộ phận/phạm vi phải phù hợp toàn batch. Quyết định và history dùng các API `/api/approvals` hiện có; không tạo workflow thứ hai.

Tiền tệ giữ theo policy từng phiếu, có trong danh sách và Excel. Statistics không cộng lẫn nhiều currency; trả 400 yêu cầu thu hẹp bộ lọc khi phạm vi gồm nhiều loại tiền. Không tự đổi tỷ giá.

Danh sách, thống kê và export chỉ lấy kết quả có policy/input hash và unique calculation keys đã xác nhận. Các dòng legacy chưa đối soát hoặc kết quả vừa bị vô hiệu do adjustment không được trình bày như phiếu 0 thu nhập; phải tổng hợp/tính lại hợp lệ trước khi phát hành.
