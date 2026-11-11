# Intelex ERP — Đặc tả website tĩnh

Phiên bản: 1.0 · Ngôn ngữ giao diện: tiếng Việt · Công nghệ: HTML5, CSS3, JavaScript thuần.

## 1. Mục tiêu và cơ sở thiết kế

Xây dựng bản demo ERP có thể điều hướng và thao tác bằng dữ liệu giả lập, dùng để duyệt giao diện, luồng nghiệp vụ và phân quyền trước khi nối backend. Mở mặc định Dashboard của **Manager**, cho phép chuyển thử giữa **Admin, Dev, Leader, Manager, HR**.

Sitemap và phạm vi role kế thừa hội thoại “Xác định nhu cầu ERP”. Ảnh dashboard được nhắc đến nhưng không có trong dữ liệu hội thoại và thư mục dự án tại thời điểm lập tài liệu, nên chưa thể xác nhận độ giống ảnh. Bố cục và thông số dưới đây là baseline triển khai; khi có ảnh gốc, đối chiếu lại tỷ lệ, màu và khoảng cách trước khi chốt thiết kế. Không coi các thông số bổ sung này là chi tiết đã xác nhận từ ảnh.

MVP cần đạt:

- Một app shell thống nhất, đủ 10 nhóm menu, các route chính có nội dung thực tế.
- Dashboard Manager hoàn chỉnh với KPI, biểu đồ, báo cáo chấm công, task, thông báo và hoạt động.
- Tìm kiếm, lọc, sắp xếp, phân trang, modal, drawer và cập nhật dữ liệu demo hoạt động.
- Role và phạm vi dữ liệu thể hiện nhất quán ở menu, route, nút hành động, bảng và biểu đồ.
- Responsive từ điện thoại đến desktop; dữ liệu và trạng thái có thể reset để demo lại.

## 2. Role và phạm vi dữ liệu

| Role | Người dùng | Phạm vi và tác vụ chính |
|---|---|---|
| Admin | Quản trị hệ thống | Tất cả dữ liệu demo; quản lý users, roles, permissions, cấu hình, audit log |
| Dev | Nhân viên lập trình | Hồ sơ/chấm công/đơn của mình; dự án được tham gia; task được giao; cập nhật tiến độ task của mình |
| Leader | Trưởng nhóm | Quyền cá nhân; nhân sự, task, attendance và workload của team; giao việc; duyệt cấp 1 |
| Manager | Quản lý Dev | Quyền cá nhân; nhiều team và dự án được giao quản lý; báo cáo tổng hợp; duyệt cấp 2 |
| HR | Quản lý nhân sự | Quyền cá nhân; nhân sự, hợp đồng, attendance và phép toàn công ty; xử lý nghiệp vụ HR |

Không suy luận phạm vi chỉ từ chức danh: dùng `userId`, `teamId`, `managedTeamIds`, `project.memberIds`, `project.managerId`. HR chỉ xem thông tin tổng quan dự án và danh bạ team; không sửa task, không truy cập báo cáo hiệu suất Dev. Manager/Leader không thấy hợp đồng và tài liệu HR riêng tư.

## 3. Sitemap và route

Dùng một trang `index.html`, hash routing để refresh và truy cập trực tiếp không cần cấu hình server rewrite. Quy ước `#/projects/:id` là route chi tiết, `:id` là ID bản ghi.

```text
Intelex ERP
├── Dashboard                         #/dashboard
├── My Workspace                      #/workspace/tasks (mặc định)
│   ├── My Tasks                      #/workspace/tasks
│   ├── My Projects                   #/workspace/projects
│   ├── My Attendance                 #/workspace/attendance
│   └── My Leave                      #/workspace/leave
├── Team Management                   #/team/overview
│   ├── Team Overview                 #/team/overview
│   ├── Team Members                  #/team/members
│   ├── Team Tasks                    #/team/tasks
│   ├── Team Attendance               #/team/attendance
│   ├── Team Leave                    #/team/leave
│   ├── Team Workload                 #/team/workload
│   └── Team Reports                  #/team/reports
├── Project Management                #/projects
│   ├── Projects / Create / Detail    #/projects, #/projects/:id
│   ├── Tasks                         #/projects/tasks
│   ├── Milestones                    #/projects/milestones
│   ├── Project Members               #/projects/members
│   ├── Workload                      #/projects/workload
│   ├── Timeline                      #/projects/timeline
│   └── Project Reports               #/projects/reports
├── Human Resources                   #/hr/employees
│   ├── Employees / Profile / Docs    #/hr/employees, #/hr/employees/:id
│   ├── Organization                  #/hr/organization
│   │   └── Departments / Teams / Positions (tabs)
│   ├── Contracts                     #/hr/contracts
│   ├── Attendance                    #/hr/attendance
│   │   └── Company / Adjustments / Shifts / Late–Early / Overtime (tabs)
│   ├── Attendance Reports            #/hr/attendance-reports
│   ├── Leave Management              #/hr/leave
│   │   └── Requests / Types / Balances (tabs)
│   └── HR Reports                    #/hr/reports
├── Approval Center                   #/approvals
│   └── Leave / Overtime / Attendance Adjustments / General / History (tabs)
├── Reports & Analytics               #/reports
│   └── Employee / Attendance / Leave / Task / Project / Team / Management (tabs)
├── Documents                         #/documents
│   └── Company / Policies / Project / Shared (tabs)
├── Notifications                     #/notifications
│   └── All / Task / Attendance / Leave / System (tabs)
└── Administration                    #/admin/users
    ├── Users                         #/admin/users
    ├── Roles                         #/admin/roles
    ├── Permissions                   #/admin/permissions
    ├── Audit Logs                    #/admin/audit-logs
    ├── System Settings               #/admin/settings
    └── Master Data                   #/admin/master-data
```

