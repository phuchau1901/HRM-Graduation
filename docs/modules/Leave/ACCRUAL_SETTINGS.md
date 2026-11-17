# My Leave Balance và tự động cộng/reset phép

[Quản lý số dư](BALANCES_API.md) · [API Leave](API.md) · [System Settings](../System/README.md) · [JSON cấu hình mẫu](../../API/leave-accrual-settings.sample.json)

## GET /api/leave-balances/me

Yêu cầu WEB_LEAVE_BALANCES VIEW và tài khoản ACTIVE có Employee liên kết. API này không kiểm tra Data Scope SELF/DEPARTMENT/ALL và không yêu cầu cấu hình dòng scope; backend chỉ lọc theo users.employee_id của chính tài khoản đăng nhập. Quyền VIEW vẫn kiểm tra hiện hành. Không nhận employeeId để chọn người khác.

Query tùy chọn `year=2027`, `leaveTypeId=1`; mặc định năm hiện tại theo Asia/Ho_Chi_Minh. Không dùng trực tiếp ngày UTC. Không có số dư thực tế trong năm/loại được chọn thì tổng0 và balances=[], không tự tạo quota. Không có Employee liên kết =>403, code HRM_AUTH_006, error EMPLOYEE_LINK_REQUIRED; thiếu VIEW hiện hành =>403 HRM_AUTH_003 PERMISSION_DENIED. /me không trả HRM_AUTH_004 cho hai trường hợp này; year ngoài1900..9999 =>400.

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

## Cấu hình chu kỳ cấp/thu hồi trong hệ thống

Màn hình **System Settings → Leave Accrual Settings**, lưu JSON ở system_settings key LEAVE_ACCRUAL. Chính sách chưa có mặc định disabled; không tự bật job hay tạo danh mục phép năm.

| API | Quyền |
| --- | --- |
| GET /api/system-settings/leave-accrual | WEB_SYSTEM_SETTINGS VIEW |
| PUT /api/system-settings/leave-accrual | WEB_SYSTEM_SETTINGS UPDATE |
| POST /api/system-settings/leave-accrual/run | WEB_SYSTEM_SETTINGS UPDATE |

Không áp dụng Data Scope, không cần quyền WEB_LEAVE_BALANCES hoặc liên kết Employee để quản trị cấu hình. GET/PUT dùng `{version,settings}`, PUT lấy version vừa đọc; version0 chỉ lần đầu. Không dùng If-Match của password/attendance settings.

```json
{
  "version": 0,
  "settings": {
    "scheduleVersion": 2,
    "enabled": true,
    "defaultDaysPerCycle": 1,
    "accrualSchedule": {
      "startDate": "2027-01-01",
      "interval": 2,
      "unit": "MONTH"
    },
    "resetSchedule": {
      "startDate": "2027-01-01",
      "interval": 1,
      "unit": "YEAR"
    },
    "newHireEligibility": "ACTIVE_ON_DATE",
    "rules": [
      { "positionId": 3, "daysPerCycle": 1.5 },
      { "positionId": 4, "daysPerCycle": 2 }
    ]
  }
}
```

Ví dụ: từ mốc01/01/2027, mỗi2 tháng cấp1.5 ngày cho chức vụ3 và2 ngày cho chức vụ4. Các nhân viên đủ điều kiện không có quy tắc chức vụ nhận1 ngày mặc định; không cộng thêm1 ngày cho chức vụ3/4. Lần đầu01/03/2027, tiếp theo01/05/2027. Lịch thu hồi riêng mỗi1 năm, lần đầu01/01/2028. Số ngày là suất **mỗi chu kỳ**, không nhân thêm theo số tháng.

## Quy tắc lịch

