# Leave Balance Management

[Module Leave](README.md) · [Workflow](WORKFLOW_SETTINGS.md) · [API Inventory](../../API/README.md) · [Postman](../../HRM-API.postman_collection.json)

## Audit và màn hình

`leave_balances` đã tồn tại từ InitialHRMDatabase; trước thay đổi đã có entity, unique key `(employee_id,leave_type_id,year_no)`, version concurrency, GET/PUT `/api/leave-balances`, cùng cơ chế reserved/used theo workflow. Tận dụng các thành phần này, không tạo lại bảng hoặc route hiện có.

Màn hình Human Resources → **Số dư phép**, route `/#/hr/leave-balances`, mã `WEB_LEAVE_MANAGEMENT`. My Leave và Team Leave có tab Số dư phép chỉ đọc, lần lượt dùng `/api/leave-balances/me` và `/api/leave-balances?view=TEAM`. Leave Management dùng chung component quản lý số dư. Có bộ lọc, phân trang, skeleton, empty/error state, cấp phép, sửa cấp/chuyển năm, điều chỉnh và lịch sử.

## Các thành phần số dư

| DTO | Ý nghĩa |
| --- | --- |
| entitledDays | Phép được cấp trong năm |
| carriedOverDays | Phép chuyển năm được người quản lý nhập theo chính sách đã duyệt |
| adjustmentDays | Tổng điều chỉnh có dấu; dương tăng, âm giảm |
| usedDays | Phép đã dùng sau phê duyệt cuối |
| reservedDays | Phép đang giữ cho đơn pending |
| remainingDays | entitledDays + carriedOverDays + adjustmentDays − usedDays |
| availableDays | remainingDays − reservedDays |

Ngày có tối đa2 chữ số thập phân; tổng được phân bổ phải >= used+reserved và <=99999.99 để phù hợp decimal(7,2). Điều chỉnh không thể giảm vào phần đã dùng/đang giữ. Không tự reset hoặc chuyển phép hàng năm; chưa có chính sách tự tính nguồn chuyển năm, hạn dùng hay trần chuyển phép. Nhập carriedOverDays có lý do và version, không cộng thêm lại khi retry.

## Quyền

| API | Action trên WEB_LEAVE_MANAGEMENT |
| --- | --- |
| GET /api/leave-balances | VIEW + SELF/DEPARTMENT/ALL |
| GET /api/leave-balances/{id:long}/history | VIEW + scope của nhân viên thuộc số dư |
| PUT /api/leave-balances | UPDATE + DEPARTMENT/ALL |
| POST /api/leave-balances/grants | UPDATE + DEPARTMENT/ALL |
| POST /api/leave-balances/{id:long}/adjustments | UPDATE + DEPARTMENT/ALL |

SELF không được cấp/sửa/điều chỉnh, kể cả có cờ UPDATE. Tài khoản quản lý phải được cấp UPDATE và scope DEPARTMENT/ALL rõ ràng. VIEW/ALL không tự cho quyền ghi. DEPARTMENT quản lý nhân viên trong phòng ban liên kết; target=ALL luôn có nghĩa toàn bộ **trong scope UPDATE** của người gọi, không mặc định toàn hệ thống. Không dùng WEB_EMPLOYEES, quyền settings hoặc tên role để bypass. Scope cấu hình qua API permissions hiện có.

## GET /api/leave-balances

Query `page=1&pageSize=20` (max100), `view=MY|TEAM|ALL` (defaultALL), `year`, `employeeId`, `departmentId`, `leaveTypeId`, `search` (tên hoặc mã nhân viên). Scope áp dụng trước lọc/count/paging. TEAM chỉ phòng ban hiện tại và không cho scope SELF. Chỉ trả các số dư đã được cấu hình, không giả lập quota0 cho nhân viên chưa được cấp.

```json
{
  "success": true,
  "total": 1,
  "page": 1,
  "pageSize": 20,
  "data": [{
    "id": 10,
    "employeeId": 12,
    "employeeName": "Nhân viên mẫu",
    "leaveTypeId": 1,
    "leaveTypeName": "Phép năm",
    "year": 2027,
    "entitledDays": 12,
    "carriedOverDays": 2,
    "adjustmentDays": -1,
    "usedDays": 3,
    "reservedDays": 2,
    "remainingDays": 10,
    "availableDays": 8,
    "version": 4
  }]
}
```

## PUT /api/leave-balances — một nhân viên

