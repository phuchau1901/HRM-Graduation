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
      "createdAt": "2026-10-24T10:00:00Z"
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
      "createdAt": "2026-10-24T10:00:00Z"
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
  "createdAt": "2026-10-24T10:00:00Z"
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## POST /api/employees

Tạo hồ sơ nhân viên.

- Role/Permission: **WEB_EMPLOYEES / NEW + ALL, hoặc DEPARTMENT đúng phòng ban**.
- Query/Path/Header: Body departmentId phải là số nguyên.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Mã<=20/email<=255 unique; tên<=150/phone<=20; Department ACTIVE; hireDate bắt buộc; birth<=hireDate và không tương lai; status ACTIVE/INACTIVE/TERMINATED. SELF không được ghi.

JSON Request mẫu:

```json
{
  "fullName": "Demo Employee",
  "email": "employee-demo@example.invalid",
  "dateOfBirth": "1995-01-01",
  "phoneNumber": null,
  "employmentStatus": "ACTIVE",
  "employeeCode": "DEMO-E01",
  "hireDate": "2024-01-01",
  "departmentId": "{{departmentId}}",
  "positionId": null
}
```

JSON Response thành công — HTTP 201:

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
  "createdAt": "2026-10-24T10:00:00Z"
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
  "createdAt": "2026-10-24T10:00:00Z"
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
  "createdAt": "2026-10-24T10:00:00Z"
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.
