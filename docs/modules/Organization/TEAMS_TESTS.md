# Teams — Kiểm thử

Integration tests: `backend/HRM.API.Tests/TeamApiTests.cs`, dùng SQLite relational với FK bật và production EF mappings. Migration/model tests: `TeamMigrationTests.cs`, generate SQL MySQL và kiểm tra snapshot không kết nối database.

Phạm vi:

- CRUD, normalize/unique TeamCode, validation Department thiếu/inactive, input whitespace, pagination/filter, Team inactive và xóa đang tham chiếu.
- JWT, grant VIEW/NEW/UPDATE/DELETE riêng cho WEB_TEAMS, read-only không gọi được mutation; Team grant không cấp quyền Employee.
- Composite FK từ chối Team sai Department/không tồn tại khi ghi trực tiếp, chấp nhận TeamId null.
- Tạo/cập nhật/đọc TeamId và TeamName, `/unlinked`, Team filter; request PUT cũ bỏ teamId giữ nguyên Team; Team inactive không được gán mới.
- Chuyển Department: Team đích hợp lệ, sai phòng bị từ chối và rollback; request cũ gỡ Team cũ an toàn.
- Audit trước/sau và rollback cả Team/audit khi lưu notification lỗi.
- SELF read-only và DEPARTMENT không truy cập chéo dù biết TeamId.
- Migration chỉ thêm schema nullable/FK/index, không SQL backfill/grant/delete/alter dữ liệu cũ; SQL provider MySQL tạo FK Restrict; snapshot khớp model.

Frontend tests: `web-admin/src/Employees.test.jsx` với API mocks chỉ trong test, không có dữ liệu giả ở runtime. Kiểm tra chọn Department trước Team, đổi phòng gỡ lựa chọn Team, body lưu đúng, giữ Team khi không có quyền catalog, hiển thị TeamName backend, UI theo RBAC, lookup nhiều trang và token hết hạn.

```sh
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj
npm --prefix web-admin test
npm --prefix web-admin run build
```

Test SQLite và SQL generation không thay thế việc kiểm thử migration trên bản sao MySQL được phê duyệt. Không tự apply migration lên database live để kiểm thử.

Kết quả lần triển khai ngày 2026-11-14: toàn bộ backend 187/187 tests đạt, frontend 6/6 tests đạt, backend và frontend build thành công. Migration tests xác nhận SQL MySQL và snapshot khớp. Không chạy migration trên MySQL thật và chưa QA trình duyệt với backend live.
