# Intelex ERP 2

Website ERP tĩnh dành cho đội ngũ công nghệ trẻ, dựng từ `intelex-erp-static-spec.md` bằng HTML/CSS/JavaScript thuần. Không cần cài thư viện hoặc chạy build.

## Chạy trên máy

**Mở trực tiếp:** nhấp đúp `index.html` trong thư mục dự án bằng Chrome hoặc Edge. Không cần Node.js hoặc server. Giữ nguyên thư mục `assets` cạnh `index.html`. Nếu đang mở trang cũ, đóng tab rồi mở lại file.

**Chạy qua server (tùy chọn):** nhấp đúp `start-erp.cmd`, giữ cửa sổ server đang mở, sau đó truy cập **http://127.0.0.1:4173**.

Hoặc dùng terminal tại thư mục dự án:

```sh
node server.js
```

Nếu trình duyệt từng báo lỗi khi server chưa khởi động, mở lại địa chỉ trên sau khi terminal hiện `Intelex ERP: http://127.0.0.1:4173`.

Nhấn Ctrl+C tại terminal để dừng. Nếu cổng 4173 đang được sử dụng, dừng bản server cũ trước khi chạy lại. Cả URL HTTP và mở file `index.html` trực tiếp đều dùng cùng bản JavaScript đã đóng gói sẵn.

## Trải nghiệm bản demo

- Mặc định là Nguyễn Quang Minh / Manager, quản lý Backend và Frontend: **24 nhân sự, 4 dự án, 36/48 task hoàn thành, 21/24 đã check-in**.
- Bấm avatar trên topbar → chọn tài khoản demo. Có đầy đủ Admin, Dev, Leader, Manager và HR; có thể chọn từng nhân viên, gồm team QA ngoài phạm vi Manager.
- Trong dashboard, mở task ERP-010 → chọn Hoàn thành → lưu: KPI thành **37/48**, ERP Core thành **10/12 (83%)**.
- Danh sách công việc có bộ lọc và chế độ Kanban. Người có quyền được tạo task/giao lại cho thành viên trong dự án và phạm vi của mình.
- Tạo đơn nghỉ bằng Dev Backend, rồi chuyển lần lượt sang Trần Đức Anh (Leader), Nguyễn Quang Minh (Manager), Trần Thanh Hương (HR) để duyệt. Không tự duyệt đơn mình. Từ chối phải có lý do.
- Dữ liệu ngày demo cố định **19/10/2026, 10:00, UTC+7**; mỗi thao tác chấm công tăng đồng hồ mô phỏng một phút. Chưa check-out sẽ không có giờ công hoàn chỉnh.
- Chấm công và báo cáo có lọc team/ngày; Reports → Chấm công có kỳ ngày, tháng, khoảng ngày, nhân viên, phòng ban, CSV và In/PDF. Chọn lưu PDF trong hộp thoại in của trình duyệt.
- HR có thể thêm/sửa nhân viên, hợp đồng; Admin có thể quản lý tài khoản, thu hồi quyền mặc định, sửa cấu hình và danh mục, xem audit log.
- Tài liệu có preview và file Markdown mẫu tải thật. “Thêm tài liệu” chỉ thêm metadata, không upload file.
- Dữ liệu lưu bằng `localStorage` key `intelex-erp-demo:v1`. Avatar → Reset dữ liệu → xác nhận để quay lại seed. Khi không lưu được localStorage (có thể xảy ra khi mở file trực tiếp tùy trình duyệt), app vẫn chạy trong bộ nhớ; tải lại trang sẽ mất các thay đổi trong phiên đó.

## Cấu trúc

```text
index.html                 Khung HTML và điểm vào app
server.js                  Static server cục bộ (chỉ bind 127.0.0.1)
start-erp.cmd              Khởi động nhanh trên Windows
assets/css/                Tokens, giao diện và responsive/print
assets/js/data/seed.js      Dữ liệu giả lập có quan hệ ổn định
assets/js/store.js          Lưu trạng thái, workflow và mutation
assets/js/permissions.js    Rule quyền và phạm vi dữ liệu
assets/js/router.js         Sitemap và hash routing
assets/js/components/       UI dùng chung, dialog và toast
assets/js/pages/            Dashboard, công việc, HR, báo cáo và quản trị
assets/js/actions.js        Form và xử lý thao tác
assets/js/app.js            App shell, route và điều hướng (source module)
assets/js/dist/erp-browser.js  Bản classic script cho index.html, chạy được file://
scripts/build-browser.js    Tạo lại bản browser sau khi sửa source module
assets/images/             Logo SVG tự dựng
assets/documents/          Tài liệu Markdown mẫu
tests/erp.test.js           Kiểm thử dữ liệu, scope và nghiệp vụ
```

## Cập nhật mã nguồn

Các module nguồn vẫn được giữ riêng. Sau khi chỉnh JavaScript hoặc tài liệu Markdown mẫu, chạy lệnh sau rồi tải lại trang:

```sh
node scripts/build-browser.js
```