Các nhóm chưa có quyền bị ẩn. Với Dev, hồ sơ cá nhân nằm trong menu tài khoản/My Workspace, không hiển thị cả module HR. Route tĩnh như `#/projects/tasks` phải được so khớp trước route động `#/projects/:id`. Trang không tồn tại hiển thị 404 với nút về Dashboard; route không có quyền hiển thị 403.

## 4. Layout tổng thể

- Desktop: sidebar trái rộng `248px`, topbar cao `72px`, nội dung nền xám rất nhạt; sidebar và topbar cố định, nội dung chính cuộn.
- Main có lề `24px`, khoảng cách card `24px`, nội dung rộng tối đa `1600px` và căn giữa khi màn hình lớn.
- Sidebar thu gọn còn `72px`; main và topbar tự điều chỉnh theo chiều rộng sidebar, không bị che nội dung.
- Mỗi trang gồm breadcrumb, tên trang, mô tả ngắn, toolbar hành động/lọc và nội dung.
- Footer nhỏ: “Intelex ERP · Bản demo dữ liệu giả lập”; không chiếm nhiều chiều cao.

### 4.1 Sidebar

Logo chữ **INTELEX** và nhãn ERP ở đầu; logo tạm có thể dùng chữ/SVG đơn giản. Hiển thị 10 nhóm theo sitemap, icon nét đồng bộ 20px, submenu thụt vào 16px. Nhãn chính giữ tiếng Anh như sitemap, mô tả và nội dung trang dùng tiếng Việt.

Menu đang chọn có nền xanh nhạt, chữ/icon xanh đậm và dấu chỉ thị bên trái. Nhóm có submenu dùng nút accordion, có `aria-expanded`; khi vào route con phải mở đúng nhóm. Badge Approval/Notifications lấy số lượng trong phạm vi người dùng. Cuối sidebar có nút thu gọn và thông tin người dùng hiện tại. Khi thu gọn, icon có tooltip và vẫn mở được submenu bằng bàn phím.

### 4.2 Topbar

Từ trái sang phải: nút menu, breadcrumb, tìm kiếm toàn cục, nút thông báo có badge, avatar/tên/role và menu tài khoản. Thanh tìm kiếm tìm tên dự án, mã/tên task và nhân viên được phép xem; debounce khoảng 250ms, trả tối đa 8 kết quả có link.

Menu tài khoản gồm Hồ sơ cá nhân, chọn người dùng demo theo role và Reset dữ liệu demo. Gắn nhãn “Chế độ demo” cạnh bộ chuyển role. Chuông mở popover 5 thông báo gần nhất, có “Xem tất cả”. Bấm ngoài hoặc Escape đóng popover; focus trở lại nút mở.

## 5. Dashboard Manager

### 5.1 Bố cục desktop chuẩn tại 1440 × 900

```text
┌──────────┬─────────────────────────────────────────────────────┐
│ Sidebar  │ Topbar: breadcrumb · tìm kiếm · chuông · tài khoản   │
│          ├─────────────────────────────────────────────────────┤
│          │ Tổng quan quản lý           Ngày / Team / Làm mới   │
│          │ Xin chào Minh, đây là tình hình các team của bạn.   │
│          │ [Nhân sự] [Dự án] [Task hoàn thành] [Chấm công]     │
│          │ [Tiến độ dự án — 8 cột] [Chấm công hôm nay — 4 cột]│
│          │ [Báo cáo chấm công — 8] [Task sắp đến hạn — 4]     │
│          │ [Hoạt động gần đây — 7] [Thông báo — 5]             │
└──────────┴─────────────────────────────────────────────────────┘
```

Grid nội dung 12 cột. Dãy KPI nằm trên vùng nhìn đầu tiên; các hàng dưới có thể cuộn, không ép toàn bộ dashboard vào một màn hình. Header có ngày xem mặc định `19/10/2026`, bộ lọc team gồm “Tất cả team quản lý”, Backend, Frontend; nút làm mới tính lại dữ liệu hiện tại, không tự tạo số ngẫu nhiên. Link “Xem tất cả” đi đúng trang với bộ lọc tương ứng.

### 5.2 KPI cards

Mỗi card có icon trong ô màu nhạt, tiêu đề 13–14px, số chính 28px, đơn vị và dòng giải thích. Bốn card cùng chiều cao tối thiểu 120px.

| Card | Mẫu mặc định | Quy tắc tính |
|---|---|---|
| Nhân sự quản lý | 24 người · 2 team | Đếm nhân sự đang làm trong các team thuộc phạm vi Manager |
| Dự án đang chạy | 4 dự án | Dự án `in_progress` mà Manager được giao quản lý |
| Task hoàn thành | 36/48 · 75% | Task `done` / tổng task thuộc 4 dự án trong bộ dữ liệu hiện tại |
| Chấm công hôm nay | 21/24 · 87,5% | Nhân viên có check-in / nhân viên được xếp lịch ngày đang xem, tính cả người đi trễ |

