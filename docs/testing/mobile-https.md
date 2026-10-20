# HTTPS trên điện thoại

Safari/Chrome chặn camera và geolocation trên HTTP qua địa chỉ LAN. `localhost` trên điện thoại là chính điện thoại; không thể thay IP máy tính bằng localhost. Trang HTTPS phải có chứng chỉ được điện thoại tin cậy.

## Link tạm thời có mật khẩu

1. Giữ server `npm run dev:test` hoạt động.
2. `npm run mobile:https:prepare` tải bản cloudflared chính thức có kiểm tra SHA-256 và tạo mật khẩu riêng. Bước này không mở tunnel.
3. Khi được phép chia sẻ nội dung và dữ liệu TEST qua Cloudflare, chạy `npm run mobile:https`.
4. Mở URL được in trong terminal trên Safari/Chrome. Đăng nhập lớp bảo vệ bằng thông tin trong `test-results/mobile-https/access.private.json`, rồi đăng nhập tài khoản ứng dụng TEST.
5. Cho phép Camera và Vị trí chính xác. Chạy chấm công trong tab chính, tránh trình duyệt nhúng trong ứng dụng chat.
6. Ctrl+C để đóng link. Hostname thay đổi khi khởi động lại. Mật khẩu không đưa vào URL, mã client hoặc Git.

Gateway chỉ lắng nghe `127.0.0.1:3344`, xác thực mọi tài nguyên/API/WebSocket trước khi chuyển tiếp vào server local. Origin bên ngoài phải khớp hostname tunnel trước khi đổi Host/Origin nội bộ để Next dev và CSRF hoạt động. Script chỉ cho dùng database TEST đã có marker; không chạy seed/reset.

Cloudflare xử lý lưu lượng website TEST, bao gồm phiên đăng nhập, dữ liệu nghiệp vụ trên màn hình và ảnh/GPS khi thử chấm công. Cần được chủ workspace cho phép trước khi mở tunnel. Tuyệt đối không trỏ gateway vào môi trường production. Không dùng link tạm thời làm triển khai production.

Nếu không được phép dùng tunnel, dùng HTTPS nội bộ với chứng chỉ CA đã cài và bật tin cậy trên điện thoại. Bấm bỏ qua cảnh báo chứng chỉ không đảm bảo `isSecureContext` cho camera/GPS.

## Camera/GPS

- HTTP được hiển thị thành lỗi HTTPS, không báo thiết bị thiếu camera.
- Camera báo riêng lỗi chưa cấp quyền, đang bị ứng dụng khác sử dụng và không hỗ trợ API. Retry giữ thao tác trên trang.
- Đổi camera/đóng trang hủy yêu cầu cũ và dừng các track trả về muộn.
- GPS dùng `maximumAge: 0`; khi mẫu đầu chưa chính xác, theo dõi tối đa 6 giây để chọn mẫu thật có sai số thấp nhất. Quyền bị thu hồi hoặc đóng màn hình hủy kết quả.
- Sai số thấp/độ chính xác kém được hiển thị theo tọa độ thật. Không thay GPS bằng tọa độ văn phòng, không đổi chính sách chấm công.

Nguồn: [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia), [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
