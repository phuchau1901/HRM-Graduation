# Employees — API hồ sơ nhân viên

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

Phạm vi `dataScopes`: xem [giá trị hỗ trợ, bảng scope theo endpoint và cách cấu hình qua API role](DATA_SCOPE.md#cấu-hình-datascopes-cho-api-nhân-viên). Scope được cấu hình qua API permissions của role, không truyền trong body API nghiệp vụ.

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/employees` | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/employees/unlinked` | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/employees/{employeeId}` | WEB_EMPLOYEES / VIEW + data scope |
| POST | `/api/employees` | WEB_EMPLOYEES / NEW + data scope |
| PUT | `/api/employees/{employeeId}` | WEB_EMPLOYEES / UPDATE + data scope |
| DELETE | `/api/employees/{employeeId}` | WEB_EMPLOYEES / DELETE + data scope |
| PATCH | `/api/employees/{employeeId}/department` | WEB_EMPLOYEES / UPDATE + data scope |

## Response đọc nhân viên và tên danh mục

`GET /api/employees` và `GET /api/employees/{employeeId}` trả EmployeeDto có đầy đủ định danh và tên tổ chức. `/unlinked` dùng cùng DTO/projection. Các trường hồ sơ cũ giữ nguyên để tương thích.

| Field | Kiểu JSON | Ghi chú |
| --- | --- | --- |
| id | integer | Employee.Id |
| employeeCode | string | Mã nhân viên server cấp hoặc mã legacy |
| fullName | string | Họ và tên |
| email | string | Email hồ sơ |
| departmentId | integer | FK Department; model hiện tại bắt buộc |
| departmentName | string/null | departments.DepartmentName |
| teamId | integer/null | Team tùy chọn, cùng Department |
| teamName | string/null | teams.TeamName, null khi chưa gán/không có bản ghi liên quan |
| positionId | integer (int64)/null | Position tùy chọn |
| positionName | string/null | positions.name, null khi chưa gán/không có bản ghi liên quan |
| employmentStatus | string | ACTIVE/INACTIVE/TERMINATED |
| dateOfBirth | date/null | Giữ nguyên |
| phoneNumber | string/null | Giữ nguyên |
| hireDate | date | Giữ nguyên |
| createdAt | datetime UTC | Giữ nguyên |

Tên nullable trong response, không đổi DepartmentId thành nullable trong model. Với dữ liệu hợp lệ hiện tại, Department bắt buộc nên departmentName có tên; LEFT JOIN vẫn giữ row và trả null nếu tham chiếu legacy thiếu danh mục. Không dùng chuỗi rỗng hoặc dữ liệu giả để thay tên. Danh mục inactive vẫn trả tên cho liên kết hiện có.

List giữ chính xác envelope `success`, `total`, `page`, `pageSize`, `data`. Chi tiết trả trực tiếp một EmployeeDto, không thêm envelope mới. [JSON list](../../API/employee-list-response.sample.json) · [JSON detail](../../API/employee-detail-response.sample.json).

Backend áp WEB_EMPLOYEES/VIEW và scope SELF/DEPARTMENT/ALL như trước. Scope/filter trên Employee trước Count; order theo Id tăng dần, Skip/Take rồi Select DTO bằng LEFT JOIN Department, Team (cả TeamId + DepartmentId), Position. Phần dữ liệu danh sách chỉ có một Count và một query JOIN cho cả trang; truy vấn auth/scope cố định vẫn giữ. Không query danh mục riêng cho từng nhân viên và không materialize entity để map tên trong memory. AsNoTracking áp dụng cho các nguồn đọc.

UI list/detail dùng trực tiếp departmentName/teamName/positionName từ response; không cần quyền đọc catalog để render tên trong các hồ sơ thuộc scope được phép. `/api/departments`, `/api/teams`, `/api/positions` và quyền của chúng giữ nguyên, dùng riêng cho dropdown tạo/sửa. Tên là field response, không gửi để sửa qua body.

EmployeeDto dùng chung với response tạo/sửa/chuyển phòng: các response này cũng lấy tên bằng projection sau khi ghi và trước commit, sau kiểm tra action/scope tương ứng; không yêu cầu thêm VIEW để trả kết quả của thao tác ghi đã được phép.

Audit schema/migration thực tế và giới hạn xác minh: [báo cáo Employee GET](EMPLOYEE_READ.md). Chỉ xác nhận TeamId/PositionId có trong source/snapshot; không tự coi migration đã apply trên DB đích.

## EmployeeCode tự động, chỉ đọc

`POST /api/employees` không còn nhận/yêu cầu `employeeCode`. Server sinh `NV` + `employees.Id` tối thiểu 6 chữ số: Id 1 → `NV000001`, Id 2 → `NV000002`, Id 1000000 → `NV1000000`. Nếu bảng đã có dữ liệu thì mã đi theo Id mới, không bắt đầu lại từ 1. Không dùng SELECT MAX(EmployeeCode)+1, bộ đếm frontend hoặc bộ đếm trong memory.

- EmployeeCode VARCHAR(20) NOT NULL và unique index hiện có giữ nguyên. Không đổi mã nhân viên cũ; ví dụ GET/PUT có mã DEMO/legacy vẫn hợp lệ.
- Code được gán hoàn chỉnh trước khi transaction commit và trả 201 EmployeeDto có `employeeCode`. Mã tạm nội bộ chỉ tồn tại trong transaction chưa commit; lỗi insert/gán mã/audit thì rollback toàn bộ, không để lại hồ sơ có mã tạm/rỗng/null.
- Mã cũ có thể trùng mã theo Id sắp cấp. Khi đó chỉ bỏ row mới tạm thời và tiêu thụ slot Id đó để lấy Id kế tiếp; không sửa/xóa row cũ. Unique index vẫn là ràng buộc cuối cùng, kể cả khi tạo đồng thời.
- Dùng AUTO_INCREMENT hiện có, không cấp lại Id. DELETE nghiệp vụ là ngừng hoạt động, giữ code đã cấp. Không được reset/reseed/TRUNCATE bảng để cấp lại mã; thao tác DB ngoài API phải duy trì high-water mark của identity. Mã có thể nhảy số vì rollback, lỗi hoặc slot legacy, không đảm bảo liên tục không có khoảng trống.
- PUT/PATCH không có field thay EmployeeCode; client gửi field thừa này sẽ bị bỏ qua. Chuyển Department/Team/Position không đổi mã.
- UI tạo không có ô nhập mã, hiển thị “Mã nhân viên sẽ được hệ thống tự động tạo”; thành công hiển thị mã server trả về. UI sửa/chi tiết chỉ đọc.
- Không thay Employee.Id hoặc FK của Users/Attendance/Contracts/History/Team/Department/Position. Không cần migration cho cơ chế sinh mã.

Để tạo đồng thời tài khoản và hồ sơ, dùng tùy chọn [createEmployee của POST /api/users](../Authorization/USERS_API.md#tạo-user-kèm-employee-trong-một-transaction), không gọi hai request độc lập. [JSON tạo Employee](../../API/employee-create.sample.json).

## Team của nhân viên

- `teamId` nullable, tham chiếu Team cùng Department. Gán mới/đổi Team yêu cầu Team và Department đang hoạt động; không tồn tại/sai phòng/inactive trả `400`.
- POST nhận `teamId`: null hoặc bỏ qua = chưa gán Team.
- PUT nhận `teamId`: **bỏ qua giữ Team hiện tại**, gửi null để gỡ, gửi ID hợp lệ để đổi Team. Giữ nguyên Team hiện tại đã inactive khi sửa trường khác được phép. Không cho đổi Department qua PUT hồ sơ.
- PATCH chuyển Department nhận `teamId` của Department đích; **null hoặc bỏ qua gỡ Team cũ**, cùng transaction với đổi Department/lịch sử/audit/thông báo. Không được mang Team cũ sang phòng khác.
- GET danh sách, chi tiết, `/unlinked` và các response hồ sơ trả thêm `teamId`, `teamName`; chưa gán Team thì null. GET danh sách/unlinked hỗ trợ filter `teamId` số nguyên dương, chỉ thu hẹp scope.
- Frontend lấy Teams từ `GET /api/teams?departmentId={id}&isActive=true` sau khi chọn Department; cần `WEB_TEAMS/VIEW`. TeamName lấy từ backend, không hardcode.
- `EMPLOYEE_TEAM_CHANGED` trong AuditLog lưu before/after TeamId, DepartmentId, actor và traceId khi đổi/gỡ Team. Lịch sử điều chuyển phòng ban hiện tại giữ nguyên.
- Quyền `WEB_EMPLOYEES` và SELF/DEPARTMENT/ALL giữ nguyên; không có scope TEAM. Xem [API Teams](../Organization/TEAMS_API.md).

Ví dụ thêm Team khi cập nhật hồ sơ (các trường hồ sơ khác vẫn theo DTO PUT):

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "employmentStatus": "ACTIVE",
  "positionId": null,
  "teamId": 1
}
```

Ví dụ chuyển phòng đồng thời gán Team của phòng đích:

```json
{
  "departmentId": 2,
  "teamId": 3,
  "effectiveDate": "2026-11-14",
  "reason": "Chuyển sang đội của phòng đích"
}
```

## Vị trí hiện tại (`positionId`)

Hồ sơ nhân viên có `positionId` kiểu số nguyên 64 bit nullable, tham chiếu `positions.id`. Dữ liệu cũ sau migration có giá trị `null` (chưa gán vị trí).

- `POST /api/employees`: nhận `positionId` tùy chọn; bỏ qua hoặc gửi `null` để tạo nhân viên chưa có vị trí.
- `PUT /api/employees/{employeeId}`: nhận `positionId` cùng các trường hồ sơ khác. Gửi ID để gán/đổi vị trí; gửi `null` hoặc bỏ qua trường trong body PUT sẽ xóa vị trí hiện tại.
- ID phải lớn hơn 0, tồn tại và đang hoạt động khi gán mới/đổi vị trí; không hợp lệ trả `400`. Có thể giữ nguyên vị trí hiện tại đã ngừng hoạt động khi sửa trường khác.
- GET danh sách, GET chi tiết, GET `/unlinked` và các response trả `EmployeeDto` đều có `positionId`.
- Không được xóa vị trí đang được nhân viên tham chiếu (`DELETE /api/positions/{positionId}` trả `409`); có thể ngừng hoạt động vị trí.
- Scope và quyền nhân viên giữ nguyên. Đổi vị trí qua API hồ sơ được audit như cập nhật hồ sơ; không tự tạo lịch sử điều chuyển phòng ban.

Ví dụ body cập nhật:

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "employmentStatus": "ACTIVE",
  "positionId": 1
}
```

## GET /api/employees

Danh sách hồ sơ trong scope.

- Role/Permission: **WEB_EMPLOYEES / VIEW + SELF/DEPARTMENT/ALL**.
- Query/Path/Header: Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope. Query departmentId positive nullable; employmentStatus<=20.
- HTTP errors: 400, 401, 403, 500.
- Validation/nghiệp vụ: Scope áp trước count/paging/search. Department query không mở rộng scope.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "employeeCode": "DEMO-E01",
      "fullName": "Demo Employee",
      "email": "employee-demo@example.invalid",
      "dateOfBirth": "1995-01-01",
      "phoneNumber": null,
      "hireDate": "2024-01-01",
      "departmentId": 1,
      "positionId": null,
      "employmentStatus": "ACTIVE",
      "createdAt": "2026-10-24T10:00:00Z",
      "teamId": null,
      "teamName": null,
      "departmentName": "Demo Department",
      "positionName": null
    }
  ]
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## GET /api/employees/unlinked

Danh sách nhân viên chưa liên kết với bất kỳ tài khoản nào: không tồn tại row trong bảng user có `EmployeeId` bằng `Employee.Id`. User có `EmployeeId = null` không loại nhân viên nào; user đã liên kết dù `LOCKED`/`INACTIVE` vẫn loại nhân viên đó khỏi kết quả.

- Quyền: `WEB_EMPLOYEES / VIEW`; scope `SELF`, `DEPARTMENT`, `ALL` như API danh sách nhân viên. `SELF` thường trả danh sách rỗng vì nhân viên của actor đã được liên kết.
- Query: `page` (mặc định 1), `pageSize` (1..100, mặc định 30), `search` (mã/tên/email, tối đa 150), `departmentId` (số nguyên dương), `employmentStatus` (tối đa 20). Không tự giới hạn trạng thái nhân viên; muốn chỉ lấy người đang làm việc, gửi `employmentStatus=ACTIVE`.
- Header: `Authorization: Bearer <access_token>`. Không có request body.
- Scope, điều kiện chưa liên kết và các filter được áp dụng trước khi tính `total` và phân trang. `departmentId` không mở rộng scope.
- Response `200`: cùng cấu trúc `PageResult<EmployeeDto>` như `GET /api/employees`; không có kết quả trả `total: 0`, `data: []`.
- Lỗi: `400` query không hợp lệ, `401` chưa đăng nhập, `403` thiếu quyền/scope hợp lệ, `500` lỗi hạ tầng.

```http
GET /api/employees/unlinked?page=1&pageSize=30&departmentId=1&employmentStatus=ACTIVE
Authorization: Bearer <access_token>
```

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 2,
      "employeeCode": "DEMO-E02",
      "fullName": "Demo Employee 2",
      "email": "employee-2@example.invalid",
      "dateOfBirth": null,
      "phoneNumber": null,
      "hireDate": "2024-01-01",
      "departmentId": 1,
      "positionId": null,
      "employmentStatus": "ACTIVE",
      "createdAt": "2026-10-24T10:00:00Z",
      "teamId": null,
      "teamName": null,
      "departmentName": "Demo Department",
      "positionName": null
    }
  ]
}
```