Tận dụng route hiện có. Version0 tạo số dư chưa có; cập nhật phải lấy version hiện tại từ GET. Đây là giá trị tuyệt đối, không phải phép cộng. Bỏ carriedOverDays khi cập nhật giữ số chuyển năm hiện có. Không nhận/ghi adjustmentDays, usedDays hoặc reservedDays từ client. Lý do bắt buộc khi sửa dòng đã có; lúc tạo cho phép bỏ reason để giữ compatibility, nhưng UI luôn yêu cầu nhập.

```json
{
  "employeeId": 12,
  "leaveTypeId": 1,
  "year": 2027,
  "entitledDays": 12,
  "carriedOverDays": 2,
  "version": 0,
  "reason": "Cấp phép năm và chuyển phép theo quyết định"
}
```

Trả200 BalanceView. Trùng dòng với version0 hoặc stale version =>409. Loại phép phải active.

## POST /api/leave-balances/grants — cấp mới hàng loạt

```json
{
  "operationId": "4d399a69-c94b-4615-b0bd-f0fb0ef3d62d",
  "target": "DEPARTMENT",
  "departmentId": 3,
  "leaveTypeId": 1,
  "year": 2027,
  "entitledDays": 12,
  "carriedOverDays": 2,
  "reason": "Cấp phép đầu năm"
}
```

- EMPLOYEE: chỉ truyền employeeId, không truyền departmentId.
- DEPARTMENT: chỉ truyền departmentId, phòng ban phải active và thuộc scope quản lý.
- ALL: không truyền employeeId/departmentId; lấy toàn bộ nhân viên ACTIVE trong scope UPDATE.
- OperationId là UUID khác rỗng, tạo một lần cho một nội dung. Lỗi mạng/concurrency gửi lại cùng ID và nội dung. Muốn một lượt mới thì dùng UUID mới.
- **Create only**: dòng đã có cùng nhân viên/loại/năm bị bỏ qua, không cộng lại quota hoặc reset used/reserved/adjustment. Muốn đổi dòng có sẵn dùng PUT có version/reason hoặc adjustment.
- Cùng OperationId + actor + payload trả receipt cũ; dùng lại ID với actor/nội dung khác =>409. Nếu scope hiện tại không còn bao phủ nhân viên của receipt cũ =>403, không trả số lượng ngoài scope.

Trả200:
```json
{
  "operationId": "4d399a69-c94b-4615-b0bd-f0fb0ef3d62d",
  "selected": 20,
  "created": 18,
  "skipped": 2
}
```

Toàn bộ lượt cấp trong một transaction. Xử lý chunk500 cho lock/lookup/insert, không truy vấn riêng từng nhân viên. Unique key số dư và khóa catalog screen hỗ trợ serialize idempotency. Receipt/lý do được lưu trong AuditLog EntityType=LeaveBalanceGrant, không thêm bảng hoặc dùng SystemSetting làm dữ liệu cấp phép. Giữ receipt audit để đảm bảo retry.

## POST /api/leave-balances/{id:long}/adjustments

```json
{
  "version": 4,
  "days": -0.5,
  "reason": "Điều chỉnh số liệu nhập ban đầu"
}
```

Days khác0, tối đa2 chữ số thập phân. Chỉ cộng vào adjustmentDays; không sửa used/reserved. Trả200 BalanceView với version mới. Gửi lại version cũ =>409, không cộng hai lần. Lý do trống =>400; giảm khiến availableDays<0 =>409. Mỗi lần thành công lưu trước/sau, actor, timestamp và lý do vào AuditLog.

## GET /api/leave-balances/{id:long}/history

Scope VIEW được kiểm tra trên nhân viên của số dư trước khi đọc audit. Query page/pageSize; mới nhất trước. List format chung với `{id,actorUserId,action,beforeJson,afterJson,createdAt}`. Reason nằm ở `afterJson.reason`, số dư mới ở `afterJson.balance`. Lịch sử cũ có thể dùng cấu trúc JSON cũ.

Actions mới: LEAVE_BALANCE_GRANTED, LEAVE_BALANCE_ALLOCATION_UPDATED, LEAVE_BALANCE_ADJUSTED, LEAVE_BALANCE_RESERVED, LEAVE_BALANCE_USE, LEAVE_BALANCE_RELEASE, LEAVE_BALANCE_REFUND. Batch tổng dùng LEAVE_BALANCES_GRANTED trên EntityType LeaveBalanceGrant; không hiện như một dòng số dư của nhân viên khác.

