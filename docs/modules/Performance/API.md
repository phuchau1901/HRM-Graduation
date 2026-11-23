# KPI API Specification

Base path `/api/kpi`; JWT bắt buộc. JSON camelCase. Trả lỗi theo chuẩn `{success:false,code,error,message,traceId}`. Danh sách `{success,total,page,pageSize,data}`, page>=1, pageSize1..100 (mặc định30); `search` mã/tên. Mutation trả `{success:true,data:...}` cho cấu hình; evaluation action trả `{success:true,id,status,version,...}`. GET template trả `{template,criteria}`; lookups trả `{departments,teams,positions}`.

## Configuration — WEB_KPI_CONFIGURATION

| Method | Path sau /api/kpi/configuration | Action / Scope |
| --- | --- | --- |
| GET | /lookups | VIEW + scope: org dùng trong biểu mẫu |
| GET | /employees | VIEW + scope, active, phân trang/search |
| GET | /periods | VIEW + scope cấu hình hợp lệ |
| POST | /periods | NEW / ALL |
| POST | /periods/{id:long}/close | UPDATE / ALL, version |
| GET | /units | VIEW + scope cấu hình hợp lệ; search, isActive, paging |
| GET | /units/{id:long} | VIEW + scope cấu hình hợp lệ |
| POST | /units | NEW / ALL |
| PUT | /units/{id:long} | UPDATE / ALL, version |
| GET | /metrics | VIEW + scope cấu hình hợp lệ |
| POST | /metrics | NEW / ALL |
| PUT | /metrics/{id:long} | UPDATE / ALL, version |
| GET | /templates | VIEW + scope |
| GET | /templates/{id:long} | VIEW + scope |
| POST | /templates | NEW / DEPARTMENT hoặc ALL |
| PUT | /templates/{id:long} | UPDATE / DEPARTMENT hoặc ALL, version, chỉ DRAFT |
| POST | /templates/{id:long}/publish | UPDATE / DEPARTMENT hoặc ALL, version |
| POST | /assignments | NEW / DEPARTMENT hoặc ALL |

Tạo kỳ: `{ "periodType":"MONTH", "year":2026, "number":11 }`. MONTH number1..12; QUARTER1..4; YEAR number1. Tự tính code `2026-11`, `2026-Q4`, `2026` và khoảng ngày theo lịch nghiệp vụ Việt Nam. Code unique, không tạo kỳ trùng. Chốt: `{ "version":1 }`; chỉ chốt khi mọi target trong kỳ APPROVED hoặc REJECTED. Không có API mở lại.

Tạo/sửa metric:

```json
{"code":"SALES","name":"Doanh số","unit":"VND","direction":"HIGHER","method":"RATIO","source":"MANUAL","maxScore":100,"milestones":[],"isActive":true,"version":0}
```

Direction/method: HIGHER/RATIO, LOWER/RATIO, QUALITATIVE/DIRECT, MILESTONE/MILESTONE. Milestones ví dụ `[{"threshold":10,"score":40},{"threshold":20,"score":100}]`: ngưỡng không trùng, score không giảm theo ngưỡng. maxScore1..200. Version khi sửa là version GET hiện hành. Không hardcode công thức theo chức vụ.

Tạo/sửa template:

```json
{"code":"SALES_MONTH_V1","name":"KPI Sales tháng","periodType":"MONTH","departmentId":null,"teamId":null,"positionId":null,"version":0,"criteria":[{"metricId":1,"weightPercent":100,"targetValue":100000000}]}
```

Chọn tối đa **một** departmentId, teamId hoặc positionId; cả ba NULL nghĩa dùng chung. Template Position cần scope ALL để quản trị vì Position dùng chung; template phòng ban/Team cho phép DEPARTMENT đúng phòng. DEPARTMENT được đọc/giao template dùng chung hoặc theo Position phù hợp, nhưng không sửa/phát hành template dùng chung. Tổng trọng số chính xác100, từng trọng số >0, tối đa hai chữ số lẻ; metric không trùng, active; ratio target>0. Mục tiêu/kết quả tối đa bốn chữ số lẻ. Snapshot metric được giữ trong từng criterion. Publish `{version:1}` chuyển DRAFT→PUBLISHED. Không sửa template đã phát hành, tạo template mã mới khi thay đổi bộ KPI. Sửa catalog không tác động snapshot template/target đã lưu.

