# AuditLog — Nhật ký thay đổi nghiệp vụ

[Module System](README.md) · [API System](API.md) · [Database](../../guides/DATABASE.md)

## Trạng thái hiện tại

Bảng `audit_logs`, entity `AuditLog` và configuration đã có từ InitialHRMDatabase. Các service đã ghi audit cho những thao tác dưới đây. Đã có API GET danh sách và chi tiết `/api/audit-logs` trong module System; chưa có màn hình frontend đọc log. Chưa có trường `Description`/mô tả dễ đọc riêng trong entity/table, chỉ có mã `Action` và payload before/after.

API đọc dùng bảng hiện có, không cần migration. Không kiểm tra dữ liệu/log live, không apply migration.

## Cấu trúc bảng

| Entity | MySQL column | Kiểu | Ý nghĩa |
| --- | --- | --- | --- |
| ID | id | BIGINT, PK, AUTO_INCREMENT | ID của bản ghi audit |
| ActorUserID | actor_user_id | VARCHAR(100), nullable | Người thực hiện; FK tới users.user_id, Delete Restrict |
| Action | action | VARCHAR(100), bắt buộc | Mã thao tác, ví dụ SETTINGS_UPDATED |
| EntityType | entity_type | VARCHAR(100), bắt buộc | Loại resource; một số service System ghi chung System |
| EntityID | entity_id | VARCHAR(60), bắt buộc | Định danh resource, có thể chứa prefix hoặc mã rút gọn |
| BeforeJSON | before_json | JSON, nullable | Dữ liệu trước thay đổi hoặc metadata, tùy service |
| AfterJSON | after_json | JSON, nullable | Dữ liệu sau thay đổi hoặc metadata/kết quả |
| CreatedAt | created_at | DATETIME(6), bắt buộc | Thời điểm ghi theo UTC từ server |

Index hiện có: PK id và index actor_user_id phục vụ FK. Chưa có index riêng theo action/entity/time. Không giả định log có IP, HTTP status, result, description hoặc traceId ở cấp cột: các trường đó không có trong entity hiện tại. traceId/result chỉ có trong một số payload JSON.

## Sự kiện System Settings và Attendance

Tất cả các sự kiện trong bảng dưới được `SystemSettingsService.Audit` ghi với `EntityType = "System"`. JSON dùng camelCase.

| Action | Mô tả | EntityID | BeforeJSON / AfterJSON |
| --- | --- | --- | --- |
| SETTINGS_UPDATED | Cập nhật Password Policy hoặc Attendance Settings | PASSWORD_POLICY hoặc ATTENDANCE | Toàn bộ settings trước/sau; không bọc settings/version |
| SHIFT_SAVED | Tạo hoặc sửa ca làm việc | shift:{id} | ShiftView cũ hoặc null khi tạo / ShiftView mới |
| SCHEDULE_SAVED | Tạo hoặc cập nhật lịch phân ca | schedule:{id} | ScheduleView cũ hoặc null / ScheduleView mới, gồm rules snapshot |
| SCHEDULE_CANCELLED | Hủy mềm lịch chưa bắt đầu | schedule:{id} | null / object có ID của lịch |
| CHECK_IN | Ghi nhận giờ vào từ server | attendance:{id} | null / scheduleId, atUtc, status, lateMinutes, earlyMinutes |
| CHECK_OUT | Ghi nhận giờ ra từ server | attendance:{id} | null / cùng cấu trúc CHECK_IN |
| ATTENDANCE_CLOSED | Chốt trạng thái sau cửa sổ check-out | schedule:{id} | null / status cuối |
| QR_SESSION_CREATED | Tạo phiên QR tại địa điểm hợp lệ | qr:{id} | null / locationCode, expiresAt; không token/nonceHash |

SHIFT_SAVED và SCHEDULE_SAVED hiện dùng chung action cho create/update; phân biệt bằng BeforeJSON null hay có dữ liệu. Không có trường description được tạo tự động từ các mô tả trong bảng này.

Ví dụ response GET chi tiết CHECK_IN:

```json
{
  "id": 100,
  "actorUserId": "employee.account",
  "action": "CHECK_IN",
  "entityType": "System",
  "entityId": "attendance:25",
  "beforeJson": null,
  "afterJson": {
    "scheduleId": 20,
    "atUtc": "2026-11-16T01:06:00Z",
    "status": "INCOMPLETE",
    "lateMinutes": 1,
    "earlyMinutes": 0
  },
  "createdAt": "2026-11-16T01:06:00Z"
}
```

DTO chuẩn hóa tên camelCase; beforeJson/afterJson được parse thành JSON thực, không phải chuỗi JSON escape. Payload giữ nguyên cấu trúc của service ghi log.

## Sự kiện các module khác

| Nhóm | Action | EntityType |
| --- | --- | --- |
| Users | USER_CREATE, USER_UPDATE, USER_STATUS, USER_ROLES | User |
| Password | PASSWORD_RESET cho SELF_CHANGE/ADMIN_RESET, gồm thành công và một số thất bại | User |
| Roles/permissions | ROLE_SAVE, ROLE_DELETE, PERMISSIONS_UPDATE | Role |
| Screen catalog | SCREEN_SAVE | Screen |
| Employee | EMPLOYEE_CREATED, EMPLOYEE_UPDATED, EMPLOYEE_DEACTIVATED, EMPLOYEE_DEPARTMENT_CHANGED, EMPLOYEE_TEAM_CHANGED | Employee |
| Hợp đồng | CONTRACT_CREATED, CONTRACT_UPDATED | Contract |
| Teams | TEAM_CREATED, TEAM_UPDATED, TEAM_DELETED | Team |

