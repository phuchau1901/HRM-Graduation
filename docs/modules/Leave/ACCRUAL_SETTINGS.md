# My Leave Balance và tự động cộng/reset phép

[Quản lý số dư](BALANCES_API.md) · [API Leave](API.md) · [System Settings](../System/README.md) · [JSON cấu hình mẫu](../../API/leave-accrual-settings.sample.json)

## GET /api/leave-balances/me

Yêu cầu WEB_LEAVE_BALANCES VIEW và tài khoản ACTIVE có Employee liên kết. API này không kiểm tra Data Scope SELF/DEPARTMENT/ALL và không yêu cầu cấu hình dòng scope; backend chỉ lọc theo users.employee_id của chính tài khoản đăng nhập. Quyền VIEW vẫn kiểm tra hiện hành. Không nhận employeeId để chọn người khác.

Query tùy chọn `year=2027`, `leaveTypeId=1`; mặc định năm hiện tại theo Asia/Ho_Chi_Minh. Không dùng trực tiếp ngày UTC. Không có số dư thực tế trong năm/loại được chọn thì tổng0 và balances=[], không tự tạo quota. Không có Employee liên kết =>403; year ngoài1900..9999 =>400.

```json
{
  "success": true,
  "data": {
    "employeeId": 12,
    "year": 2027,
    "asOfDate": "2027-06-15",
    "totalDays": 13,
    "usedDays": 3,
    "remainingDays": 10,
    "reservedDays": 2,
    "availableDays": 8,
    "balances": [{
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
}
```

TotalDays = được cấp + chuyển năm + điều chỉnh. RemainingDays = totalDays − usedDays. AvailableDays = remainingDays − reservedDays. Tổng là cộng từ các dòng balances trả về sau lọc loại phép. Muốn chỉ phép năm, truyền leaveTypeId tương ứng. My Leave tab Số dư phép dùng API này và hiển thị tổng cấp/đã dùng/còn lại; Team Leave vẫn dùng API scoped theo phòng ban.

## Cấu hình trong hệ thống

Màn hình **System Settings → Leave Accrual Settings**, không nằm trong cấu hình người duyệt. Lưu ở bảng system_settings hiện có, key LEAVE_ACCRUAL. Không seed hoặc bật chính sách tự động. GET chưa cấu hình trả version0, enabled=false, rules=[], effectiveFrom là ngày Việt Nam hôm nay.

| Method / route | Quyền |
| --- | --- |
| GET /api/system-settings/leave-accrual | WEB_SYSTEM_SETTINGS VIEW |
| PUT /api/system-settings/leave-accrual | WEB_SYSTEM_SETTINGS UPDATE **và** WEB_LEAVE_BALANCES UPDATE scope ALL |
| POST /api/system-settings/leave-accrual/run | Cùng quyền PUT; chỉ chạy lịch đã đến hạn theo ngày server |

Đây là chính sách toàn hệ thống, không cho quản lý chỉ có DEPARTMENT thay đổi nó. Quyền VIEW cấu hình không cấp quyền duyệt đơn hoặc chỉnh số dư. Worker là tác vụ nội bộ thực thi chính sách đã được người có thẩm quyền lưu, không có endpoint bỏ qua authorization.

GET/PUT trả `{version,settings}`. PUT dùng version trong body để kiểm soát concurrency; không dùng If-Match của hai endpoint password/attendance cũ. Đọc phiên bản hiện tại trước khi sửa; phiên bản cũ trả409.

```json
{
  "version": 0,
  "settings": {
    "enabled": true,
    "effectiveFrom": "2027-01-01",
    "accrualDay": 15,
    "newHireEligibility": "ACTIVE_ON_DATE",
    "resetOn": "2028-01-01",
    "repeatResetYearly": true,
    "rules": [
      { "positionId": 3, "leaveTypeId": 1, "daysPerMonth": 1 },
      { "positionId": 4, "leaveTypeId": 1, "daysPerMonth": 1.5 }
    ]
  }
}
```