Giao / bulk / copy:

```json
{"periodId":1,"templateId":1,"reviewerEmployeeId":32,"target":"EMPLOYEE","employeeIds":[15,16],"departmentId":null,"teamId":null,"copyFromPeriodId":null}
```

Target ALL, DEPARTMENT (+departmentId), TEAM (+teamId), EMPLOYEE (+employeeIds). ALL nghĩa toàn bộ nhân viên **trong scope NEW**, không vượt scope. Chỉ active, HireDate<=ngày cuối kỳ, đúng applicability template; reviewer trong scope và có active linked user. Nếu reviewer chính cũng thuộc đợt giao (ví dụ ALL), bắt buộc thêm `alternateReviewerEmployeeId` khác họ, active/có linked user và trong scope; riêng KPI của reviewer chính giao cho người thay thế, các nhân viên còn lại dùng reviewer chính. Không bỏ qua nhân viên và không cho tự đánh giá. Giới hạn1000 nhân viên/đợt; dữ liệu không hợp lệ làm rollback cả đợt. Một nhân viên/kỳ chỉ có một bộ KPI. Giao lại trả `created:0,alreadyAssigned:N`, không sửa KPI đã có.

Để copy: giữ periodId là kỳ mới, điền copyFromPeriodId là kỳ trước cùng loại, kết thúc trước ngày bắt đầu kỳ đích. Copy snapshot của **cùng template** trên từng nhân viên, không copy kết quả/trạng thái/điểm. Nếu nhân viên chưa có KPI nguồn thì từ chối cả đợt. Response `{success:true,created,alreadyAssigned,ids}`.

## Evaluation — WEB_KPI_EVALUATION

| Method | Path sau /api/kpi/evaluations | Action |
| --- | --- | --- |
| GET | / | VIEW |
| GET | /periods | VIEW |
| GET | /lookups | VIEW |
| GET | /employees | VIEW |
| GET | /statistics | VIEW |
| GET | /export | EXPORT, .xlsx |
| GET | /{id:long} | VIEW |
| POST | /{id:long}/start | UPDATE, chỉ chủ KPI |
| PUT | /{id:long}/results | UPDATE, chỉ chủ KPI |
| POST | /{id:long}/submit | UPDATE, chỉ chủ KPI |
| POST | /{id:long}/review | APPROVE, chỉ reviewer được giao |

Tất cả áp scope action SELF/DEPARTMENT/ALL. Danh sách/thống kê/export cùng bộ lọc `periodId`, `departmentId`, `teamId`, `employeeId`, `status`, `search`. Không lộ tên/mã/count/score ngoài scope. Danh sách gồm employeeCode, employeeName, departmentName, teamName, periodKey, finalScore (chưa đánh giá là null), status, reviewerEmployeeId, version, approvalId. Statistics `{success:true,data:{total,statuses:[{status,count}],averageScore}}`; trung bình chỉ target APPROVED, không có điểm là null. SQL GROUP BY / AVG, không load toàn bộ target để thống kê. Export tối đa10000 dòng; quá giới hạn yêu cầu lọc hẹp hơn. Chuỗi trong Excel dùng inline strings, không thực thi công thức từ tên nhân viên.

Chi tiết `{success:true,data:{target,criteria,results,reviewerComment,isClosed,history}}`; history tối đa100 sự kiện gần nhất có before/after trong Audit Logs (chi tiết trả afterJSON). Results giữ selfScore, managerScore và actualValue của nhân viên. Evidence dùng liên kết tài liệu HTTP(S), tối đa2000 ký tự, không có credentials; server không tải URL hoặc lưu file. Chưa có dịch vụ upload attachment trong dự án, không giả lập upload.