Không hiển thị so sánh phần trăm tăng/giảm khi không có dữ liệu kỳ trước. Mẫu số bằng 0 hiển thị “Chưa có dữ liệu”, không hiện `NaN` hoặc vô cực.

### 5.3 Biểu đồ tiến độ dự án

Card rộng 8 cột, cao khoảng 320px, tiêu đề “Tiến độ dự án”, ghi chú “Theo số task hoàn thành”. Biểu đồ thanh ngang, trục 0–100%; mỗi thanh có tên dự án và nhãn phần trăm. Màu xanh cho đúng kế hoạch, cam cho có nguy cơ; trạng thái phải có chữ đi kèm.

| Dự án | Hoàn thành / Tổng task | Tiến độ | Trạng thái |
|---|---|---|---|
| ERP Core | 9/12 | 75% | Đúng kế hoạch |
| Customer Portal | 9/12 | 75% | Đúng kế hoạch |
| Mobile App | 6/12 | 50% | Có nguy cơ |
| Internal Tools | 12/12 | 100% | Chờ nghiệm thu |

Tooltip gồm tên, số task done/tổng và hạn dự án. Click thanh hoặc link tên mở chi tiết dự án. Card có danh sách số liệu dạng chữ để đọc bằng trình đọc màn hình hoặc dùng khi chart không tải được. Trạng thái dự án và tiến độ task tách riêng: 100% task vẫn có thể đang chờ nghiệm thu.

### 5.4 Biểu đồ chấm công

Card rộng 4 cột, cao bằng card tiến độ. Doughnut “Chấm công hôm nay”; tâm hiển thị `21/24` và “Đã check-in”. Chú giải bốn trạng thái loại trừ lẫn nhau: Đúng giờ 19 (xanh), Đi trễ 2 (cam), Nghỉ phép 2 (tím), Chưa check-in 1 (xám). Tổng = 24; 19 + 2 = 21 đã check-in.

“Chưa check-in” không tự đổi thành “Vắng không phép” khi chưa kết thúc ca. Nếu chọn ngày cuối tuần không có ca, hiển thị trạng thái “Không có lịch làm việc”. Lọc team/ngày phải cập nhật đồng thời KPI, chart và bảng liên quan.

### 5.5 Bảng báo cáo chấm công

Card rộng 8 cột, tiêu đề “Báo cáo chấm công”, hiển thị ngày và team đang chọn, 5 dòng/trang trên Dashboard. Trang báo cáo đầy đủ dùng 10/20/50 dòng/trang.

Cột: Mã NV, Họ tên + avatar, Team, Check-in, Check-out, Giờ công, Trạng thái. Sắp xếp theo tên hoặc giờ vào; tìm tên/mã nhân viên; lọc trạng thái. Header sticky khi bảng cuộn; mobile dùng cuộn ngang có chỉ báo.

Ngày demo mặc định được quan sát lúc `10:00` nên check-out và giờ công của ca chưa kết thúc hiển thị `—`, kèm “Đang làm việc”; không tạo check-out tương lai. Ngày quá khứ có thể có đủ giờ vào/ra. Nghỉ phép hiển thị badge và `—` ở cột giờ. Click nhân viên mở drawer hồ sơ tóm tắt đúng quyền.

Trang Reports/Attendance bổ sung lọc ngày, khoảng ngày/tháng, nhân viên, team, phòng ban; bảng tổng hợp gồm Công chuẩn, Công thực tế, Đi trễ, Về sớm, Giờ tăng ca, Ngày phép. Export CSV thật từ dữ liệu đã lọc, hỗ trợ tiếng Việt bằng UTF-8 BOM. Excel `.xlsx` chưa triển khai; PDF dùng bản in thân thiện qua trình duyệt, không giả tải file rỗng.

### 5.6 Task sắp đến hạn

Card rộng 4 cột, tối đa 5 task chưa `done`, hạn trong 7 ngày tiếp theo và task quá hạn; task quá hạn đứng trước, sau đó tăng dần theo hạn. Mỗi dòng có mã/tên task, dự án, avatar người phụ trách, deadline và badge ưu tiên. Có nhãn “Hôm nay”, “Còn 2 ngày”, “Quá hạn 1 ngày”. Click mở drawer, được đổi trạng thái khi có quyền; lưu xong cập nhật KPI/chart/list từ cùng store.

### 5.7 Thông báo và hoạt động gần đây

- Thông báo: tối đa 5 mục trong phạm vi, icon theo loại, tiêu đề, nội dung 1–2 dòng, thời gian, dấu chưa đọc. Click đánh dấu đã đọc và mở đối tượng nếu còn quyền; badge chuông cập nhật theo.
- Hoạt động: timeline tối đa 6 mục, gồm người thực hiện, hành động, đối tượng và thời gian; ví dụ giao task, hoàn thành milestone, gửi đơn, duyệt phép. Sắp xếp mới nhất trước; mutation demo thêm sự kiện mới.
- Phân biệt thông báo cần người dùng chú ý với lịch sử sự kiện; không dùng một mảng để hiển thị nguyên xi cả hai.

### 5.8 Dashboard các role còn lại

Dev thấy task của mình, dự án tham gia, trạng thái check-in và số ngày phép. Leader thấy KPI team, workload và đơn chờ cấp 1. HR thấy tổng nhân sự, attendance toàn công ty, đơn cần HR xử lý, hợp đồng sắp hết hạn. Admin thấy users hoạt động, nhóm quyền, cấu hình và audit log demo. Dùng lại component nhưng thay truy vấn, nội dung và hành động theo role.