- scheduleVersion=2 dùng lịch mới. Có accrualSchedule hoặc resetSchedule cũng được tự nhận là version2 khi lưu.
- accrualSchedule: lịch cấp; resetSchedule: lịch thu hồi. Hai lịch độc lập, có thể dùng1 tháng,2 tháng,6 tháng,1 năm,2 năm… Interval là số nguyên1..120; unit là MONTH hoặc YEAR.
- startDate là mốc tính, **không chạy ngay ngày bắt đầu**. Lần đầu là startDate + interval tháng/năm. Bỏ lịch bằng null. Có thể chỉ cấp, chỉ thu hồi hoặc cả hai; enabled=true cần ít nhất một lịch.
- Ngày tính theo Asia/Ho_Chi_Minh. Cộng theo lịch, không dùng30/365 ngày cố định. Mốc31/01 +1 tháng thành28/02 (29/02 năm nhuận), kỳ tiếp từ mốc gốc trở lại31/03, không trôi thành28/03. Mốc29/02 +1 năm dùng28/02 năm không nhuận.
- Worker xử lý kỳ gần nhất đã đến hạn nếu chưa có dấu hoàn tất; không cộng dồn tất cả các kỳ bỏ lỡ. Nếu server tắt qua nhiều kỳ, cần rà soát/cấp thủ công cho kỳ cũ vì không có lịch sử chức vụ để suy đúng quota quá khứ.
- Đổi quy tắc không chạy lại kỳ đã cấp thành công; thay mốc lịch vẫn kiểm tra dấu kỳ để chống cộng trùng.

GET/PUT trả thêm metadata `defaultLeaveTypeId`, `asOfDate`, `firstAccrualDate`, `firstResetDate`. first* là ngày kích hoạt đầu tiên từ mốc, không phải xác nhận kỳ đã chạy. UI hiển thị preview khi sửa lịch.

## Mặc định Nghỉ phép năm

Rule có `positionId`, `daysPerCycle`, optional `leaveTypeId`. Không truyền/null leaveTypeId thì backend tìm loại phép code **ANNUAL**, đang active và requiresBalance=true, rồi lưu ID đã resolve vào rule. Không hardcode ID, không tự tạo/sửa danh mục. Thiếu loại ANNUAL hợp lệ =>400; cần cấu hình danh mục trước. Truyền leaveTypeId rõ ràng vẫn chọn được loại phép khác có theo dõi số dư.

Tối đa200 cặp chức vụ/loại phép khác nhau. Position và LeaveType phải active. DaysPerCycle dương, tối đa99999, tối đa2 số thập phân; tổng số dư vẫn phải vừa precision và đủ dùng/đang giữ. Rule chỉ thu hồi không bắt buộc số ngày cấp. Bỏ trống loại rồi lại thêm rule cùng chức vụ với ID ANNUAL được xem là trùng sau resolve, trả400.

Nhân viên phải ACTIVE ở lúc xử lý. Nhân viên chưa có chức vụ hoặc không khớp quy tắc chức vụ dùng mức mặc định. ACTIVE_ON_DATE: đã vào làm ở ngày đến hạn thì nhận đủ suất. ONE_MONTH: HireDate.AddMonths(1) <= ngày đến hạn. Không tính tỷ lệ theo ngày công. Không suy chức vụ/trạng thái lao động lịch sử khi server bỏ lỡ kỳ.

## Nhân viên chưa có số dư

- Đến lịch **cấp**: đủ điều kiện thì tạo leave_balances theo employee_id, leave_type_id, year_no của ngày đến hạn; cộng vào entitled_days, không tự chuyển quota từ năm cũ.
- Đến lịch **thu hồi**: chỉ lấy các row đã tồn tại. Không có row =>bỏ qua; không tạo row0/âm để thu hồi. Không có phép khả dụng thì không trừ.
- Số dư vẫn chia theo năm dương lịch; /me mặc định năm hiện tại. Tần suất tùy chọn không đổi hệ thống sang fiscal-year, không tự chuyển dư giữa năm.

## Thu hồi an toàn

Thu hồi phần khả dụng chưa dùng bằng giảm adjustmentDays, giữ entitledDays/usedDays/reservedDays và lịch sử. Không zero hoặc xóa số dư. Ngày01/01 thu hồi các năm cũ đến năm trước; ngày khác thu hồi các năm đến năm của ngày đó. Không đụng quota cấp trước cho năm tương lai.