Ví dụ này: từ01/01/2027, ngày15 mỗi tháng cộng1 ngày cho chức vụ3,1.5 ngày cho chức vụ4, bắt đầu reset vào01/01/2028 rồi lặp hằng năm. ID/ngày là ví dụ, thay bằng dữ liệu thật; không đặt effectiveFrom mới về quá khứ. Version0 chỉ dùng lần đầu. Quy tắc mới không sửa lại kỳ đã xử lý.

### Các field

- enabled: bật/tắt cả cộng và reset; worker không sửa số dư khi false.
- effectiveFrom: ngày bắt đầu áp dụng. Khi tạo/đổi ngày này phải hôm nay hoặc tương lai; được giữ nguyên ngày bắt đầu cũ khi chỉnh chính sách sau đó.
- accrualDay: ngày1..31. Tháng thiếu ngày đã chọn thì dùng ngày cuối tháng.
- newHireEligibility: ACTIVE_ON_DATE nhận đủ suất nếu đã vào làm tại ngày cộng; ONE_MONTH yêu cầu HireDate.AddMonths(1) <= ngày cộng. Không tính tỷ lệ theo ngày công. Nhân viên, chức vụ và loại phép phải active ở lúc chạy; loại phép phải requiresBalance=true.
- resetOn: ngày/tháng/năm reset đầu tiên, không bắt buộc, không được trước effectiveFrom.
- repeatResetYearly: true lặp cùng ngày/tháng mỗi năm từ resetOn; false chỉ một lần. Ngày29/02 ở năm không nhuận dùng28/02.
- rules: tối đa200 cặp positionId/leaveTypeId khác nhau; mỗi suất0.01..31 ngày, tối đa2 số thập phân. Một chức vụ có thể có nhiều loại phép. Chức vụ không có rule không được cộng tự động.

Nhân viên được xét theo PositionId hiện tại lúc xử lý. Hệ thống không suy lịch sử chức vụ hoặc trạng thái lao động của các tháng server đã ngừng chạy. Không tự chạy bù tháng cũ: chỉ xử lý kỳ tháng hiện tại nếu ngày cộng đã đến và không trước effectiveFrom. Trường hợp bỏ lỡ cần người quản lý rà soát rồi cấp/điều chỉnh có lý do qua API số dư.

## Reset an toàn

Reset **phần khả dụng chưa dùng**, không xóa row hoặc zero usedDays/reservedDays. Backend trừ availableDays khỏi adjustmentDays, tăng version và ghi LEAVE_BALANCE_EXPIRED. Giữ nguyên lịch sử cấp phép và đơn pending; không làm mất quota đang giữ cho đơn đang duyệt.

- Reset ngày01/01 đóng phần khả dụng của **năm trước**. Không xóa số dư/quota mới đã cấp trước cho năm mới; cộng tháng sau đó vào row năm mới.
- Reset ngày khác áp dụng **năm dương lịch của ngày reset**, không chuyển sang fiscal-year model.
- Chỉ áp dụng số dư/nhân viên thuộc các cặp chức vụ/loại phép cấu hình đang active. Không sửa quota loại phép khác.
- Reset đến hạn trước, sau đó mới cộng kỳ đến hạn. Nếu ngày cộng trong tháng nằm trước ngày reset vừa xử lý thì không cộng lại khoản trước reset.
- Khi có đơn pending được hủy sau reset, phần reserved đã được bảo vệ sẽ được giải phóng theo workflow hiện có; việc hủy phép đã duyệt vẫn theo quy trình hoàn phép hợp lệ. Reset không thay các chính sách đó.

## Chạy nền, idempotency và audit

LeaveAccrualWorker kiểm tra khi API khởi động và mỗi300 giây mặc định. Cấu hình vận hành `LeaveAccrual__WorkerEnabled=false` tắt worker; `LeaveAccrual__PollSeconds` từ30..3600. Chính sách enabled mặc địnhfalse; có worker không đồng nghĩa tự bật cộng phép. API cần chạy để tác vụ nền hoạt động; không có job Railway bên ngoài được tạo/deploy bởi thay đổi này.