Không coi đây là audit mọi bảng: Department/Position service hiện không ghi AuditLog; AuthService trusted password primitives/development seed không có cùng PASSWORD_RESET audit như API reset. Việc ghi password history là cơ chế riêng, không thay thế AuditLog. Không có audit submission/approval AttendanceAdjustments khi API đó chưa tồn tại.

Các payload không đồng nhất giữa service:

- AdministrationService bọc before/after bằng `{resourceId, traceId, value}`. Một before không có giá trị có thể là JSON object chứa value=null, không phải SQL NULL. ResourceId dài hơn60 ký tự được băm/rút gọn vào EntityID; ID gốc vẫn trong JSON.
- TeamService serialize TeamDto trực tiếp, property casing theo JsonSerializer mặc định, khác camelCase của System.
- Employee audit chung chỉ ghi metadata employeeId/contractId/traceId, không có đầy đủ before/after hồ sơ. EMPLOYEE_TEAM_CHANGED riêng có TeamId/DepartmentId trước/sau.
- PASSWORD_RESET có actorUserId, targetUserId, type, timestamp, result, traceId trong AfterJSON; không password/hash/salt. EntityID dài có thể được rút gọn, dùng targetUserId trong JSON khi cần đối chiếu.

## Thành công, thất bại và transaction

Audit thành công của các mutation nghiệp vụ được lưu cùng transaction: nếu lưu audit hoặc nghiệp vụ lỗi, transaction rollback cả hai. Không có audit thành công cho một thay đổi đã rollback. Idempotent punch phát lại cùng requestKey trả record có sẵn, không tạo audit punch thứ hai.

Các mutation System thông thường không tạo AuditLog riêng cho mọi request lỗi 400/403/409/412. Các lỗi HTTP vẫn có access log. Trường hợp reset password có filter riêng:

- Thành công: PASSWORD_RESET / result=SUCCESS, cùng transaction đổi mật khẩu/revocation.
- Sau khi transaction lỗi rollback, filter dùng context riêng để ghi VALIDATION_FAILED, AUTHENTICATION_FAILED, PERMISSION_DENIED, NOT_FOUND hoặc FAILED.
- Rate limit429 ghi RATE_LIMITED; type=UNKNOWN vì limiter chạy trước body binding. Type không hợp lệ được chuẩn hóa INVALID/UNKNOWN, không lưu string tùy ý của client.
- Thiếu/sai JWT bị middleware từ chối trước action vẫn theo Auth/access log, không giả định luôn có AuditLog.
- Nếu hạ tầng không ghi được audit thất bại, giữ response gốc và log lỗi vận hành với traceId; không log exception/request chứa secret.

## Bảo mật và giới hạn dữ liệu

Không ghi oldPassword/newPassword, password hash/salt hoặc QR token/nonceHash vào audit. Before/after có thể chứa dữ liệu nội bộ (email, employee/role mapping, địa điểm cấu hình), không phải dữ liệu public.

Cả hai API yêu cầu JWT và quyền riêng WEB_AUDIT_LOGS/VIEW, kiểm tra grant hiện tại bằng PermissionService. Đây là quyền đọc audit toàn hệ thống, bao gồm payload chi tiết có thể chứa dữ liệu cá nhân/nội bộ; chỉ cấp cho người kiểm toán được phép. Không kế thừa WEB_SYSTEM_SETTINGS/VIEW hay WEB_EMPLOYEES/VIEW, không tự cấp cho Role. SELF/DEPARTMENT không dùng để lọc cấu hình/log toàn cục và không bị thay đổi bởi API này. Danh sách chỉ trả metadata, payload chỉ có ở API chi tiết. Xem [API contract](API.md#auditlog).

Chưa có retention/purge/job cleanup hoặc tính năng chống sửa audit ở cấp database. Việc các service chỉ insert log không có nghĩa dữ liệu là append-only bất biến đối với tài khoản DB. Không có chức năng sửa/xóa audit qua API hiện tại.

## Tra cứu read-only khi cần đối chiếu

SQL minh họa cho operator có quyền đọc đã được duyệt; không được chạy trên DB live trong lần viết tài liệu này:

```sql
SELECT id, actor_user_id, action, entity_type, entity_id,
       before_json, after_json, created_at
FROM audit_logs
WHERE entity_type = 'System'
  AND entity_id = 'ATTENDANCE'
ORDER BY created_at DESC, id DESC
LIMIT 50;
```

AuditLog khác access log: ApiAccessLoggingMiddleware ghi request/route template/status/duration/traceId vào application logger, không ghi before/after nghiệp vụ vào audit_logs. Khi payload có traceId có thể nối với X-Correlation-Id/access log. Audit System hiện chưa có traceId trong payload nên không đảm bảo liên kết trực tiếp bằng trường đó cho mọi sự kiện.

## Source đối chiếu

- Modules/System/Entities/AuditLog.cs và Configurations/AuditLogConfiguration.cs.
- Modules/System/Services/SystemSettingsService.cs, AttendanceConfigurationService.cs, AttendanceOperationsService.cs.
- Modules/Authorization/Services/AdministrationService.cs, PasswordResetAudit.cs.
- Modules/Employees/Services/EmployeeService.cs; Modules/Organization/Services/TeamService.cs.
- Middleware/ApiAccessLoggingMiddleware.cs; migration InitialHRMDatabase tạo bảng audit_logs.

Các đường dẫn source tính từ backend/HRM.API. Test liên quan: SystemSettingsTests (audit settings), AttendanceConfigurationTests (không rò QR secret), PasswordResetApiTests/AdministrationApiTests (audit password), EmployeeApiTests/TeamApiTests (transaction/audit và rollback).
