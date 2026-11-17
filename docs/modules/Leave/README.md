# Leave — Nghỉ phép, tăng ca và phê duyệt

[My balance và lịch cộng/reset hệ thống](ACCRUAL_SETTINGS.md) · [Quản lý số dư phép](BALANCES_API.md) · [Approvals và cấu hình quy trình duyệt](../Approvals/WORKFLOW_SETTINGS.md) · [API Specification](API.md) · [API Inventory](../../API/README.md) · [Postman](../../HRM-API.postman_collection.json)

Trạng thái: **IMPLEMENTED trong source**. Không đồng nghĩa đã apply migration, cấu hình quyền hoặc deploy.

## Audit và phần bổ sung

Sáu entity `LeaveType`, `LeaveBalance`, `LeaveRequest`, `OvertimeRequest`, `ApprovalRequest`, `ApprovalStep` và bảng tương ứng đã có từ migration `20261019074710_InitialHRMDatabase`. Attendance cũng đã có `AttendanceAdjustment`; trước thay đổi này chưa có API nghiệp vụ cho những bảng này. Không tạo lại bảng.

LeaveWorkflowService xử lý nghiệp vụ và dùng [engine Approvals](../Approvals/README.md) chung; tổng các API liên quan vẫn30 route: danh mục phép, cấp số dư, nghỉ phép, tăng ca, điều chỉnh công, quyết định/lịch sử phê duyệt và cấu hình luồng. Tái sử dụng EmployeeDataScope, NotificationService/outbox, AuditLog, SystemSetting và snapshot quy tắc Attendance.

Frontend trước đó chưa có các màn hình Leave/Approval trong checkout. Bổ sung My Leave (`/#/hr/my-leave`), Team Leave (`/#/hr/team-leave`), Leave Management (`/#/hr/leave-management`), Approval Center (`/#/hr/approvals`) theo giao diện workspace hiện có. Dữ liệu API thật, lọc/phân trang, tạo/chi tiết/hủy, duyệt/từ chối, cấu hình luồng, lỗi và skeleton.

## Quy tắc nghiệp vụ

- Chỉ nhân viên ACTIVE có tài khoản liên kết mới được gửi đơn cho chính mình. Không nhận employeeId, số ngày/giờ hay người duyệt từ payload tạo đơn.
- Phép tính cả ngày theo `WorkingDays` của Attendance settings, chia số dư theo từng năm. Chưa có lịch ngày lễ/ca cá nhân hoặc nửa ngày trong model này. Ngày nghiệp vụ Asia/Ho_Chi_Minh. Không gửi phép lùi ngày; tối đa 367 ngày lịch.
- Đơn PENDING giữ `ReservedDays`; chỉ sau cấp cuối mới chuyển sang `UsedDays`. Từ chối/hủy pending giải phóng phần giữ chỗ. Loại không yêu cầu số dư vẫn lưu snapshot phân bổ rỗng.
- Phép đã duyệt chỉ yêu cầu hủy khi chưa tới ngày bắt đầu; tạo luồng `LEAVE_CANCELLATION`, giữ số đã dùng cho tới duyệt cuối rồi hoàn đúng một lần. Từ chối hủy giữ nguyên APPROVED. Không sửa lịch sử phép đã bắt đầu bằng API này.
- Tăng ca từ 1 phút đến 24 giờ, giờ UTC chuẩn hóa từ offset; chặn trùng đơn pending/approved. `ApprovedHours` null khi pending/rejected, chỉ có giá trị ở cấp cuối. Đây là giờ đăng ký được duyệt, chưa phải dữ liệu thực tế cho payroll.
- Điều chỉnh công yêu cầu bản ghi Attendance có lịch và rules snapshot. Đề xuất là toàn bộ cặp giờ (null xóa một giờ), phải có ít nhất một giờ, trong khung lịch, không ở tương lai. Cấp cuối kiểm tra lại snapshot Attendance + version lịch; tính lại trạng thái/trễ/về sớm, xóa QR chứng cứ cũ và lưu trước/sau trong AuditLog. Dữ liệu đã thay đổi =>409 để từ chối và gửi lại, không ghi đè.
- Tăng ca/điều chỉnh công chỉ hủy khi pending. Thay đổi nội dung đơn bằng hủy và gửi lại.

## Phân quyền và cấu hình ban đầu