## 6. Đặc tả các màn hình chính

Mỗi route trong sitemap phải có view hoặc tab tương ứng, tiêu đề, dữ liệu và ít nhất một tương tác phù hợp; không để trang “Coming soon”. Form tạo/sửa mở bằng modal hoặc drawer, không bắt buộc route riêng.

| Module | Nội dung và tương tác bắt buộc |
|---|---|
| My Workspace | My Tasks có List/Kanban theo Todo, In Progress, Review, Done; lọc trạng thái/ưu tiên/hạn, xem chi tiết, đổi trạng thái qua select. My Projects có card và detail. My Attendance có check-in/out demo, lịch sử, tab đi trễ/về sớm/tăng ca. My Leave có số dư phép, tạo đơn, lịch sử và hủy đơn đang chờ |
| Team Management | Chọn team được quản lý; overview, danh bạ, bảng giao task, attendance, đơn team, workload theo người, báo cáo. Leader không chuyển được sang team khác. Drawer giao task chọn người thuộc team và là thành viên dự án |
| Project Management | Danh sách grid/table, tạo/sửa dự án cho Manager/Admin; detail có Overview, Tasks, Members, Milestones, Timeline, Documents. Workload là số task chưa done/người; timeline dùng thanh CSS theo ngày, có ngày bắt đầu/kết thúc và legend |
| Human Resources | Danh sách nhân viên, hồ sơ tab Thông tin/Công việc/Tài liệu; organization, hợp đồng sắp hết hạn, cấu hình ca, attendance, điều chỉnh, overtime, quản lý phép và báo cáo. Chỉ HR/Admin sửa dữ liệu nhân sự; Manager/Leader xem hồ sơ tóm tắt theo phạm vi |
| Approval Center | Tabs theo loại yêu cầu, bộ lọc chờ duyệt/đã duyệt/từ chối; xem chi tiết, timeline duyệt, đồng ý hoặc từ chối có lý do. Dev thấy yêu cầu do mình gửi và trạng thái; không thấy nút duyệt |
| Reports & Analytics | Các tab theo sitemap và quyền; lọc kỳ/team/dự án/phòng ban phù hợp; KPI, chart, bảng chi tiết; xuất CSV và in. Dev chỉ có báo cáo cá nhân, Leader của team, Manager của các team quản lý, HR các báo cáo nhân sự |
| Documents | Danh sách tài liệu theo nhóm, tên/loại/chủ sở hữu/ngày cập nhật/phạm vi; tìm kiếm, preview hoặc tải file mẫu thực tế trong assets. Thêm tài liệu demo chỉ lưu metadata và tên file; không giả định đã upload lên server |
| Notifications | Lọc loại/đã đọc, đánh dấu một hoặc tất cả thông báo trong phạm vi đã đọc; liên kết sang đối tượng; có empty state |
| Administration | Users tạo/sửa/khóa demo; Roles/Permissions hiển thị ma trận có thể chỉnh trong demo; Audit Logs chỉ đọc; Settings lưu tên công ty/giờ ca; Master Data sửa phòng ban, chức vụ, loại phép. Không cho khóa user đang sử dụng; có xác nhận trước reset/khóa |

### 6.1 Quy tắc form và trạng thái

- Task bắt buộc tên, project, assignee, trạng thái, ưu tiên, hạn; hạn không trước ngày bắt đầu. Hiển thị lỗi ngay tại field, không chỉ toast.
- Dự án bắt buộc tên, mã duy nhất, manager, ngày bắt đầu/kết thúc và team. Task/dự án mới có ID ổn định, không dùng vị trí mảng làm ID.
- Đơn phép bắt buộc loại phép, từ ngày, đến ngày, lý do; ngày kết thúc không trước ngày bắt đầu; không trùng đơn đã duyệt; không vượt số dư đối với phép năm.
- Demo chỉ hỗ trợ nghỉ cả ngày; tính ngày làm việc thứ Hai–thứ Sáu, chưa tính lịch lễ. Đơn chờ chưa trừ phép; trừ đúng một lần khi được duyệt cuối cùng, hoàn phép khi hủy hợp lệ.
- Check-in chỉ một lần/ngày; check-out sau check-in, chỉ một lần; tính giờ hoàn chỉnh khi đủ hai mốc. Ca mẫu 08:30–17:30, nghỉ trưa 12:00–13:00; đi trễ khi sau 08:30, về sớm khi trước 17:30; giờ làm = thời gian trong ca trừ phần giao với nghỉ trưa, không âm. Tăng ca tách riêng, chỉ tính bản ghi đã duyệt.
- Chuỗi duyệt demo cho Dev: `pending_leader → pending_manager → pending_hr → approved`; từ chối tại bước nào chuyển `rejected` và lưu lý do. Yêu cầu của Leader bắt đầu tại Manager, của Manager tại HR, của HR tại Admin. Không tự duyệt đơn mình; Admin thay thế khi thiếu người duyệt và lưu lý do.
- Duyệt chỉ khả dụng với đúng người và đúng bước; vô hiệu hóa thao tác khi đang xử lý để tránh trừ phép hai lần. Đây là quy trình đề xuất cho demo, cần xác nhận nghiệp vụ trước backend.
- Form có Lưu/Hủy; toast thành công chỉ sau khi store cập nhật. Lỗi, empty, không có kết quả lọc, không đủ quyền đều có nội dung rõ ràng. Không để nút chết hoặc link `#` không có tác dụng.