Kết quả phản ánh thời điểm đọc, không giữ chỗ nhân viên để liên kết user. API này chỉ đọc dữ liệu, không tạo hay cập nhật tài khoản.

## GET /api/employees/{employeeId}

Chi tiết hồ sơ trong scope.

- Role/Permission: **WEB_EMPLOYEES / VIEW + row scope**.
- Query/Path/Header: Path employeeId INT.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Ngoài scope hoặc không tồn tại: 404; không làm lộ danh sách user/auth.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 1,
  "positionId": null,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z",
  "teamId": null,
  "teamName": null,
  "departmentName": "Demo Department",
  "positionName": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## POST /api/employees

Tạo hồ sơ nhân viên.

- Role/Permission: **WEB_EMPLOYEES / NEW + ALL, hoặc DEPARTMENT đúng phòng ban**.
- Query/Path/Header: Body departmentId phải là số nguyên; không có employeeCode trong request.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: EmployeeCode tự sinh, chỉ đọc; email<=255 unique; tên<=150/phone<=20; Department ACTIVE; hireDate bắt buộc; birth<=hireDate và không tương lai; status ACTIVE/INACTIVE/TERMINATED. SELF không được ghi.

JSON Request mẫu:

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "employmentStatus": "ACTIVE",
  "hireDate": "2024-01-01",
  "departmentId": "{{departmentId}}",
  "positionId": null
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "employeeCode": "NV000001",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 1,
  "positionId": null,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z",
  "teamId": null,
  "teamName": null,
  "departmentName": "Demo Department",
  "positionName": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## PUT /api/employees/{employeeId}

