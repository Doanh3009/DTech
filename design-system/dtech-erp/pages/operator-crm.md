# Trung tâm triển khai — Team setup

Portal nội bộ độc lập tại `/control-center`, cờ máy chủ và RBAC riêng. Không xuất hiện trong module khách hàng hoặc menu nghiệp vụ ERP.

- Header: thương hiệu từ provider, nhãn “Trung tâm triển khai”, người dùng, đăng xuất.
- Sidebar: Khách hàng & triển khai / Đăng ký dùng thử. Điện thoại chuyển thành hai mục điều hướng trên nội dung.
- Danh sách: PageHeader trái, CTA phải, tìm kiếm/lọc, DataTable và phân trang server. Trạng thái luôn có nhãn.
- Hồ sơ: định danh/phiên bản → bốn mục Hồ sơ & khảo sát / Cấu hình ERP / Môi trường & bàn giao / Chăm sóc & lịch sử.
- FormSection dùng nhãn ngắn, không có mô tả dưới từng chức năng. Module là checkbox có nhãn; capability chưa có được ghi riêng ngoài phạm vi.
- Trường, bảng, Select/Drawer/Button/StatusBadge theo DNA chung. Bề mặt trắng, nền workspace trung tính, màu thương hiệu lấy từ cấu hình; không dùng gradient trang trí.
- Checklist biểu thị xác nhận thực hiện của operator. Thay target/module/config sẽ bỏ xác nhận cũ; lưu trước khi xác nhận lại.
- Khóa form khi lỗi không xác định/conflict; focus thông báo lỗi và có nút tải lại. Không đổi sang trạng thái đã lưu từ optimistic update.
- Thanh lưu theo luồng form, không che nội dung. Một cột ở 390px; kiểm tra tiếp ở 768/1440px. Không lưu data khách vào browser storage.
- Mọi fixture demo/QA bị chặn trước network, không ghi khách giả lên database thực.