## 7. Dữ liệu mock và tính nhất quán

Tất cả tên, email, tài liệu và số liệu là giả lập, không dùng dữ liệu nhân sự thật. Mốc demo cố định `2026-10-19T10:00:00+07:00` để deadline và chart không thay đổi theo ngày mở máy. Hiển thị rõ “Dữ liệu demo ngày 19/10/2026”; thao tác tạo mới dùng đồng hồ mô phỏng từ mốc này, không trộn với ngày hệ thống.

### 7.1 Bộ dữ liệu tối thiểu

- 30 users: 24 nhân viên Backend/Frontend trong phạm vi Manager mẫu (mỗi team 1 Leader + 11 Dev), 1 Manager, 1 HR, 1 Admin, 3 Dev thuộc team QA ngoài phạm vi Manager mẫu.
- 3 team; 2 phòng ban Engineering và People & Operations; danh mục chức vụ, ca và loại phép.
- 4 dự án trong phạm vi Manager và 1 dự án QA ngoài phạm vi để kiểm tra lọc quyền; mỗi dự án có thành viên, milestones và tài liệu.
- 48 task thuộc 4 dự án chính như bảng tiến độ: 36 done, 6 in_progress, 3 review, 3 todo; ít nhất 5 task sắp hạn và 2 task quá hạn trong 12 task chưa done. Dự án QA có task riêng ngoài tổng 48.
- Attendance đủ 24 nhân sự ở ngày demo với phân bố 19 đúng giờ, 2 trễ, 2 phép, 1 chưa check-in; có lịch làm việc và dữ liệu tháng 10 đến ngày demo cho báo cáo.
- Ít nhất 12 đơn đa loại, đủ mọi bước chờ, đã duyệt và từ chối; 12 thông báo, 15 hoạt động, 8 tài liệu mẫu và 6 hợp đồng, có hợp đồng sắp hết hạn.
- Có tình huống không dữ liệu, tên dài, task quá hạn, người không có avatar, route không quyền và quan hệ bản ghi không còn tồn tại.

### 7.2 Hợp đồng dữ liệu

| Entity | Trường chính |
|---|---|
| User | `id, employeeCode, name, email, role, teamId, departmentId, managedTeamIds, status, avatar` |
| Team | `id, name, leaderId, managerId, departmentId` |
| Project | `id, code, name, managerId, teamIds, memberIds, startDate, dueDate, status, health` |
| Task | `id, code, title, projectId, assigneeId, status, priority, startDate, dueDate` |
| Attendance | `id, userId, date, shiftId, checkIn, checkOut, leaveRequestId` |
| Request | `id, type, requesterId, startDate, endDate, reason, status, currentApproverId, history[]` |
| Notification | `id, recipientId, type, title, body, targetRoute, readAt, createdAt` |
| Activity | `id, actorId, action, entityType, entityId, teamId, projectId, createdAt` |
| Document | `id, name, category, ownerId, projectId, visibility, fileUrl, updatedAt` |
| Contract | `id, employeeId, type, startDate, endDate, status, documentId` |
| LeaveBalance | `userId, year, allowanceDays, usedDays` |
| Supporting data | `departments, positions, shifts, leaveTypes, milestones, rolePermissions, auditLogs` với ID và quan hệ tương ứng |

Ví dụ định dạng, không phải toàn bộ seed:

```js
const demoContext = {
  now: '2026-10-19T10:00:00+07:00',
  currentUserId: 'usr-manager-01',
  locale: 'vi-VN',
  timeZone: 'Asia/Ho_Chi_Minh'
};
const task = {
  id: 'tsk-001', code: 'ERP-001', title: 'Hoàn thiện giao diện chấm công',
  projectId: 'prj-erp', assigneeId: 'usr-dev-01',
  status: 'in_progress', priority: 'high',
  startDate: '2026-10-15', dueDate: '2026-10-20'
};
```

Dùng ISO `YYYY-MM-DD` cho ngày nghiệp vụ, ISO có offset cho thời điểm; hiển thị `dd/MM/yyyy`, giờ 24h và locale `vi-VN`. Không parse ngày thuần theo UTC rồi làm lệch ngày địa phương. Status dùng enum tiếng Anh ổn định và một bảng ánh xạ nhãn Việt, không dùng nhãn hiển thị làm khóa logic.

Seed tạo một lần có quy luật, không dùng `Math.random()` mỗi lần render. KPI, chart, bảng, badge và export đều suy ra từ cùng store sau khi lọc phạm vi. Giữ snapshot tháng/ngày tương ứng thay vì hardcode các số tổng độc lập.

## 8. Phân quyền menu, route và hành động

| Nhóm menu | Dev | Leader | Manager | HR | Admin |
|---|---|---|---|---|---|
| Dashboard / My Workspace | Cá nhân | Cá nhân | Cá nhân | Cá nhân | Cá nhân |
| Team Management | Ẩn | Team mình | Các team quản lý | Danh bạ team | Tất cả |
| Project Management | Dự án tham gia | Dự án của team | Dự án quản lý | Tổng quan, chỉ đọc | Tất cả |
| Human Resources | Ẩn | Nhân sự tóm tắt của team | Nhân sự tóm tắt thuộc phạm vi | Toàn bộ nghiệp vụ HR | Toàn bộ |
| Approval Center | Đơn mình gửi | Đơn mình + cấp 1 | Đơn mình + cấp 2 | Đơn mình + bước HR | Tất cả, xử lý thay thế |
| Reports & Analytics | Cá nhân | Team | Phạm vi quản lý | HR toàn công ty | Tất cả |
| Documents | Được chia sẻ | Được chia sẻ/team | Được chia sẻ/phạm vi | Công ty/HR | Tất cả |
| Notifications | Gửi cho mình | Gửi cho mình | Gửi cho mình | Gửi cho mình | Gửi cho mình |
| Administration | Ẩn | Ẩn | Ẩn | Ẩn | Toàn bộ |