Start/submit `{ "version":1 }`. Lưu kết quả:

```json
{"version":2,"results":[{"criterionId":1,"actualValue":80000000,"comment":"Kết quả kỳ","evidenceUrl":"https://example.com/evidence.pdf"}]}
```

Lưu từng phần được phép; submit chỉ khi mọi chỉ tiêu đã có actualValue. criterionId phải nằm trong snapshot, không nhận weight/target/formula từ client. Backend luôn tính selfScore. URL evidence tùy chọn. DRAFT phải start trước; IN_PROGRESS mới sửa được. Gửi xong không được sửa.

Review:

```json
{"version":4,"comment":"Đã đối chiếu bằng chứng","results":[{"criterionId":1,"actualValue":90000000}]}
```

Reviewer cung cấp kết quả quản lý cho **đủ** chỉ tiêu. Backend tính managerScore và finalScore, lưu PerformanceReview cùng audit gồm input review. Giữ actualValue/bằng chứng gốc của nhân viên. Transaction đồng thời tạo request KPI_EVALUATION; thiếu workflow/approver cấu hình làm rollback review, target vẫn SUBMITTED.

## Approval tích hợp

Cấu hình `GET/PUT /api/approval-workflow-settings` thêm route `requestType:"KPI_EVALUATION"` với các bước TEAM_LEAD (teams.LeadEmployeeId), DEPARTMENT_MANAGER (departments.ManagerEmployeeId), USER (employeeId) hoặc HR theo engine có sẵn. Không kiểm tra grant người duyệt khi giao/gửi; kiểm tra khi duyệt thực tế. User người duyệt phải còn liên kết đúng EmployeeId snapshot. Không cho tự duyệt KPI kể cả route allowSelfApproval=true.

Dùng API hiện có `/api/approvals?module=PERFORMANCE`, `/api/approvals/{id}`, `/approve`, `/reject`, `/history`. Mỗi bước cần WEB_APPROVALS APPROVE + scope, thêm WEB_KPI_EVALUATION APPROVE + scope; không bỏ bước, không duyệt trùng. Chi tiết cần VIEW của cả hai module và scopes tương ứng. Kết thúc APPROVED/REJECTED cập nhật target cùng transaction và thông báo cho nhân viên.

## Concurrency / Errors

Version bắt buộc trên start/results/submit/review/publish/close/update. Stale version hoặc transition sai409; ngoài scope403/404; validation400; không grant403; không JWT401. Transaction Serializable và khóa kỳ/target; unique employee/period chống giao trùng đồng thời. Deadlock1205/1213/duplicate1062 trả409, client reload trước khi thử lại, không tự replay decision. No N+1: query employee/org bằng joins; bulk lấy criteria, employees, existing, users theo tập, audit theo batch. Kỳ chốt khóa mọi ghi kết quả và quyết định workflow.

Frontend cấu hình chỉ tiêu: unit dùng dropdown bắt buộc chọn, tải toàn bộ trang GET `/api/kpi/configuration/units?isActive=true`. Không còn danh sách cố định trong Frontend. Giá trị gửi qua `unit` là code của đơn vị; backend tra danh mục và lưu `unitId` FK kèm code vào metric. API không nhận unitId để thay code; unitId trong response là tham chiếu backend giải quyết.

## Danh mục đơn vị KPI

Bảng `kpi_units`: id, code (unique, tối đa30), name (tối đa100), is_active, sort_order (0..100000), version. Cùng WEB_KPI_CONFIGURATION VIEW/NEW/UPDATE; thao tác ghi cần scope ALL vì danh mục dùng chung. GET hỗ trợ search code/name, isActive=true/false, page/pageSize; trả PageResult như danh sách khác. GET detail và POST/PUT trả `{success:true,data:{id,code,name,isActive,sortOrder,version}}`.