Đối tượng thu hồi dùng cùng cách xác định như cấp phép: khớp chức vụ thì lấy loại phép trong quy tắc riêng; không khớp thì lấy ANNUAL. Nếu cả hai lịch cùng đến hạn, thu hồi trước, cấp sau. Không cấp lại kỳ có ngày đến hạn nằm trước lần thu hồi gần nhất. Phép đang giữ cho đơn pending được bảo vệ; hủy/từ chối/hoàn phép vẫn theo quy trình Leave hiện có.

## Worker, transaction và chống trùng

LeaveAccrualWorker kiểm tra khi khởi động và mỗi300 giây. `LeaveAccrual__WorkerEnabled=false` tắt worker; `LeaveAccrual__PollSeconds` từ30..3600. API cần chạy để worker hoạt động. Chính sách enabled mặc địnhfalse.

POST /run uses the saved policy and server business date. Existing counters are preserved; see status/message and next-date metadata documented below.

Các worker/manual run/config write dùng khóa SystemSetting cùng transaction Serializable. AuditLog LeaveAutomation giữ dấu `accrual-cycle:yyyyMMdd` cho cấp theo lịch mới và `reset:yyyyMMdd` cho thu hồi. Dấu kỳ không phụ thuộc version/rate để không cấp trùng khi retry/restart hoặc đổi suất. Kỳ đã xong không tự cấp thêm cho nhân viên import/bổ sung sau đó; dùng cấp thủ công có kiểm soát nếu cần.

Cộng/thu hồi, version, audit và dấu kỳ cùng transaction; lỗi thì rollback toàn bộ. Employee locks/unique balance key và chunk500 giữ an toàn concurrency. Deadlock =>409 để retry. Không có transaction/cron Railway bên ngoài được tạo.

Lưu kết quả vào **leave_balances**. Audit per balance: LEAVE_BALANCE_ACCRUED/LEAVE_BALANCE_EXPIRED; audit kỳ: LEAVE_ACCRUAL_COMPLETED/LEAVE_RESET_COMPLETED; cấu hình: LEAVE_ACCRUAL_SETTINGS_UPDATED. Worker actorUserId=null, chạy bằng API ghi User người gọi. Không xóa dấu kỳ để giữ idempotency.

## Tương thích cấu hình cũ

JSON cũ không có scheduleVersion hoặc có version1 vẫn chạy accrualDay + daysPerMonth, ResetOn + RepeatResetYearly như trước; dấu cũ `accrual:yyyyMM` giữ nguyên. Không tự đổi lịch cũ khi restart hoặc GET. API vẫn nhận payload legacy; ngày/tháng cũ chỉ áp khi scheduleVersion1.

UI converts legacy settings only on explicit save. DaysPerCycle is the canonical amount; DaysPerMonth remains a legacy alias. Past anchors process only the latest incomplete cycle.

## Schema và kiểm thử

Không có migration mới cho thay đổi lịch JSON. Cần schema LeaveBalance/AuditLog đã triển khai trước, gồm migration20261117062126_ExtendLeaveBalanceManagement nếu môi trường chưa có. Không apply migration, không deploy, không bật lịch hoặc sửa dữ liệu thật trong lần triển khai này.

Tests bao gồm lịch1/2 tháng/1 năm, không kích hoạt tại mốc, calendar clamp/leap không trôi ngày, default ANNUAL, thiếu default catalog, thay lịch backdate, nhân viên chưa có quota được bỏ qua ở thu hồi và được tạo khi cấp, reset-only, idempotency và bảo toàn lịch sử. Tests legacy tiếp tục kiểm tra suất tháng cũ và concurrency/rollback.

## Kết quả kiểm tra chu kỳ mới — 2026-11-17

- Calendar/chu kỳ mới13/13 tests qua; kết hợp accrual legacy22/22 qua.
- Backend build thành công. Full suite457 tests:448 qua,9 lỗi cũ NV/TX thuộc EmployeeCreationTests; không sửa bộ sinh mã trong thay đổi này.
- Frontend53/53 tests qua, production build thành công. JSON mẫu, link và payload hai Postman Collection đã kiểm tra; số route119 và ví dụ129 không đổi.
- Không có migration mới, không apply migration, không deploy, không sửa/bật cấu hình hoặc chạy job trên database thật. Cập nhật tất cả API/worker sang bản hỗ trợ version2 trước khi lưu lịch version2.

