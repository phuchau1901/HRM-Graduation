# Organization — API phòng ban

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/departments` | WEB_DEPARTMENTS / VIEW |
| GET | `/api/departments/{departmentId}` | WEB_DEPARTMENTS / VIEW |
| POST | `/api/departments` | WEB_DEPARTMENTS / NEW |
| PUT | `/api/departments/{departmentId}` | WEB_DEPARTMENTS / UPDATE |
| DELETE | `/api/departments/{departmentId}` | WEB_DEPARTMENTS / DELETE |

## GET /api/departments

Danh mục có phân trang.

- Role/Permission: **WEB_DEPARTMENTS / VIEW**.
- Query/Path/Header: Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope. Query isActive nullable.
- HTTP errors: 400, 401, 403, 500.
- Validation/nghiệp vụ: Danh mục chung: không áp employee row scope. Query chỉ thu hẹp kết quả.

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
      "departmentCode": "DEMO-D01",
      "departmentName": "Demo Department",
      "description": "Dữ liệu thử nghiệm",
      "isActive": true
    }
  ]
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## GET /api/departments/{departmentId}

Chi tiết danh mục.

- Role/Permission: **WEB_DEPARTMENTS / VIEW**.
- Query/Path/Header: Path departmentId số nguyên dương.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Không tồn tại: 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## POST /api/departments

Tạo danh mục.

- Role/Permission: **WEB_DEPARTMENTS / NEW**.
- Query/Path/Header: Body DTO; ID/CreatedAt do server tạo.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=20, name<=150, description<=500. Trả Location header.

JSON Request mẫu:

```json
{
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## PUT /api/departments/{departmentId}

Cập nhật danh mục.

- Role/Permission: **WEB_DEPARTMENTS / UPDATE**.
- Query/Path/Header: Path departmentId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=20, name<=150, description<=500. isActive=false dùng để ngừng sử dụng thay vì xóa danh mục đang tham chiếu.

JSON Request mẫu:

```json
{
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "departmentCode": "DEMO-D01",
  "departmentName": "Demo Department",
  "description": "Dữ liệu thử nghiệm",
  "isActive": true
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## DELETE /api/departments/{departmentId}

Xóa danh mục chưa được sử dụng.

- Role/Permission: **WEB_DEPARTMENTS / DELETE**.
- Query/Path/Header: Path departmentId.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Chặn 409 nếu Department có Employee/History hoặc Position có History; FK RESTRICT bảo vệ thêm khi race.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.
