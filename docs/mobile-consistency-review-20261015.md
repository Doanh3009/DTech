# Rà soát giao diện điện thoại — 15/10/2026

## Phần đã sửa

| Vị trí | Nguyên nhân | Thay đổi |
| --- | --- | --- |
| Gói công trường | Media query đặt khung ngoài về góc vuông; header và body có nền riêng | Khôi phục viền và góc khung 18 px; bo header trên và body dưới, giữ cách cuộn và thanh điều hướng |
| Lịch công cá nhân | Chỉ ngày có dữ liệu có chấm trạng thái nên chiều cao nội dung khác nhau | Mọi ô đều có hai hàng cố định dành cho ngày và trạng thái; hàng chấm của ngày trống được ẩn |
| Đơn nghỉ phép | Ngày và buổi dùng tỉ lệ cột, nhãn và chiều cao khác nhau | Hai ngày cùng hàng, rộng bằng nhau; input/select cao 48 px; nhãn và khoảng cách thống nhất |
| Đơn nghỉ một ngày | Hai ô buổi trong đó một ô luôn bị khóa | Một ô “Buổi nghỉ”; đơn nhiều ngày hiện buổi bắt đầu/kết thúc; loại nghỉ cả ngày không hiện ô buổi |
| Tên gói trên điện thoại | Giới hạn một dòng khiến tên bị cắt sớm | Cho phép tối đa hai dòng |
| Bộ góc bo | Token nền, token cuối CSS và token điện thoại định nghĩa riêng | Dùng nguồn token chung: ô điều khiển 12 px, thẻ 18 px, cửa sổ 22 px; áp dụng vào các vùng nghỉ phép và gói đã rà soát |

## Kiểm tra

- 18 test thuộc ba file form/danh sách/chi tiết nghỉ phép đạt; trong đó có bốn ca mới cho hiển thị ngày và buổi.
- ESLint của form và test mới đạt; 10 stylesheet đã sửa được PostCSS phân tích thành công.
- 24 ảnh với component thật và dữ liệu giả bị chặn tại trình duyệt: các chiều rộng 320, 390, 768 và 1440 px.
- Không có tràn ngang, lỗi JavaScript hoặc yêu cầu ghi dữ liệu nghiệp vụ. Input ngày cao 48 px, hai cột rộng bằng nhau khi cùng hàng. Số ngày có/không có chấm nằm cùng vị trí trong ô.
- Báo cáo và ảnh: `docs/ui-evidence/mobile-consistency-20261015/`.

## Giới hạn

Đây là kiểm tra giao diện Chromium với API giả tại máy, không thay thế kiểm tra trên điện thoại thật, phân quyền máy chủ hoặc toàn bộ luồng công trường có dữ liệu thật. Trang fixture và tham chiếu kiểu sinh riêng đã được gỡ sau kiểm tra. Không có mô tả chức năng mới được thêm vào giao diện sản phẩm.

## Kiểm tra trên bản TEST sau triển khai

- Bản cuối: `dpl_8gCwv5ALi82pqsRSKBuHUUekBwhk` tại `ct-noi-bo-test-chau-tuan.vercel.app`, dự án dữ liệu TEST `lgmlkagcytfjazulgfbz`.
- 40 trạng thái giao diện với ba tài khoản test: Quản trị viên, Kỹ sư và Nhân viên. Kiểm tra các màn gói công trường, điểm danh, chỉnh sửa/chốt ngày chỉ mở cửa sổ, đơn nghỉ và lịch công.
- Không phát hiện tràn ngang, chữ bị cắt trong nút, tiêu đề gói bị buộc một dòng hoặc lỗi JavaScript. Không gửi thao tác nghiệp vụ; bốn yêu cầu tra địa chỉ được cho phép. Cả ba phiên đăng nhập/đăng xuất trả 200.
- 34 phản hồi 404 đều là ảnh đại diện chưa có và có giao diện thay thế; không có lỗi API nghiệp vụ.
- Lần rà soát trước phát hiện nhãn “Hôm nay”, “Điểm danh công nhân” bị cắt và tiêu đề gói bị ép một dòng. Đã sửa nhãn điểm danh gọn trên điện thoại, giữ tên truy cập đầy đủ; tiêu đề được phép hai dòng. Bốn màn kiểm tra bổ sung ở 320/390/430/1440 px đạt trước lần triển khai cuối.
- Giữ báo cáo trước tại `docs/ui-evidence/usability-files-20261015/report-firstpass.json`; báo cáo cuối tại `report-final.json`. Ảnh cuối mang tiền tố `final-`.

Kiểm tra trực tiếp chỉ đọc dữ liệu TEST, không xác nhận việc gửi phiếu, chốt công, lưu điểm danh hoặc tính phép bằng giao dịch thật.