## Overdue cycle execution (2026-11-17)

Past anchors are accepted. Only the latest due cycle is processed, without backfilling all missed cycles. Example: startDate=2026-10-16, interval=1 MONTH, run on 2026-11-17 credits 2026-11-16, creates missing leave_balances and returns nextAccrualDate=2026-12-16. The original startDate remains unchanged.

GET/PUT expose nextAccrualDate and nextResetDate alongside first-cycle preview dates. POST /run retains existing fields and adds status, message, policyEnabled, policyVersion, accrualDueDate, resetDueDate, nextAccrualDate, nextResetDate, matchedEmployees, eligibleEmployees and activeRules. HTTP 200 indicates successful execution, not necessarily a credit. Inspect status/message for disabled, not-due, already-processed or no-eligible-employee outcomes.

Credit completion receipts are written only for creditedBalances > 0. Existing zero-credit receipts remain audited and permit retry after correcting employee position/eligibility. Positive receipts still prevent duplicate credits. Reset receipts remain final even with zero balances, to protect allocations added after the reset date. No migration or production database changes.

Validation of overdue-cycle fix: backend build succeeds; 24 accrual/recurrence tests pass. Full backend suite: 450 passed, 9 existing EmployeeCreationTests failures (NV/TX employee-code expectation). Frontend full suite before added next-date regression: 53 passed; updated settings suite: 7 passed. Production frontend build succeeds. No migration applied or deployment performed.

## Số ngày mặc định và mức riêng theo chức vụ

- `settings.defaultDaysPerCycle`: mặc định **1 ngày mỗi chu kỳ** nếu không truyền; lớn hơn0, tối đa99999 và tối đa2 chữ số thập phân. Có thể chỉnh trên màn hình cấu hình.
- `rules: []` hợp lệ khi `enabled=true` với lịch version2. Không cần cấu hình chức vụ để cấp phép mặc định.
- Nhân viên đủ điều kiện không khớp quy tắc chức vụ, kể cả chưa có chức vụ, nhận mức mặc định cho loại phép ANNUAL đang active và `requires_balance=true`.
- Nếu khớp chức vụ, chỉ dùng các quy tắc chức vụ đó, **không cộng thêm mức mặc định**, kể cả khi quy tắc riêng chọn loại phép khác ANNUAL.
- Nếu ANNUAL mặc định chưa được cấu hình hợp lệ, bật lịch version2 trả400. Không tự tạo loại phép.
- Version1 giữ cách xử lý theo chức vụ cũ. Thay đổi số ngày hoặc quy tắc không cấp lại kỳ đã hoàn tất.

Ví dụ cấu hình cho mọi nhân viên đủ điều kiện, không cần chức vụ:

```json
{
  "version": 3,
  "settings": {
    "scheduleVersion": 2,
    "enabled": true,
    "defaultDaysPerCycle": 1,
    "accrualSchedule": { "startDate": "2026-10-16", "interval": 1, "unit": "MONTH" },
    "resetSchedule": null,
    "newHireEligibility": "ONE_MONTH",
    "rules": []
  }
}
```

`version` phải lấy từ GET mới nhất, không dùng cố định3. Muốn một chức vụ nhận2 ngày thay cho1 ngày, thêm `{"positionId":3,"daysPerCycle":2}` vào rules, dùng ID chức vụ thực tế. Với ONE_MONTH, nhân viên phải đủ một tháng tại ngày đến hạn, không phải ngày bấm chạy. Mốc16/10/2026, chu kỳ1 tháng, chạy17/11/2026 sẽ xử lý kỳ16/11/2026; thành công trả ngày kế tiếp16/12/2026. Cần lưu cấu hình trước khi bấm chạy.

Cấu hình nằm trong JSON `system_settings` (key `LEAVE_ACCRUAL`); kết quả cộng vào `leave_balances.entitled_days`, thu hồi vào `adjustment_days`, lịch sử ở AuditLog. Không thêm bảng hoặc migration.

Kiểm tra sau thay đổi mức mặc định: backend build thành công,25 tests cấp phép/chu kỳ qua; frontend54 tests qua và production build thành công. Không apply Migration hoặc deploy.
