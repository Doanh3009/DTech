# Rà soát giao diện ngày 13/10/2026

## Đăng nhập và nhận diện

- Bỏ slogan và artwork xuyên qua logo. Dùng đầy đủ logo Châu Tuấn chính thức, đúng tỷ lệ và căn giữa.
- Panel nhận diện dùng nền sáng kem và bạc hà. Nền ngoài có sáu minh họa công trình nét mảnh theo phối cảnh 3D, chuyển động bằng CSS.
- Khung nhận diện và form có nền riêng; lớp trang trí không nhận tương tác. Chế độ giảm chuyển động dừng animation.
- Ảnh đã kiểm tra: [desktop](ui-evidence/interface-finish-20261013/login-desktop.png), [điện thoại](ui-evidence/interface-finish-20261013/login-mobile.png).

## Các vùng giao diện đã chỉnh

- Shared UI: inset và cuộn cửa sổ, tiêu đề dài, nút đóng, focus, menu bỏ qua lựa chọn disabled, nhãn Switch, vùng bảng cuộn bằng bàn phím.
- Điều hướng: logo compact rõ, tên mục và ứng dụng dài xuống dòng, touch target, safe area.
- Lương/BHXH: tìm kiếm và lọc, trình bày tiền, modal thu hồi phiếu, form responsive, lỗi trong cửa sổ và nút Hủy. Tiền thực nhận trên mobile giữ nguyên một dòng.
- Bảng công: bố cục tháng/tuần, chú giải, cửa sổ ngày công. Lưới chi tiết giữ đủ mười chỉ số và cuộn ở màn hình nhỏ.
- Nhân sự/hợp đồng: menu lưu trữ giữ dialog mở, form hợp đồng/file history, cảnh báo không chồng nhau, footer form vào luồng để không che field.
- Kho: nhãn kiểm kê và trạng thái tiếng Việt, số chứng từ trên mobile, toolbar và dòng hàng, bỏ link lồng button, actionbar mobile không phủ dữ liệu.
- Công trình/dashboard: layout theo chiều rộng vùng nội dung, nhãn dài, tooltip, bảng số liệu, nhãn biểu đồ và tổng donut.

## Kiểm tra

- Login: 320, 390, 768, 1440 và 1920px, với cả motion thường và reduced motion; logo đầy đủ, icon chuyển động đúng, không tràn ngang.
- Component nghiệp vụ thật: dữ liệu fixture và GET API mocks tại 320, 390, 768 và 1440px. Rà bảng, form, menu, mở/đóng và cuộn popup; scripts chặn request ghi dữ liệu.
- HR/kho: 32 tổ hợp component/viewport; công trình/dashboard và shell cũng đã kiểm tra trực tiếp bằng fixture.
- Golden preview: bốn màn, bảy trạng thái tại 320, 390 và 1440px.
- Vitest: 127 file đạt, 1 file bỏ qua; 708 test đạt, 37 test bỏ qua theo cấu hình.
- TypeScript, ESLint và production build đều đạt. Build vẫn có log `system_settings.read_failed` của môi trường và hoàn tất với exit code 0.
- Các route fixture tạm đã được xóa sau kiểm tra. Evidence chi tiết của lượt audit được giữ trong `.tmp/` ở workspace.

Phạm vi kiểm tra trình duyệt nghiệp vụ là UI với dữ liệu mẫu, không phải kiểm tra giao dịch trên cơ sở dữ liệu thật.
