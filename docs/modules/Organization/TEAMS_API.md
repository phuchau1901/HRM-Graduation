# Teams — API Specification

[Module và audit](TEAMS.md) · [Postman](../../HRM-API.postman_collection.json) · [Employee API](../Employees/PROFILES_API.md)

Tất cả endpoint yêu cầu `Authorization: Bearer <access_token>` và grant của screen ACTIVE `WEB_TEAMS`. Không có bypass theo tên role. Danh mục Team không chứa dữ liệu cá nhân nhân viên và không áp employee data scope; không tự mở rộng quyền Employee.

| Method | URL | Action | Thành công |
| --- | --- | --- | --- |
| GET | `/api/teams` | VIEW | 200 PageResult<TeamDto> |
| GET | `/api/teams/{id}` | VIEW | 200 TeamDto |
| POST | `/api/teams` | NEW | 201 TeamDto + Location |
| PUT | `/api/teams/{id}` | UPDATE | 200 TeamDto |
| DELETE | `/api/teams/{id}` | DELETE | 204 không body |

## Danh sách và chi tiết

`GET /api/teams?page=1&pageSize=30&departmentId=1&isActive=true&search=PLATFORM`

Query tùy chọn: page>=1 (mặc định 1), pageSize 1..100 (mặc định 30), departmentId>0, isActive boolean, search tối đa 150 ký tự tìm theo mã/tên Team. Lọc trước count/paging, thứ tự Id tăng dần. Không có body. Không khớp trả data rỗng, không phải lỗi. Bỏ isActive để lấy cả Team đã ngừng hoạt động.

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 30,
  "data": [
    {
      "id": 1,
      "teamCode": "PLATFORM",
      "teamName": "Platform",
      "departmentId": 1,
      "departmentName": "Engineering",
      "description": "Đội nền tảng",
      "isActive": true,
      "createdAt": "2026-11-14T09:00:00Z"
    }
  ]
}
```

`GET /api/teams/{id}` trả một object có cùng các trường TeamDto ở trên; không tồn tại trả 404. Team inactive vẫn đọc được nếu có quyền VIEW. isActive=true chỉ lọc trạng thái Team, không tự lọc trạng thái Department; API gán nhân viên luôn kiểm tra cả hai.

## Tạo và cập nhật

`POST /api/teams` hoặc `PUT /api/teams/{id}`:

```json
{
  "teamCode": "PLATFORM",
  "teamName": "Platform",
  "departmentId": 1,
  "description": "Đội nền tảng",
  "isActive": true
}
```

- teamCode bắt buộc, tối đa 30; ký tự chữ/số/`_`/`-`, bắt đầu bằng chữ/số. Normalize uppercase, unique toàn hệ thống, không chỉ theo Department. Trùng mã trả 409; unique index xử lý cả race ghi đồng thời trên MySQL.
- teamName bắt buộc, trim, tối đa 150; chỉ whitespace không hợp lệ. description tùy chọn/null, tối đa 500.
- departmentId số nguyên dương, phải tồn tại; Department inactive không cho tạo Team hoặc lưu Team hoạt động (400).
- Department của Team không được đổi sau khi tạo (409), vì nằm trong principal key của composite FK. Tạo Team mới ở phòng đích và chuyển nhân viên qua API nhân viên.
- isActive mặc định true khi bỏ qua. Team inactive có thể được sửa hoặc bật lại nếu Department hoạt động. Khi Department inactive, vẫn cho lưu Team hiện có với isActive=false để ngừng hoạt động/bảo trì.
- createdAt do server gán UTC, không nhận trong request. Không cập nhật Department, Employee hay grant qua body Team.
- Response POST/PUT là TeamDto; mỗi request có transaction riêng và audit. Không dùng If-Match cho CRUD Team; cập nhật đồng thời theo cơ chế ghi cuối hiện có của danh mục Organization.

## Xóa

`DELETE /api/teams/{id}` không body. Có nhân viên tham chiếu trả 409; không tự xóa/gỡ Employee. Có thể PUT isActive=false để ngừng hoạt động thay vì xóa. FK Restrict bảo vệ ghi ngoài API/race. Không cho xóa Department còn Team, kể cả Team inactive.

## Lỗi

| HTTP | Trường hợp |
| --- | --- |
| 400 | Body/query sai, mã/tên/độ dài sai, Department không tồn tại/inactive theo rule trên |
| 401 | Thiếu/sai JWT, phiên hết hiệu lực |
| 403 | Thiếu action WEB_TEAMS hoặc screen inactive |
| 404 | Team không tồn tại khi GET/PUT/DELETE theo id |
| 409 | Mã Team trùng; đổi Department của Team; xóa Team đang tham chiếu; xung đột constraint MySQL |
| 500 | Lỗi hạ tầng ngoài các trường hợp nghiệp vụ đã xử lý |

Lỗi nghiệp vụ theo envelope `success=false`, `code`, `error`, `message`, `traceId`; validation tự động ASP.NET Core trả ValidationProblemDetails.

## Employee và Team

- POST `/api/employees`: thêm `teamId` tùy chọn, null hoặc bỏ qua = chưa gán Team.
- PUT `/api/employees/{id}`: bỏ qua teamId giữ nguyên; null gỡ Team; ID khác phải active và thuộc Department hiện tại.
- PATCH `/api/employees/{id}/department`: thêm teamId thuộc Department đích; null/bỏ qua = gỡ Team cũ. Chuyển Department vẫn cần scope ALL.
- GET danh sách, chi tiết, unlinked và response mutation nhân viên trả `teamId`, `teamName`; chưa gán thì cả hai null. GET danh sách/unlinked có filter teamId>0, chỉ thu hẹp scope.
- Giữ nguyên Team hiện tại đã inactive khi sửa trường khác được phép; không gán mới/đổi sang Team inactive. Sai Team/Department hoặc Team không tồn tại trả 400. Ngoài employee data scope vẫn 403/404 theo API cũ.