POST `/api/system-settings/leave-accrual/run` không nhận ngày tùy ý, không force cộng kỳ tương lai; dùng chính sách đã lưu, không phải thay đổi chưa lưu trên form. Trả:
```json
{
  "asOfDate": "2027-06-15",
  "creditedBalances": 25,
  "expiredBalances": 0,
  "accrualAlreadyProcessed": false,
  "resetAlreadyProcessed": false
}
```

Khóa SystemSetting LEAVE_ACCRUAL và transaction Serializable serialize các worker instance/manual run/config update. AuditLog EntityType LeaveAutomation giữ dấu `accrual:yyyyMM` và `reset:yyyyMMdd`; mỗi kỳ xử lý một lần, kể cả restart/concurrent run/thay số ngày giữa tháng. Kỳ đã hoàn tất không tự áp dụng lại cho nhân viên/chức vụ vừa bổ sung; dùng cấp thủ công có kiểm soát nếu cần. Nhiều kiểu loại phép được xử lý trong cùng kỳ.

Cộng vào entitledDays; tạo row nhân viên/loại/năm nếu thiếu. Dòng mới không tự sao chép số dư năm trước. Reset và cộng cùng transaction với lịch sử và dấu kỳ; lỗi bất kỳ rollback toàn bộ. Dùng employee locks/version/unique balance key hiện có, query theo chunk500, không query riêng mỗi nhân viên. Deadlock/concurrency =>409 ở API; worker sẽ thử lại ở chu kỳ sau.

Audit: LEAVE_ACCRUAL_SETTINGS_UPDATED ghi người sửa config; LEAVE_BALANCE_ACCRUED/EXPIRED ghi trước/sau/lý do; LEAVE_ACCRUAL_COMPLETED/LEAVE_RESET_COMPLETED ghi policyVersion và ngày xử lý. Worker có actorUserId=null thể hiện hệ thống, chạy bằng API ghi User người gọi. Giữ dấu audit để không mất idempotency. Logs lỗi chỉ có metadata, không chứa SQL/password/token.

## Migration và kiểm thử

Tính năng này không thêm bảng/cột hoặc seed settings; tái sử dụng SystemSetting, AuditLog và LeaveBalance. Cần các migration Leave trước đó, gồm `20261117062126_ExtendLeaveBalanceManagement`, có trên môi trường trước khi bật chính sách. Không tự apply migration, không deploy Railway, không bật policy trên database thật.

Tests kiểm tra /me không lộ nhân viên khác dù ALL, năm theo giờ Việt Nam, tháng thiếu ngày31, điều kiện đủ một tháng, quy tắc chức vụ, cộng một lần qua restart/concurrency/thay config, reset giữ used/reserved, reset1/1 sang năm mới và rollback cả reset nếu cộng lỗi. SQLite test worker bị tắt để test gọi scheduler một cách xác định; SQL/migrations không được chạy lên database thật.

## Kết quả kiểm tra — 2026-11-17

- Tests /me, accrual/reset và inventory:13/13 qua.
- Toàn bộ backend:425 qua,9 lỗi cũ, tổng434; cả9 lỗi thuộc EmployeeCreationTests do kỳ vọng mã NV khác implementation TX và các tình huống collision/rollback liên quan. Không sửa bộ sinh mã trong phạm vi này.
- Frontend:47/47 tests qua; production build thành công.
- Hai Postman Collection có126 request examples, trong đó30 workflow examples không trùng tên; payload JSON/link tài liệu được kiểm tra. API inventory119 REST routes không trùng.
- Worker bị tắt trong test host; test gọi scheduler trên SQLite tạm. Không sửa database thật, không bật chính sách, không apply migration hoặc deploy.
