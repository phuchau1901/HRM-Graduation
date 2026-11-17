# Cấu trúc trang theo menu

- `dashboard/`: Tổng quan.
- `my-workspace/`: Nghỉ phép cá nhân và số dư phép từ API.
- `human-resources/`: Nhân viên, cơ cấu tổ chức, hợp đồng.
- `approval-center/`: Nghỉ phép, tăng ca, điều chỉnh công và phê duyệt.
- `notifications/`: Hộp thư thông báo và popup chi tiết.
- `reports/`: Báo cáo chấm công và xuất báo cáo.
- `administration/`: Tài khoản, role và nhật ký hệ thống.
  - `master-data/`: Các danh mục dùng chung.
  - `system-settings/`: Chính sách mật khẩu, chấm công và quy trình phê duyệt.
- `shared/`: Các bộ render đang được dùng bởi nhiều nhóm menu, gồm Workspace, Team, Project, Documents và các trang vận hành.

Các trang dùng chung tiếp tục được nhập từ `shared/`; không sao chép chúng vào từng nhóm. Khi thêm hoặc di chuyển module, cập nhật import và danh sách module trong `scripts/build-browser.js`, sau đó chạy `npm run build` và `npm test`. File trong `assets/js/dist/` được sinh tự động.
