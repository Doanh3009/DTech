# Thanh công cụ gọn — 19/10/2026

- Dùng bố cục tham chiếu: điều hướng / Trang chủ bên trái, tìm kiếm và nhóm tài khoản bên phải, trên một hàng.
- Desktop giữ chiều cao 56px, chữ nhãn 13px, icon 18px, avatar 28px. Bỏ độ rộng thừa của wrapper tìm kiếm (360px trong khi nút chỉ 250px); thống nhất ở 220px.
- Nút Kiểm thử chuyển từ main lên thanh công cụ. Bộ chọn tài khoản mở trong popup neo vào nút trên desktop, drawer trên điện thoại; không đẩy tiêu đề trang xuống một hàng trống.
- Menu kiểm thử dùng popup riêng để thao tác form không bị đóng giữa chừng. Điều khiển bàn phím/focus và đóng bằng Escape theo FloatingPanel/Drawer chung.
- Độ rộng 768–1199px thu tìm kiếm về icon và ẩn nhãn phụ. Điện thoại giữ thanh 60px cộng safe area, vùng bấm tối thiểu 44px, tên trang co giãn.
- Khoảng từ thanh công cụ xuống nội dung desktop là 16px. Không đổi cỡ chữ tiêu đề/nội dung của từng tính năng.
- Giữ bảng màu và nền hiện tại; thay đổi chỉ bố cục/kích thước/typography. Nút điều hướng dùng lại cách lưu trạng thái sidebar hiện có. Không thay đổi nghiệp vụ/quyền/database.

Kiểm tra kỹ thuật: TypeScript và ESLint; build trước triển khai. Không thêm/chạy test tự động hoặc browser trong lượt sửa.
