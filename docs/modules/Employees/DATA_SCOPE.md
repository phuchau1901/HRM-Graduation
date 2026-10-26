# Employees — SELF / DEPARTMENT / ALL

[Module](README.md) · [Profiles API](PROFILES_API.md)

ScreenPermission xác định quyền thực hiện chức năng; EmployeeDataScope xác định các bản ghi được truy cập. Cần đồng thời cả hai. Không suy scope từ ADMIN, HR hoặc Role name; không lấy scope/UserId từ body.

| Scope | Đọc | Ghi |
| --- | --- | --- |
| SELF (mặc định) | Chỉ Employee liên kết User.EmployeeId | Không cho phép |
| DEPARTMENT | Nhân viên thuộc phòng hiện tại của Employee liên kết | Chỉ trong phòng; không chuyển liên phòng |
| ALL | Toàn bộ hồ sơ trong query | Còn phải có action và validation nghiệp vụ |

User không có EmployeeId ở scope SELF nhận danh sách rỗng. Scope DEPARTMENT cần phòng hợp lệ; phòng được lấy lại từ DB. Chuyển phòng liên phòng cần ALL. Hợp đồng dùng cùng employee row scope, không chỉ kiểm tra contractId.

Cấu hình backend minh họa, chưa ghi vào môi trường:

```json
{"EmployeeDataScopes":{"Users":{"hr01":"ALL","manager01":"DEPARTMENT","employee01":"SELF"}}}
```

Mapping do operator quản lý; giá trị khác SELF/DEPARTMENT/ALL bị từ chối ở startup. Chưa có bảng hoặc API quản trị Data Scope. Không tự thay schema hoặc cấp ALL khi test lỗi403. Quyền xem danh mục Organization hay metadata tài khoản không thay thế quyền đọc Employee/Contract.