Tạo đơn vị:

```http
POST /api/kpi/configuration/units
```

```json
{"code":"KG","name":"Kilôgam","isActive":true,"sortOrder":20}
```

Sửa tên, thứ tự hoặc ngừng dùng:

```http
PUT /api/kpi/configuration/units/12
```

```json
{"code":"KG","name":"Kilogram","isActive":false,"sortOrder":20,"version":1}
```

Lấy id/version thật từ GET hoặc POST response, không mặc định12. Code không được đổi sau tạo; muốn code khác thì thêm đơn vị mới. Duplicate code/stale version/đổi code trả409; chưa login401; thiếu quyền/scope403; đơn vị mới không có hoặc inactive khi tạo metric trả400. Không có API xóa cứng; dùng isActive=false để giữ FK và lịch sử.

Tạo/sửa chỉ tiêu vẫn gửi `unit:"KG"`. Chỉ tiêu mới hoặc đổi đơn vị phải chọn code active. Khi sửa chỉ tiêu cũ có thể giữ nguyên unit inactive/legacy; frontend giữ option hiện tại để không tự đổi dữ liệu. Thay đổi tên/status của đơn vị không sửa mục tiêu, kết quả hoặc snapshot KPI đã giao.

Migration `20261123111950_AddKpiUnitCatalog` tạo kpi_units và FK nullable kpi_metrics.unit_id. Seed11 đơn vị chuẩn: %, VND, Điểm, Số lượng, Giờ, Ngày, Lần, Sản phẩm, Công việc, Khách hàng, Hợp đồng. SQL Migration nhập thêm các code khác rỗng đã có trong kpi_metrics vào danh mục mới, không sửa metric.unit hoặc snapshot. Bản ghi metric cũ có unit_id=NULL vẫn đọc được; lần sửa chỉ tiêu hợp lệ sẽ liên kết với catalog. Cần người vận hành chạy Migration trên đúng database trước khi dùng API; không tự apply/deploy.

## Tên đối tượng áp dụng trong template

GET `/api/kpi/configuration/templates` giữ các field id/code/name/periodType/status/departmentId/positionId/teamId/version và bổ sung departmentName, positionName, teamName vào từng phần tử data. Không cấu hình quan hệ thì cả ID và tên tương ứng là null. GET `/api/kpi/configuration/templates/{id}` cũng trả các field tên trong object template, giữ criteria như cũ. Source lọc scope trước count/paging và LEFT JOIN metadata trong query dữ liệu, không query từng template/N+1. Không thay schema hoặc quyền.

### Chẩn đoán tổng số template khác với màn SQL

GET templates thêm response headers X-Effective-Data-Scope (Scope thực tế backend đọc từ các Role của user) và X-Search-Applied=true/false. Body giữ PageResult như cũ. ALL không thêm WHERE phòng ban/Team; total là COUNT sau scope/search, trước LEFT JOIN và phân trang. Với cùng database có6 template và không search, ALL phải trả total6. ALL có search vẫn có thể trả total1. Scope cao nhất trong các Role có VIEW hợp lệ được dùng; không phụ thuộc thứ tự Role.

Khi terminal logging cho user/module Performance bật Y, event1101 KpiTemplateQuery ghi EffectiveScope, SearchApplied, Page/PageSize, Total, ReturnedCount, DatabaseServer và DatabaseName. Không ghi connection string/password/token, raw search, SQL parameters hoặc count ngoài phạm vi được phép. Dùng cùng TerminalTraceId để ghép access event. Thông tin database chỉ trong log vận hành, không trả về response.

Đối chiếu bằng query chỉ đọc trên màn SQL: `SELECT DATABASE() AS database_name, COUNT(*) AS total FROM kpi_templates;`. Nếu header ALL, Search-Applied=false mà total1 trong khi màn SQL có6, cần so backend/database/proxy hoặc phiên bản deploy thực tế; không tự bỏ Scope hay sửa grant để che lỗi.