Triển khai `can(user, permission, resource)` và các selector `getVisibleEmployees`, `getVisibleProjects`, `getVisibleTasks`. Ví dụ permission: `task.update.own`, `task.assign.team`, `project.manage`, `attendance.view.managed`, `employee.manage`, `leave.approve.level1`, `leave.approve.level2`, `leave.process.hr`, `admin.manage`.

1. Khai báo `requiredPermission` cho từng route, submenu và action; mặc định từ chối nếu thiếu cấu hình.
2. Menu cha chỉ hiện nếu có ít nhất một route con được phép; route con HR của Leader/Manager chỉ gồm hồ sơ tóm tắt.
3. Kiểm tra quyền khi render và khi chạy handler; ID ngoài phạm vi không được mở dù nhập URL trực tiếp.
4. Lọc dữ liệu trước khi tính KPI, tìm kiếm, chart, export và đếm badge. Không chỉ ẩn dòng bằng CSS.
5. Chuyển role/user phải đóng modal/drawer, xóa lựa chọn và bộ lọc vượt phạm vi, điều hướng về Dashboard; không giữ dữ liệu role trước trong view.
6. Đơn do mình gửi không được tự duyệt. Tài liệu dùng `visibility` và thành viên dự án, không dựa vào việc người dùng biết URL.
7. Chỉnh ma trận demo phải cập nhật menu/route ngay; reset trả về quyền mặc định. Admin luôn giữ quyền `admin.manage` để tránh tự khóa bản demo.

Đây chỉ là mô phỏng giao diện. Toàn bộ seed vẫn có trong trình duyệt; khi nối backend phải kiểm tra quyền và phạm vi tại server.

## 9. Design system

Phong cách: dashboard doanh nghiệp sáng, sạch, nhiều khoảng thở; sidebar trắng, nền chính xanh xám nhạt, màu nhấn xanh dương. Ưu tiên bảng dễ đọc và phân cấp rõ; không dùng nền gradient lớn hoặc hiệu ứng trang trí gây nhiễu.

### 9.1 Màu sắc và token

```css
:root {
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-primary-soft: #eff6ff;
  --color-bg: #f5f7fb;
  --color-surface: #ffffff;
  --color-text: #0f172a;
  --color-muted: #64748b;
  --color-border: #e2e8f0;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-danger: #b91c1c;
  --color-purple: #7c3aed;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --shadow-card: 0 2px 8px rgb(15 23 42 / 4%);
  --shadow-popover: 0 12px 32px rgb(15 23 42 / 14%);
  --sidebar-width: 248px;
  --topbar-height: 72px;
}
```

Badge success dùng chữ `#15803d` trên nền `#f0fdf4`; warning `#b45309` trên `#fffbeb`; danger `#b91c1c` trên `#fef2f2`; info `#1d4ed8` trên `#eff6ff`. Không truyền tải trạng thái chỉ bằng màu; luôn có nhãn/icon. Kiểm tra độ tương phản WCAG AA: chữ thường tối thiểu 4,5:1.

### 9.2 Typography, spacing và icon

- Font: Inter có hỗ trợ tiếng Việt, lưu WOFF2 cục bộ nếu có quyền phân phối; fallback `system-ui, -apple-system, 'Segoe UI', sans-serif`.
- Body 14px/1.5; tên trang 24px/32px, weight 700; tiêu đề card 16px/24px, weight 600; nhãn phụ 12px/18px; KPI 28px/36px, weight 700.
- Thang khoảng cách: 4, 8, 12, 16, 24, 32, 48px; card padding 20–24px; khoảng cách trường form 16px.
- Input/button cao 40px; hàng bảng 52px; avatar 32px; icon 18–20px. Dùng SVG cùng bộ nét, không dùng emoji thay icon nghiệp vụ.
- Border 1px; card bo 12px; transition khoảng 150ms cho hover/focus. Tôn trọng `prefers-reduced-motion`.

### 9.3 Component bắt buộc

AppShell, Sidebar, Topbar, Breadcrumb, PageHeader, FilterBar, KpiCard, ChartCard, DataTable, Pagination, Tabs, StatusBadge, Avatar/AvatarGroup, ProgressBar, TaskList, ActivityTimeline, NotificationList, SearchPopover, Modal, Drawer, ConfirmDialog, Toast và EmptyState.

Component có default/hover/active/focus/disabled; form có error/help text; bảng có loading skeleton, empty và error. Loading chỉ xuất hiện khi thực sự chờ thao tác; không thêm delay dài để tạo cảm giác đang gọi API. Toast không che nút; `aria-live` thông báo kết quả. Tránh dùng `innerHTML` với nội dung nhập từ form, dùng `textContent` hoặc escape đúng cách.

## 10. Responsive và accessibility

