# Employees — API hồ sơ nhân viên

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/employees` | WEB_EMPLOYEES / VIEW + data scope |
| GET | `/api/employees/{employeeId}` | WEB_EMPLOYEES / VIEW + data scope |
| POST | `/api/employees` | WEB_EMPLOYEES / NEW + data scope |
| PUT | `/api/employees/{employeeId}` | WEB_EMPLOYEES / UPDATE + data scope |
| DELETE | `/api/employees/{employeeId}` | WEB_EMPLOYEES / DELETE + data scope |
| PATCH | `/api/employees/{employeeId}/department` | WEB_EMPLOYEES / UPDATE + data scope |

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
      "employmentStatus": "ACTIVE",
      "createdAt": "2026-10-24T10:00:00Z"
    }
  ]
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

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
  "departmentId": "{{departmentId}}"
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
  "employmentStatus": "ACTIVE",
  "createdAt": "2026-10-24T10:00:00Z"
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.
