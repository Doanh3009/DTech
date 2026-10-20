# Vùng nội dung và bảng vừa khung

- Quy tắc dùng chung: `src/styles/workspace-fit.css`, nhập sau các stylesheet cũ.
- Desktop có khoảng đệm ngang 24–36px, tối đa 1720px gồm khoảng đệm. Mobile có 16px cộng safe-area trái/phải của thiết bị; đáy và màn camera tính safe-area riêng.
- Root viewport dùng `viewportFit: cover` để safe-area nhận diện phần tai thỏ và thanh home trên iPhone; không khóa pinch zoom.
- Chữ nội dung 14px, nhãn nút 14px, nút chạm tối thiểu 44px trên mobile. Ô nhập mobile giữ 16px để tránh Safari tự zoom khi nhập.
- Search dùng nhãn ngắn trên mobile, giữ nhãn truy cập để phân biệt ngữ cảnh. Search và công cụ tự chia hàng theo chỗ trống; không áp đặt chiều rộng tối thiểu gây tràn.
- `DataTable` đo chiều rộng khung chứa bằng ResizeObserver. Khi không đủ chỗ cho các cột, dùng thẻ bản ghi; thông tin phụ vẫn mở được, không cắt bỏ dữ liệu. Khung rộng dùng bảng fixed-layout, cột tên 26%, badge và nội dung dài xuống dòng.
- Bảng kiểm kê và lịch ngày nghỉ dùng cùng DataTable. Input số kiểm vẫn gọi callback và API hiện có.
- Bảng công desktop hiển thị tối đa 7 ngày mỗi nhóm, có trước/sau; tổng công vẫn tính toàn kỳ. Mobile giữ toàn kỳ trên lưới 7 cột của từng nhân viên.
- Bảng điểm danh trong công trường dùng container query để đổi sang thẻ khi cột chính hẹp.
- Tab chỉ đánh dấu một mục; ưu tiên route cụ thể nhất nếu caller đánh dấu nhiều route cha/con.
- Dashboard lấy tên từ CurrentUserProvider, bỏ panel hoạt động. Registry không còn yêu cầu tải widget recent_activity.

Ảnh và số đo của phiên kiểm tra nằm trong `test-results/ui-safe-area/`. Các phép đo gồm tràn trang, tràn bảng, mép bảng so với phần nội dung sau padding và cỡ chữ nút. Đây là dữ liệu Supabase TEST riêng.

## Đối chiếu ngày 12/10/2026

- 90 lượt hiển thị của 39 màn, 7 vai trò: không tràn ngang, bảng nằm trong phần nội dung sau padding.
- 66 test component/nghiệp vụ liên quan đạt; TypeScript, ESLint và diff check đạt.
- Tìm kiếm bằng Enter, áp dụng bộ lọc mobile, mở thông tin thêm và inspector desktop đã qua kiểm tra trên trình duyệt.
- Link HTTPS yêu cầu mật khẩu và trả trang đăng nhập đúng. Báo cáo thao tác: `test-results/ui-safe-area/interactions.json`.
- Đối chiếu CSS safe-area với top 44px, bottom 34px, hai bên 0px hoặc 20px: công thức padding đúng, không tràn ngang. Trình duyệt cài đặt không có API giả lập insets gốc, nên thay env bằng biến chỉ trong browser test; đây không phải kiểm tra trên iPhone vật lý. Báo cáo: `test-results/ui-safe-area/safe-insets.json`.
