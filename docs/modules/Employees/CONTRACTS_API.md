# Employees — API hợp đồng

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/employees/{employeeId}/contracts` | WEB_CONTRACTS / VIEW + data scope |
| GET | `/api/employees/{employeeId}/contracts/{contractId}` | WEB_CONTRACTS / VIEW + data scope |
| POST | `/api/employees/{employeeId}/contracts` | WEB_CONTRACTS / NEW + data scope |
| PUT | `/api/employees/{employeeId}/contracts/{contractId}` | WEB_CONTRACTS / UPDATE + data scope |

## GET /api/employees/{employeeId}/contracts

Danh sách hợp đồng nhân viên.

- Role/Permission: **WEB_CONTRACTS / VIEW + employee row scope**.
- Query/Path/Header: Path employeeId; Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope.
- HTTP errors: 400, 401, 403, 404, 500.
- Validation/nghiệp vụ: Không truy vấn hợp đồng nhân viên ngoài scope. search chỉ theo contractNo.

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
      "employeeId": 1,
      "contractNo": "DEMO-C01",
      "contractType": "FIXED_TERM",
      "startDate": "2024-01-01",
      "endDate": "2027-01-01",
      "status": "DRAFT",
      "attachmentUrl": null
    }
  ]
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## GET /api/employees/{employeeId}/contracts/{contractId}

Chi tiết hợp đồng.

- Role/Permission: **WEB_CONTRACTS / VIEW + employee row scope**.
- Query/Path/Header: Path employeeId INT, contractId BIGINT.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Contract phải thuộc đúng employeeId; mismatch/outside scope trả 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeId": 1,
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## POST /api/employees/{employeeId}/contracts

Tạo hồ sơ hợp đồng.

- Role/Permission: **WEB_CONTRACTS / NEW + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId; không nhận employeeId khác trong body.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: No<=50 unique; type<=30; start>=hireDate; end>=start; status allowlist; ACTIVE chứa hôm nay và không trùng khoảng ACTIVE khác. HTTPS attachment<=500, không có credentials, server không fetch URL. Audit/notification atomic.

JSON Request mẫu:

```json
{
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "employeeId": 1,
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.

## PUT /api/employees/{employeeId}/contracts/{contractId}

Sửa hợp đồng / chuyển trạng thái.

- Role/Permission: **WEB_CONTRACTS / UPDATE + ALL/DEPARTMENT**.
- Query/Path/Header: Path employeeId, contractId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Giữ quy tắc tạo. ACTIVE chỉ giữ ACTIVE hoặc sang EXPIRED/TERMINATED; đóng cần endDate<=hôm nay; bản ghi đóng immutable, PUT dữ liệu giống hệt vẫn 200 không tạo event trùng. Không có DELETE hợp đồng.

JSON Request mẫu:

```json
{
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "employeeId": 1,
  "contractNo": "DEMO-C01",
  "contractType": "FIXED_TERM",
  "startDate": "2024-01-01",
  "endDate": "2027-01-01",
  "status": "DRAFT",
  "attachmentUrl": null
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.
