# Employees — API lịch sử nhân viên

[Module](README.md) · [Quy ước chung](../../guides/CONVENTIONS.md) · [Postman](../../HRM-API.postman_collection.json)

| Method | URL | Quyền |
| --- | --- | --- |
| GET | `/api/employees/{employeeId}/history` | WEB_EMPLOYEES / VIEW + data scope |

## GET /api/employees/{employeeId}/history

Xem lịch sử hồ sơ.

- Role/Permission: **WEB_EMPLOYEES / VIEW + row scope**.
- Query/Path/Header: Path employeeId; Query page>=1 (default 1), pageSize=1..100 (default 30), search<=150; total tính sau filter/scope.
- HTTP errors: 400, 401, 403, 404, 500.
- Validation/nghiệp vụ: Lịch sử được tạo qua nghiệp vụ chuyển phòng ban; không cho client ghi lại actor hoặc sửa/xóa lịch sử. Chưa gán chức danh vì Employee không có PositionId.

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
      "oldDepartmentId": 1,
      "newDepartmentId": 2,
      "oldPositionId": null,
      "newPositionId": null,
      "effectiveDate": "2026-10-24",
      "reason": "Điều chuyển",
      "changedByUserId": "<JWT sub>"
    }
  ]
}
```

### Kiểm thử endpoint

Không JWT401; thiếu action403; SELF chỉ đọc chính mình; DEPARTMENT giới hạn phòng ban; ALL vẫn phải có action; kiểm tra ngày/trạng thái/FK; mutation và audit/notification phải cùng transaction.
