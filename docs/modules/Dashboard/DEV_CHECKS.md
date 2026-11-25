# Kiểm thử dữ liệu Railway DEV tháng 10/2026

Không có thông tin kết nối DEV trong workspace tại thời điểm triển khai. Test SQLite đã tạo dữ liệu tháng10/2026 độc lập; không được coi là đã đối chiếu Railway.

## Chạy trực tiếp read model trên MySQL DEV (không deploy)

Trong terminal riêng, cấu hình `HRM_DASHBOARD_DEV_CONNECTION` bằng connection string của tài khoản **chỉ đọc DEV**, và `HRM_DASHBOARD_DEV_ACTOR` bằng userId muốn kiểm tra. Không đưa connection string/token vào chat, commit hay log.

```sh
dotnet test backend/HRM.API.Tests/HRM.API.Tests.csproj \
  --filter FullyQualifiedName~DashboardMySqlDevTests
```

Test bị SKIPPED khi thiếu biến. Khi có biến: mở connection riêng, `SET TRANSACTION READ ONLY`, chạy các Dashboard read models được phép với tháng10/2026, so tổng ngày/tổng lương và rollback. Không gọi EnsureCreated/Migrate, không chạy web host, seed hay background job. Không in tên nhân viên, số lương hoặc credentials trong output.

## Đối chiếu API/UI sau khi bản sửa được triển khai có chủ ý

1. Cấp quyền qua API quản trị hiện có, không chỉnh role trực tiếp trong DB. Dùng các user có scope ALL, DEPARTMENT, SELF và user chỉ có personal screens. Đăng nhập để lấy JWT mới, không chia sẻ token.
2. GET bảy route trong collection Dashboard với `year=2026&month=10`. Không mutate dữ liệu seed. Đối chiếu attendance bằng `/api/attendances/daily?from=2026-10-01&to=2026-10-31`: đúng scope và lưu ý statistics hiện có đếm unique nhân viên, Dashboard đếm lượt ca/ngày nên không so hai mẫu số khác nhau.
3. Chọn nhân viên có lịch nhưng thiếu cả hai punch: absent khi cửa sổ đã kết thúc; có check-in nhưng thiếu out: missingCheckOut. Người nghỉ phép không bị coi absent; ca qua đêm dùng WorkDate và snapshot.
4. So Payroll overview với payroll_details đã snapshot trong các kỳ tương ứng; phân biệt REVIEW/APPROVED/LOCKED/PAID. My Payslips chỉ gồm chính chủ, kỳ LOCKED/PAID. Không dùng salary_profiles để đối chiếu thực lĩnh.
5. Manager query departmentId ngoài scope phải403; không có Payroll VIEW phải403 trên payroll-overview và không có tiền trong summary; my-overview chỉ có tiền của user nếu WEB_MY_PAYSLIPS VIEW.
6. Pending: bước tương lai/đã xử lý không vào total; không có quyền domain không lộ metadata Payroll/KPI. Click item mở đúng approvalId; API chi tiết vẫn enforce quyền.
7. Chọn tháng không có lịch/KPI/payroll:0 cho count/tổng thực sự rỗng, rate/average null, không số giả. API lỗi hiển thị lỗi panel, không thay bằng 0.
8. Đổi tháng/phòng nhanh; response cũ không thay số liệu kỳ mới. Kiểm tra desktop/tablet/mobile, tooltip và liên kết màn hình chi tiết.

Headcount là hiện tại; departures chưa khả dụng vì thiếu ngày nghỉ việc trong schema. Không coi hai chỉ tiêu này là dữ liệu headcount lịch sử hoàn chỉnh.
