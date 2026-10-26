# Organization — API chức danh/vị trí

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/positions` | WEB_POSITIONS / VIEW |
| GET | `/api/positions/{positionId}` | WEB_POSITIONS / VIEW |
| POST | `/api/positions` | WEB_POSITIONS / NEW |
| PUT | `/api/positions/{positionId}` | WEB_POSITIONS / UPDATE |
| DELETE | `/api/positions/{positionId}` | WEB_POSITIONS / DELETE |

## GET /api/positions

Danh mục có phân trang.

- Role/Permission: **WEB_POSITIONS / VIEW**.
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
      "code": "DEMO-P01",
      "name": "Demo Position",
      "isActive": true
    }
  ]
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## GET /api/positions/{positionId}

Chi tiết danh mục.

- Role/Permission: **WEB_POSITIONS / VIEW**.
- Query/Path/Header: Path positionId số nguyên dương.
- HTTP errors: 401, 403, 404, 500.
- Validation/nghiệp vụ: Không tồn tại: 404.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## POST /api/positions

Tạo danh mục.

- Role/Permission: **WEB_POSITIONS / NEW**.
- Query/Path/Header: Body DTO; ID/CreatedAt do server tạo.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=30, name<=150. Trả Location header.

JSON Request mẫu:

```json
{
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

JSON Response thành công — HTTP 201:

```json
{
  "id": 1,
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## PUT /api/positions/{positionId}

Cập nhật danh mục.

- Role/Permission: **WEB_POSITIONS / UPDATE**.
- Query/Path/Header: Path positionId; body DTO đầy đủ.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Code unique sau Trim; không rỗng; code<=30, name<=150. isActive=false dùng để ngừng sử dụng thay vì xóa danh mục đang tham chiếu.

JSON Request mẫu:

```json
{
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

JSON Response thành công — HTTP 200:

```json
{
  "id": 1,
  "code": "DEMO-P01",
  "name": "Demo Position",
  "isActive": true
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.

## DELETE /api/positions/{positionId}

Xóa danh mục chưa được sử dụng.

- Role/Permission: **WEB_POSITIONS / DELETE**.
- Query/Path/Header: Path positionId.
- HTTP errors: 400, 401, 403, 404, 409, 500.
- Validation/nghiệp vụ: Chặn 409 nếu Department có Employee/History hoặc Position có History; FK RESTRICT bảo vệ thêm khi race.

JSON Request mẫu:

Không có body.

JSON Response thành công — HTTP 204:

Không có body.

### Kiểm thử endpoint

Không JWT401; thiếu action403; dữ liệu hợp lệ thành công; mã trùng409 khi ghi; FK không hợp lệ bị chặn; xóa danh mục đang tham chiếu409; phân trang và validation400.