Cập nhật thông tin hồ sơ.

- Role/Permission: **WEB_EMPLOYEES / UPDATE + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Không đổi employeeCode/hireDate/department qua endpoint này. Birth/email/length/status validation. PUT giống dữ liệu hiện tại không phát thêm audit/notification. Notification + audit cùng transaction.

JSON Request mẫu:

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "employmentStatus": "ACTIVE"
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 1,
  "positionId": null,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z",
  "teamId": null,
  "teamName": null,
  "departmentName": "Demo Department",
  "positionName": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## DELETE /api/employees/{employeeId}

Ngừng hoạt động hồ sơ (soft deactivation).

- Role/Permission: **WEB_EMPLOYEES / DELETE + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Đặt INACTIVE; không xóa row/contract/history. Không đổi tài khoản Auth hoặc tự kết thúc hợp đồng. TERMINATED trả 409; lặp INACTIVE không tạo event trùng.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## PATCH /api/employees/{employeeId}/department

Chuyển phòng ban, tạo lịch sử.

- Role/Permission: **WEB_EMPLOYEES / UPDATE + ALL**.
- Query/Path/Header: Path employeeId; body departmentId là số nguyên.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Phòng đích ACTIVE và khác phòng hiện tại; effectiveDate từ hire/latest history đến hôm nay UTC; không lên lịch tương lai. Actor từ JWT. Employee/History/Audit/Notification/Outbox commit hoặc rollback cùng nhau.

JSON Request mẫu:

```json
{
  "departmentId": "{{otherDepartmentId}}",
  "effectiveDate": "2026-10-24",
  "reason": "Điều chuyển thử nghiệm"
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeCode": "DEMO-E01",
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "hireDate": "2024-01-01",
  "departmentId": 2,
  "positionId": null,
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z",
  "teamId": null,
  "teamName": null,
  "departmentName": "Demo Department",
  "positionName": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.