| Kích thước | Bố cục |
|---|---|
| ≥1280px | Sidebar đầy đủ, KPI 4 cột, dashboard theo grid 8/4 và 7/5 |
| 768–1279px | Sidebar thu gọn mặc định; KPI 2 cột; chart/table xếp toàn chiều rộng khi không đủ chỗ |
| <768px | Sidebar dạng drawer có backdrop; topbar gọn; tìm kiếm mở panel; KPI 2 cột, dưới 480px còn 1 cột; mọi card xếp một cột |

Kiểm tra tối thiểu 375, 768, 1024 và 1440px. Main dùng `min-width: 0`; không có cuộn ngang toàn trang. Bảng rộng chỉ cuộn trong container; modal có `max-height` và vùng cuộn; drawer mobile chiếm toàn màn hình khi cần. Giữ mọi hành động chính trên mobile, chỉ thu gọn nhãn hoặc đưa vào menu.

Dùng landmark `nav/header/main`, heading đúng cấp, label thật cho input; nút icon có tên truy cập, menu có trạng thái mở. Modal/drawer giữ focus, Escape đóng, đóng xong trả focus. Có skip link, focus ring rõ; vùng chạm trên mobile tối thiểu 44px. Chart có tóm tắt/bảng số liệu và không là nơi duy nhất chứa thông tin.

## 11. Kiến trúc và cấu trúc thư mục

Không dùng React/Vue, bundler hoặc CSS framework trong MVP. Dùng ES modules, CSS Grid/Flexbox và component render bằng JavaScript thuần. Chạy qua local static server; `file://` không phải môi trường nghiệm thu vì ES modules có thể bị chặn.

```text
intelex-erp/
├── index.html
├── README.md
├── intelex-erp-static-spec.md
└── assets/
    ├── css/
    │   ├── tokens.css
    │   ├── base.css
    │   ├── layout.css
    │   ├── components.css
    │   ├── dashboard.css
    │   ├── pages.css
    │   ├── responsive.css
    │   └── print.css
    ├── js/
    │   ├── app.js
    │   ├── router.js
    │   ├── store.js
    │   ├── permissions.js
    │   ├── selectors.js
    │   ├── utils.js
    │   ├── services/
    │   │   └── mock-service.js
    │   ├── data/
    │   │   ├── seed.js
    │   │   ├── users.js
    │   │   ├── projects.js
    │   │   ├── attendance.js
    │   │   └── requests.js
    │   ├── components/
    │   │   ├── sidebar.js
    │   │   ├── topbar.js
    │   │   ├── data-table.js
    │   │   ├── chart-card.js
    │   │   ├── modal.js
    │   │   └── toast.js
    │   └── pages/
    │       ├── dashboard.js
    │       ├── workspace.js
    │       ├── team.js
    │       ├── projects.js
    │       ├── human-resources.js
    │       ├── approvals.js
    │       ├── reports.js
    │       ├── documents.js
    │       ├── notifications.js
    │       └── administration.js
    ├── images/
    │   ├── logo.svg
    │   ├── avatars/
    │   └── dashboard-concept.png   (chỉ thêm khi có ảnh gốc)
    ├── icons/
    ├── fonts/
    ├── documents/
    └── vendor/                     (Chart.js nếu sử dụng)
```

Luồng: `seed → store → selector theo quyền/bộ lọc → page/component`; action qua `mock-service → store → render lại vùng liên quan`. Tách service để sau này thay bằng API mà không viết lại view. Không đọc seed trực tiếp trong từng page, không tạo mỗi role một bản HTML riêng.

Store ở memory; có thể lưu thay đổi bằng `localStorage` với key `intelex-erp-demo:v1`, phiên bản schema, xử lý JSON lỗi/quota và reset. Đây là lưu trạng thái trình duyệt, không phải database. Mọi ghi chú/cập nhật đều hiện nhãn demo. Không lưu file nhị phân, mật khẩu hoặc dữ liệu nhạy cảm. Quyền tùy chỉnh và currentUserId cũng phải được xác thực lại khi khôi phục store.

### 11.1 Quy tắc đặt tên

- File/thư mục/route/CSS class: `kebab-case`, không dấu, không khoảng trắng; ví dụ `human-resources.js`, `.kpi-card`.
- Biến/hàm: `camelCase`; hằng số cấu hình: `UPPER_SNAKE_CASE`; ID: prefix có nghĩa như `usr-`, `prj-`, `tsk-`, `req-`.
- CSS modifier dùng BEM khi cần: `.status-badge--warning`; JavaScript chọn phần tử bằng `data-action`, `data-id`, tránh phụ thuộc class trình bày.
- Hàm mô tả hành động: `renderDashboard`, `filterAttendance`, `approveRequest`; không inline `onclick`, không đặt toàn bộ logic trong `app.js`.
- Chuỗi giao diện và nhãn status tập trung để tránh mỗi trang gọi một tên; dùng “Chấm công”, “Nghỉ phép”, “Đang thực hiện” nhất quán.

## 12. Chart.js hoặc mock chart

Chọn một trong hai cách; bản demo phải chạy được khi không có Internet:

1. **Chart.js:** dùng bản UMD lưu tại `assets/vendor/`, ghi phiên bản và license trong README, tải trước module app. Đặt canvas trong container có chiều cao rõ ràng, `responsive: true`, `maintainAspectRatio: false`; thanh tiến độ dùng horizontal bar, attendance dùng doughnut. Hủy chart cũ trước khi dựng lại khi đổi route, hoặc cập nhật dataset rồi gọi `update()`. Không dùng CDN làm phụ thuộc bắt buộc.
2. **Mock chart bằng HTML/CSS/SVG:** thanh tiến độ có width theo phần trăm; doughnut dùng `conic-gradient` với góc tính từ số đếm. Giữ đúng số liệu, legend, nhãn và thao tác mở chi tiết; không dùng ảnh chụp chart để thay dữ liệu động.