## Tích hợp Leave và concurrency

Với requires_balance=true: gửi đơn kiểm tra availableDays theo công thức mới, tăng reserved; cấp cuối reserved→used; từ chối/hủy pending giải phóng reserved; duyệt hủy phép đã duyệt hoàn used một lần theo workflow hiện có. Tất cả cùng transaction với request/approval/audit/outbox, version và kiểm tra trạng thái chặn duyệt trùng. requires_balance=false không đòi có số dư, không giữ/trừ/hoàn quota.

Mutation dùng Serializable + employee locks + optimistic balance.Version. Cấp batch có thêm screen lock/operation receipt. Deadlock/concurrency =>409, tải lại trước khi thử; không fallback sang cập nhật thiếu điều kiện.

## Migration và kiểm tra

Migration mới **20261117062126_ExtendLeaveBalanceManagement** thêm carried_over_days, adjustment_days decimal(7,2) NOT NULL DEFAULT0 vào bảng hiện có; thêm index AuditLog(entity_type,entity_id) để tra history/receipt. Giữ unique balance và version, không tạo bảng, không UPDATE/DELETE dữ liệu cũ. Đợt triển khai không apply migration hoặc deploy Railway. Schema mới cần có trước khi dùng binary này; trạng thái DB đích chưa kiểm tra.

Tests gồm công thức/carryover/adjustment, reason/version/precision/negative, scope đọc/ghi và lịch sử, batch idempotency/nội dung thay đổi, retry khi scope thu hẹp, concurrent grant/adjustment qua SQLite nhiều connection, requires_balance=false và luồng duyệt/hoàn phép. Migration SQL MySQL kiểm tra offline; chưa chạy tải trên MySQL live.

## Kết quả kiểm tra triển khai — 2026-11-17

- Backend build: thành công, 0 warnings/errors.
- Workflow/balance/inventory tests:36/36 qua; migration số dư mới:1/1 qua.
- Toàn bộ backend:413 qua,9 lỗi, tổng422. Cả9 lỗi thuộc EmployeeCreationTests cũ (kỳ vọng NV so với mã TX và các tình huống collision/rollback liên quan), không thay đổi bộ sinh mã nhân viên trong phạm vi này.
- Frontend:43/43 tests qua, gồm6 test quản lý số dư mới; production build thành công. Có kiểm tra UUID idempotency trên môi trường HTTP không có crypto.randomUUID.
- Inventory:115 REST routes; mỗi collection Postman122 request examples, không trùng route workflow. JSON mẫu và liên kết tài liệu đã kiểm tra.
- Không apply migration, không deploy Railway, không đọc/sửa database thật. Integration/concurrency dùng SQLite tạm và migration SQL MySQL được sinh offline.

## API của tôi và tự động cộng/reset

Bổ sung GET /api/leave-balances/me và [lịch phép trong System Settings](ACCRUAL_SETTINGS.md). Cấp theo chu kỳ tháng/năm cho chức vụ vào entitledDays; reset phần khả dụng có audit vào adjustmentDays, giữ used/reserved. Không tự chuyển quota giữa năm và không suy lịch sử các tháng bị bỏ lỡ.

## Phân quyền số dư cá nhân và quản lý

GET /api/leave-balances/me dùng WEB_LEAVE_BALANCES / VIEW, không kiểm tra Data Scope, chỉ trả Employee liên kết với tài khoản đăng nhập. Các API danh sách, lịch sử, cấp phép, sửa và điều chỉnh còn lại dùng WEB_LEAVE_MANAGEMENT: VIEW cho đọc, UPDATE cho ghi. Data Scope SELF/DEPARTMENT/ALL của WEB_LEAVE_MANAGEMENT vẫn áp dụng; SELF không cho cấp hoặc điều chỉnh.

My Leave gọi /me; Team Leave và màn hình quản lý dùng WEB_LEAVE_MANAGEMENT. Không tự chuyển quyền từ WEB_LEAVE_BALANCES sang WEB_LEAVE_MANAGEMENT. Quản trị viên cần cấu hình screen active và cấp quyền/action/scope tương ứng qua API quản trị màn hình/phân quyền hiện có nếu môi trường chưa có. Không tự sửa dữ liệu thật hoặc chạy migration.

GET `/api/leave-balances` includes `employeeCode` (employees.EmployeeCode) in each data item alongside employeeId/employeeName. The field uses the existing scoped employee join, with no additional query. `/me` balance items and single-balance update responses use the same DTO.