Người chỉ mở xem giao diện không cần chạy lệnh build; bản `assets/js/dist/erp-browser.js` đã được tạo sẵn. Script dùng Node.js chuẩn, không cần cài thư viện.

## Kiểm thử

```sh
node --test tests/*.test.js
```

Kiểm thử bao gồm số liệu seed, quan hệ bản ghi, 5 role và phạm vi, thay đổi KPI, chuỗi duyệt phép, trùng đơn/số dư/ngày làm việc, tính công và render các view/tab. Chạy không cần thư viện ngoài. Có thêm kiểm thử classic script trong môi trường giả lập `file://` không có module loader, fetch hay localStorage; kiểm tra khởi tạo dashboard, đổi role và preview tài liệu mẫu. Kiểm thử giả lập không thay thế việc duyệt trực quan file trên từng trình duyệt.

Server cục bộ đã được kiểm tra HTTP. Ngày 19/10/2026 đã mở thành công Dashboard trong trình duyệt tích hợp, xác nhận số liệu hiển thị và không có console error/warning. Ảnh xác nhận lưu tại `artifacts/dashboard-verified.jpg`. Lỗi ban đầu là timeout khi server chưa truy cập được; tab chuyển sang trang lỗi `data:text/html`, rồi công cụ tự động từ chối giao thức này. Khởi động server, chờ HTTP 200 và mở URL HTTP trong tab mới đã khắc phục. Chưa nghiệm thu toàn bộ luồng tương tác và các breakpoint 375/768/1024/1440 trên trình duyệt.

## Thiết kế và dependency

Giao diện sáng, accent xanh dương, thẻ bo nhẹ, biểu đồ thanh và doughnut bằng HTML/CSS, SVG icon nội bộ. Chạy offline cả khi mở trực tiếp `index.html` và khi dùng server cục bộ. Tài liệu mẫu đã được nhúng trong JavaScript nên preview không cần fetch file. Không dùng Chart.js, CDN, thư viện icon hoặc font bên ngoài; font ưu tiên Inter nếu máy có, fallback Segoe UI/system-ui. Không có dependency bên thứ ba cần cài đặt hay license bổ sung.

## Phạm vi và giới hạn

Đây là frontend demo để duyệt luồng và giao diện, chưa có backend, database, xác thực, upload, email hay đồng bộ thực tế. Bộ chuyển role và ma trận quyền chỉ mô phỏng; dữ liệu seed có thể đọc trong trình duyệt. Không nhập thông tin nhân sự thật.

Chức năng báo cáo và tính công dùng ca mẫu, chưa có ngày lễ/nghỉ nửa ngày, tính lương, bảo hiểm hoặc quy định lao động thực tế. Tăng ca chỉ cộng số giờ đã khai báo và đã duyệt; seed chưa có số giờ thì hiển thị 0. Các milestone là bốn giai đoạn mẫu suy ra từ dự án, chưa có trình biên tập mốc riêng. Danh mục loại phép có thể sửa nhưng không thay engine tính phép năm. Ma trận quyền cho phép thu hồi quyền sẵn có, không cấp thêm nghiệp vụ trái với role trong spec. Tài liệu tải là nội dung mẫu chung, chưa phải bộ tài liệu công ty.

Các thao tác tạo/sửa/giao việc, phê duyệt và quản lý user chỉ cập nhật store trên máy. Khi nối backend, thay tầng service/store bằng API, thực thi permission ở server, chuẩn hóa schema và bổ sung kiểm thử trình duyệt/API. Chưa triển khai hosting/production; ảnh concept gốc chưa được cung cấp để đối chiếu.


### Đăng nhập API và quyền màn hình

Ứng dụng yêu cầu đăng nhập qua `POST /api/auth/login` với `{userId, password}`.
JSON response (accessToken, tokenType, expiresAtUtc, user, roles, permissions) được lưu tại
localStorage key `intelex-erp-api-session:v1`; mật khẩu không được lưu. API tiếp theo gửi
`Authorization: Bearer <accessToken>`. Đăng xuất, HTTP 401 hoặc hết hạn sẽ xóa phiên.

Menu và đường dẫn trực tiếp kiểm tra `platform: WEB` và `canView: Y`, không bypass ADMIN.
Bảng `screenRoutes` trong `assets/js/permissions.js` ánh xạ URL sang code màn hình.
Tài liệu Auth chỉ xác nhận code mẫu WEB_EMPLOYEES; đối chiếu các code còn lại với danh mục
Screen thực tế của backend trước khi triển khai. Code chưa ánh xạ không được truy cập.
Các trang nghiệp vụ vẫn sử dụng dữ liệu demo hiện có, chưa tải dữ liệu theo tài khoản API.

Chạy `npm start` để dùng proxy `/api` cùng origin; cấu hình backend bằng biến `API_ORIGIN`.
Có thể cấu hình URL API trực tiếp bằng `window.INTELEX_API_BASE` trước khi tải bundle.
Chạy `npm run build` sau khi sửa source và `npm test` để kiểm tra.