Đăng ký các screen qua API Administration hiện có nếu catalog môi trường chưa có; không tự seed/grant tài khoản sản xuất. Cấp đúng action và `dataScopes` cho các screen có dữ liệu nhân viên:

| Screen | Actions dùng | Scope |
| --- | --- | --- |
| WEB_LEAVE_REQUESTS | VIEW, NEW, UPDATE | SELF / DEPARTMENT / ALL |
| WEB_OVERTIME_REQUESTS | VIEW, NEW, UPDATE | SELF / DEPARTMENT / ALL |
| WEB_ATTENDANCE_ADJUSTMENTS | VIEW, NEW, UPDATE | SELF / DEPARTMENT / ALL |
| WEB_LEAVE_BALANCES | VIEW, UPDATE | VIEW ba scope; UPDATE DEPARTMENT / ALL |
| WEB_APPROVALS | VIEW, APPROVE | SELF / DEPARTMENT / ALL theo từng action |
| WEB_LEAVE_TYPES | VIEW, NEW, UPDATE | Danh mục chung, không lọc nhân viên |
| WEB_APPROVAL_SETTINGS | VIEW, UPDATE | Cấu hình chung, không lọc nhân viên |

VIEW/ALL không cho phép duyệt. Duyệt cần APPROVE + scope bao phủ nhân viên + đúng UserID của bước pending đầu tiên. Quyền lấy trực tiếp từ các role hiện hành theo action. NEW/UPDATE trên đơn chỉ áp dụng chính người gửi kể cả scope ALL. Team Leave dùng view=TEAM, yêu cầu scope rộng hơn SELF và chỉ phòng ban hiện tại.

Lưu cấu hình qua GET/PUT `/api/approval-workflow-settings`; ban đầu version=0, routes=[] và gửi đơn báo409 cho tới khi cấu hình. Không tự đoán HR. Cấu hình mỗi loại một chuỗi TEAM_LEAD / DEPARTMENT_MANAGER / USER / HR (UserId cụ thể có RoleCode tương ứng), 1–10 cấp; có thể chỉ dùng USER với employeeId (hoặc HR theo cấu hình cũ). Người duyệt cần tài khoản active, VIEW/APPROVE và scope phù hợp ngay lúc gửi. Mặc định cấm tự duyệt; các cấp phải là những người khác nhau. Thiếu lead/manager sẽ báo lỗi; không âm thầm bỏ cấp. Cấu hình được chốt thành ApprovalStep khi gửi; thay cấu hình không đổi đơn cũ. LEAVE_CANCELLATION không cấu hình riêng thì dùng luồng LEAVE.

## Transaction, migration và vận hành

Migration mới `20261117014440_CompleteLeaveApprovalWorkflow`: thêm version, snapshot phân bổ/sửa công, liên kết nhân viên vào approval, cấu hình self approval, trạng thái active của loại phép và reason/created_at tăng ca. Thêm unique `(employee_id,leave_type_id,year_no)` và `(approval_request_id,step_no)` cùng các index truy vấn; không CREATE TABLE, không SQL sửa dữ liệu nghiệp vụ. `created_at` tăng ca cũ dùng mốc 1970 khi thêm cột, không phải thời gian lịch sử được khôi phục.

**Chưa apply migration.** Người vận hành cần kiểm tra dữ liệu trùng trước hai unique index. Không tự xóa/gộp dòng trùng. Đơn cũ không có EmployeeId/snapshot/owner hợp lệ cần rà soát riêng; không backfill hoặc tự trừ phép lịch sử. Approval cũ chưa có EmployeeId không được đưa vào API scoped.

Các mutation dùng transaction Serializable, khóa nhân viên/lịch/approval, version concurrency và unique index. Xung đột/deadlock trả409; client tải lại trước khi thử. Tạo đơn, giữ/trừ/hoàn phép, bước duyệt, audit và outbox nằm cùng transaction. WORKFLOW notification dùng khóa sự kiện ổn định, không gửi trùng khi duyệt lại. Không tự gửi FCM riêng.

## Kiểm thử

`LeaveWorkflowTests`: giữ/trừ/hoàn số dư; thiếu số dư/năm; ngày và trùng lịch; nhiều cấp, sai người/sai thứ tự, tự duyệt; hủy/từ chối; tăng ca; scope; duyệt đồng thời bằng SQLite file nhiều connection; điều chỉnh công và lịch sử. `LeaveWorkflowMigrationTests` kiểm tra DDL MySQL offline/model snapshot và không tạo lại bảng. Giao diện có tests scope, loading/error/retry, pagination, cancel version, người duyệt và approval version.

