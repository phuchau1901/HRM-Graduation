# Cấu hình và căn cứ tính lương

## Chính sách có phiên bản

Không seed thuế suất, bảo hiểm hoặc hệ số tăng ca theo suy đoán. HR tạo policy DRAFT, nhập căn cứ pháp lý/quyết định, ngày hiệu lực và toàn bộ quy tắc. PUBLISHED không sửa rules; tạo policy mới và có thể đóng hiệu lực predecessor qua `supersedePolicyId` + version. Không rút ngắn khoảng đã dùng cho kỳ submitted/approved/locked/paid.

Mỗi kỳ chọn một policy PUBLISHED phủ **toàn bộ tháng**, cùng currency với các hồ sơ. Nếu chính sách thay giữa tháng hoặc chưa có phiên bản bao phủ, engine báo lỗi để HR đối soát, không tự áp dụng tỷ lệ không rõ căn cứ. Hồ sơ lương nhân viên được chia theo ngày hiệu lực nên tăng/giảm giữa tháng được hỗ trợ.

Nguồn pháp lý để bộ phận nghiệp vụ đối chiếu khi nhập chính sách: [Bộ luật Lao động 2019](https://datafiles.chinhphu.vn/cpp/files/vbpq/2019/12/45.signed.pdf), [Nghị định 145/2020/NĐ-CP](https://congbao.chinhphu.vn/tai-ve-van-ban-so-145-2020-nd-cp-32732-33806?format=pdf). Đây không phải bộ tỷ lệ pháp luật được hardcode hoặc tự cập nhật; doanh nghiệp phải xác nhận văn bản thuế/bảo hiểm có hiệu lực tương ứng và nhập vào policy.

## Bảng công nguồn

Lấy nhân viên ACTIVE đã tuyển trong tháng, cùng nhân viên có lịch/phép đã duyệt trong tháng dù trạng thái hiện tại đã thay đổi. Lấy hàng loạt schedules, attendance, approved leave và OT; không query từng nhân viên/ngày. Tối đa 2.000 nhân viên mỗi lần tổng hợp; từ chối khi vượt giới hạn. Thời gian nghiệp vụ Asia/Ho_Chi_Minh; timestamp UTC.

Ca dùng `rules_snapshot_json` trên WorkSchedule, không dùng cấu hình Shift hiện tại để suy lại quá khứ. Công thường = giao khoảng punch đầy đủ với khung ca, trừ break snapshot, tối thiểu 0. Chỉ có check-in hoặc check-out là lỗi; trùng lịch/trùng punch/trùng công-phép là lỗi. Không có punch là vắng mặt hưởng 0 công và cảnh báo để HR kiểm tra. Thiếu lịch không tự suy ra đã đi làm. Chốt công là thao tác có chủ ý, sau khi xem cảnh báo.

Phép APPROVED hoặc CANCELLATION_PENDING còn hiệu lực; Paid của LeaveType quyết định có hưởng lương. Leave hiện lưu tổng RequestedDays, chưa có session theo từng ngày: phân đều tổng ngày lên các ngày làm việc không phải lễ của khoảng nghỉ. Không suy đoán buổi sáng/chiều. Nếu cần phân bổ không đồng đều, đối soát nghiệp vụ trước khóa; chưa có daily leave session riêng.

OT chỉ APPROVED, có ApprovedHours và punch thực tế tương ứng. Giao request với attendance; loại phần đã tính công thường; không trả tiền kế hoạch/pending. ApprovedHours giới hạn phần đầu của khoảng request; ca qua đêm tách tại nửa đêm và mốc giờ đêm. Phân loại NORMAL/REST/HOLIDAY theo ngày thực tế từng đoạn; snapshot giữ lịch tuần và ngày lễ. OT trên ngày có ca vẫn không được tính trùng phần công thường; nếu doanh nghiệp cần coi toàn bộ ca ngày nghỉ là OT, phải xác định lại lịch/nghiệp vụ trước chốt.

Snapshot lưu từng ngày, phút công, phút chuẩn, phép, OT UTC, lịch/punch/request IDs, working days, holidays, settings version, lỗi/cảnh báo. Hash nguồn được so lại khi chốt. Timesheet LOCKED chặn Attendance, WorkSchedule, điều chỉnh công và phê duyệt cuối Leave/OT làm thay đổi tháng đã khóa.

## Công thức

- Công chuẩn: `rules.standardDays`; để null thì dùng số ngày làm việc theo lịch tuần trong toàn tháng, bao gồm ngày lễ. Không lấy số ca riêng của nhân viên làm mẫu số, tránh lương đủ tháng cho người mới vào.
- Công hưởng lương/ngày: `workedMinutes / scheduledMinutes + paidLeave`. UnpaidLeave không hưởng lương. Nếu policy `payPublicHolidays=true`, ngày lễ thuộc lịch làm việc và trong thời gian đủ điều kiện hưởng 1 công. Không tính trùng công/phép.
- MONTH: `baseSalary / standardDays × công hưởng lương`. DAY: `baseSalary × công hưởng lương`. HOUR: `baseSalary × giờ thực làm/giờ phép hưởng lương`. Hồ sơ có hiệu lực từng ngày; ngày chưa tuyển không trả lương.
- Phụ cấp cố định: `allowanceAmount / standardDays × công hưởng lương`.
- Components Prorate=true tương tự phụ cấp. Prorate=false phân bổ theo ngày lịch có hồ sơ (`amount / ngày trong tháng`), hỗ trợ đổi cấu hình giữa kỳ; không trả toàn bộ khoản tháng lặp lại trên mỗi hồ sơ.
- Lương giờ OT từ baseSalary theo hình thức MONTH/DAY/HOUR; cộng components `overtimeIncluded`, phụ cấp legacy chỉ khi policy bật. OT = giờ thực tế hợp lệ × lương giờ × hệ số từng loại. Phụ cấp làm đêm công thường = giờ đêm thực làm × lương giờ × `nightWorkPremiumRate`. Break được phân bổ tỷ lệ cho phút đêm vì snapshot ca hiện chưa có khoảng bắt đầu/kết thúc break riêng.
- KPI: chỉ target APPROVED, điểm cuối và phiên bản được snapshot. MONTH trả theo tháng, QUARTER chỉ tháng cuối quý, YEAR chỉ tháng 12. Tiềm năng thưởng từ profile, tùy prorate công hoặc ngày lịch; nhân `min(score,kpiScoreCap)/100`. Có cấu hình thưởng nhưng thiếu KPI duyệt là lỗi, không âm thầm trả 0.
- Điều chỉnh: khoản EARNING hoặc DEDUCTION dương, snapshot tên/tax flags của component, lý do bắt buộc. Không thay số cũ; hủy có version và audit, tính lại trước gửi.
- Bảo hiểm: căn cứ WEIGHTED theo ngày lịch từng hồ sơ hoặc MONTH_END. Áp dụng min paid days, floor/cap, employeeRate và employerRate. Phần doanh nghiệp báo riêng, không trừ vào Net. Chỉ khoản có taxDeductible mới giảm thu nhập tính thuế.
- Thu nhập tính thuế: tổng taxable earning − deductible deductions − personalDeduction − dependents cuối kỳ × dependentDeduction, chặn tối thiểu 0. Thuế NONE/FLAT/PROGRESSIVE; bậc tăng dần, cuối mở. Thuế OT FULL/BASE_ONLY/EXEMPT cấu hình, BASE_ONLY chỉ phần lương giờ cơ sở, không phần hệ số vượt.
- Làm tròn từng dòng theo roundingStep và AWAY_FROM_ZERO/TO_EVEN/DOWN/UP. Tổng = cộng các dòng đã làm tròn; Net = Gross − Deductions. Net âm hoặc vượt giới hạn lưu trữ là lỗi. Không dùng float cho tiền.

Snapshot PayrollDetail giữ input nguyên bản (profile slices, component/adjustment, rules, approved KPI, timesheet) và result + từng formula. Tổng bộ input + policy version được hash; kiểm tra lại trước submit và lock. Nếu đổi cấu hình lương/điều chỉnh/KPI ảnh hưởng thì phải tính lại. Một requestKey cùng kỳ chỉ cấp một kết quả gần nhất; client dùng lại key khi retry, key mới khi muốn tính lại chủ ý. Có version cho mọi chuyển trạng thái; serializable transaction + unique employee/month giữ chống trùng. Xung đột MySQL 1062/1205/1213 trả 409 để reload/retry, không tự duyệt hoặc cấp trùng.

Kỳ OPEN/REVIEW chưa gửi được tính lại; không có unlock/recalculate cho APPROVED/LOCKED/PAID. Sau khóa, sửa sai bằng adjustment kỳ tiếp theo có quy trình phê duyệt, giữ nguyên phiếu đã phát hành.

Tổng hợp không cộng lẫn các currency. Phiếu/Excel ghi currencyCode; thống kê nhiều loại tiền báo lỗi yêu cầu lọc theo phòng ban/nhân viên/kỳ, không quy đổi tỷ giá ngầm.

Fingerprint so sánh đúng các đoạn hiệu lực trong tháng và nội dung tiền/quy tắc. Đóng ngày kết thúc hồ sơ/chính sách ở tháng sau hoặc tăng concurrency version vì thao tác đó không làm kẹt kỳ tháng trước đã APPROVED; snapshot gốc vẫn giữ phiên bản/ngày đã dùng khi tính. Thay đổi thực sự ảnh hưởng tháng tính vẫn bị chặn hoặc yêu cầu tính lại.

Giờ ngoài lịch lấy từ unscheduled_attendances chỉ sau xác nhận OVERTIME hoàn tất; source chưa xử lý sẽ chặn khóa công. Không tạo WorkSchedule giả, không cộng công thường. Giao raw UTC với tháng/ngày Việt Nam và khoảng OT duyệt, không đếm trùng qua tháng. Xem [Attendance ngoài lịch](../Attendance/API.md#ghi-nhận-ngoài-lịch-và-xác-nhận-tăng-ca).