Cả hai cách đều dùng selector chung với KPI/bảng, có văn bản số liệu thay thế; dữ liệu rỗng hiển thị empty state. Nếu Chart.js không tải được, tự chuyển về mock chart. Không cần animation phức tạp hoặc plugin chart bổ sung.

## 13. Phạm vi chưa làm

- Không backend, không database, không API thật và không auth thật; chuyển role chỉ là chọn user demo.
- Không bảo mật tài liệu thực tế bằng frontend; không quản lý mật khẩu/token, không gửi email/push thật.
- Không kết nối máy chấm công/GPS/sinh trắc học, không upload/storage thật, không đồng bộ đa người dùng.
- Không tính lương, thuế, bảo hiểm, kế toán, hóa đơn, kho hoặc quy trình ERP ngoài sitemap.
- Không triển khai workflow tùy biến, lịch lễ đầy đủ, nghỉ nửa ngày, tính công pháp lý hoặc tích hợp lịch ngoài.
- Không export Excel nhị phân hoặc tạo PDF bằng server; MVP chỉ có CSV và in trình duyệt.
- Không triển khai production trong công việc lập specification này.

## 14. Trình tự triển khai đề nghị

1. Tạo app shell, tokens, router, seed, store và permission selectors; mở được Dashboard Manager.
2. Hoàn thiện Dashboard với số liệu liên kết; kiểm tra tính nhất quán trước khi làm các module khác.
3. Dựng component dùng chung rồi triển khai Workspace, Team và Projects cùng các drawer/form.
4. Triển khai HR, Approval, Reports, Documents, Notifications và Administration; liên kết chéo giữa các trang.
5. Hoàn thiện chuyển role, lưu/reset demo, responsive, accessibility, CSV và bản in.
6. Kiểm tra theo tiêu chí dưới đây; README ghi cách chạy bằng local static server, dependency tùy chọn, tài khoản/role demo và hạn chế.

## 15. Tiêu chí hoàn thành và kịch bản nghiệm thu

- [ ] Mở bằng static server vào Dashboard Manager; không có lỗi console, file thiếu hoặc tài nguyên bắt buộc từ mạng ngoài.
- [ ] Tất cả route/tab ở sitemap có nội dung, điều hướng/refresh/back/forward hoạt động; 404 và 403 có đường quay về.
- [ ] Dashboard có đủ 4 KPI, 2 chart, bảng chấm công, task sắp hạn, thông báo và timeline theo đúng bố cục.
- [ ] Dữ liệu mặc định khớp: 24 người, 4 dự án, 36/48 task, attendance 19 + 2 + 2 + 1; nhân sự và dự án QA không lọt vào Manager mẫu.
- [ ] Đổi team/ngày cập nhật các widget liên quan; ngày không có ca không bị chia cho 0; xuất CSV khớp bảng sau lọc.
- [ ] Hoàn thành một task ERP Core làm tiến độ đổi từ 9/12 sang 10/12, KPI thành 37/48 và task biến mất khỏi danh sách sắp hạn.
- [ ] Dev chỉ xem task/đơn cá nhân và dự án tham gia; Leader chỉ quản lý team mình; Manager quản lý nhiều team; HR không sửa project/task; chỉ Admin thấy Administration.
- [ ] Nhập trực tiếp URL hoặc ID ngoài phạm vi không mở được nội dung; tìm kiếm, badge và export cũng theo quyền hiện tại.
- [ ] Tạo đơn phép, kiểm tra lỗi ngày/số dư, duyệt đúng chuỗi qua các user demo; từ chối phải có lý do; không tự duyệt, không trừ phép hai lần.
- [ ] Check-in/out tuân thủ thứ tự và một lần/ngày; chưa đủ hai mốc thì giờ công hiển thị `—`; ngày quá khứ tính đúng giờ nghỉ trưa.
- [ ] Filter/search/sort/pagination, modal/drawer, đánh dấu đã đọc và tải tài liệu mẫu hoạt động; không có nút chết.
- [ ] Chuyển role không giữ view/dữ liệu vượt quyền; reload khôi phục demo hợp lệ; reset có xác nhận và đưa về seed ban đầu.
- [ ] Các trạng thái rỗng, lỗi, tên dài và avatar thiếu đều đọc được; không có `undefined`, `NaN` hoặc số liệu ngẫu nhiên sau render.
- [ ] Tại 375/768/1024/1440px không chồng lấn, không cuộn ngang toàn trang; sidebar, bảng và form dùng được trên mobile.
- [ ] Điều hướng bằng bàn phím được, focus rõ; modal đóng bằng Escape và trả focus; input có label; chart có số liệu văn bản.
- [ ] Có README hướng dẫn chạy/reset, cấu trúc thư mục, dependency/license và giới hạn mô phỏng. Chụp ảnh desktop/mobile để duyệt giao diện; khi nhận ảnh concept gốc phải đối chiếu trước khi xác nhận giống ảnh.

Bàn giao triển khai gồm mã nguồn tĩnh, assets cục bộ, dữ liệu mock, README và ảnh chụp các màn hình chính. Tài liệu hiện tại là specification, chưa bao gồm website đã dựng.