Concurrency tests chạy SQLite, không thay thế kiểm thử tải/deadlock trên MySQL staging. Không truy cập hoặc sửa database Railway trong quá trình triển khai này.

## Kết quả kiểm tra ngày 2026-11-17

- `dotnet build backend/HRM.API/HRM.API.csproj --no-restore`: thành công, 0 warnings/errors.
- `dotnet test ... --filter FullyQualifiedName~HRM.API.Tests.LeaveWorkflow`: 15/15 qua (14 nghiệp vụ + 1 migration).
- Toàn bộ `dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj --no-build --no-restore`: **380 qua, 9 lỗi, tổng389**. Cả9 lỗi thuộc `EmployeeCreationTests` hiện có: các kỳ vọng mã NV và các trường hợp collision/rollback phụ thuộc NV không khớp implementation sinh TX. Không chỉnh module sinh mã nhân viên trong phạm vi Leave này.
- `npm --prefix web-admin test -- --reporter=dot`: 35/35 qua, gồm4 test màn hình Leave/Approval mới.
- `npm --prefix web-admin run build`: thành công.
- Inventory:112 REST routes không trùng, mỗi collection Postman119 request examples. Không chạy collection mutation vào môi trường thật.
- Không apply migration, không deploy Railway, không sửa dữ liệu database thật. Test database SQLite tạm được tạo riêng; migration SQL MySQL chỉ sinh offline để kiểm tra.

### Sửa thứ tự index phục vụ FK MySQL

Migration `20261117014440_CompleteLeaveApprovalWorkflow` tạo các composite index thay thế trước khi DROP index đơn đang hỗ trợ khóa ngoại. Down khôi phục index đơn trước khi DROP composite index. Tests kiểm tra cả thứ tự operations và SQL MySQL ở hai chiều. Với lỗi DROP INDEX đầu tiên của bản migration cũ như log báo, migration dừng trước các thay đổi schema của migration này; sau khi cập nhật source có thể chạy lại cùng lệnh database update. Không tự drop foreign key hoặc tắt FOREIGN_KEY_CHECKS. Nếu lỗi ở bước sau trong một lần chạy khác, cần kiểm tra schema thực tế trước vì MySQL DDL có thể đã commit từng bước.

USER là bước chọn nhân viên cụ thể qua employeeId, không yêu cầu role HR. Khi lưu kiểm tra nhân viên ACTIVE có tài khoản ACTIVE. Khi gửi đơn chốt UserID và EmployeeId vào bước; khi duyệt kiểm tra lại liên kết user-employee đúng snapshot. Frontend nhập Employee ID cho USER; HR cũ vẫn dùng User ID + Role code. Migration mới 20261117043059_SnapshotApprovalEmployee thêm snapshot nullable + FK/index, chưa apply; không backfill bước cũ. Xem API để biết xử lý cấu hình/bước legacy.

## Leave Balance Management

WEB_LEAVE_BALANCES có màn hình riêng Human Resources → Số dư phép tại /#/hr/leave-balances, dùng chung trong My Leave/Team Leave/Leave Management. Bổ sung phép chuyển năm và tổng điều chỉnh, số còn lại/khả dụng, cấp mới một nhân viên/phòng ban/phạm vi quản lý, lịch sử lý do và cấp hàng loạt idempotent. Chi tiết API, quy tắc và migration 20261117062126_ExtendLeaveBalanceManagement tại [BALANCES_API.md](BALANCES_API.md). Chuyển năm vẫn do người quản lý nhập theo chính sách đã duyệt. Cộng tháng/reset có thể cấu hình riêng qua [System Settings](ACCRUAL_SETTINGS.md), mặc định chưa bật. Không apply migration hoặc deploy.

## Tách module Approvals

ApprovalRequest/ApprovalStep, query/decision/settings controller và workflow engine chuyển sang Modules/Approvals. Phê duyệt nghỉ phép/hủy phép thuộc Modules/Approvals/Modules/Leave; nghiệp vụ quota dùng LeaveBalanceAccounting. Các loại tăng ca/điều chỉnh công có adapter riêng. [API cha và bộ lọc module](../Approvals/API.md) · [Cách thêm loại duyệt khác](../Approvals/ARCHITECTURE.md). Không đổi bảng hoặc tạo migration cho việc tách module.
