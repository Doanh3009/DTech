# File xuất và thao tác chấm công — 15/10/2026

## File PDF và Excel

- Đã tái hiện PDF phiếu lương người dùng gửi bị hỏng chữ bằng MuPDF: font khai báo TrueType nhưng chứa WOFF2, đồng thời chỉ là tập ký tự web không đủ chữ số và tiếng Việt.
- Hai trình tạo phiếu lương/đơn nghỉ dùng IBM Plex Sans TTF đầy đủ, đóng gói cùng server theo giấy phép OFL. Nội dung dài được xuống dòng; phiếu dài được chia trang.
- Tải phiếu lương đọc snapshot đã phát hành và tạo PDF mới, bỏ qua bản PDF lưu cũ bị lỗi. Giữ kiểm tra quyền; lượt tải không sửa phiếu hoặc tạo tài sản lưu trữ mới.
- Thành phần tải dùng chung kiểm tra HTTP, MIME và chữ ký PDF/XLSX, nhận tên file từ server và báo lỗi ngay tại nút. Đã nối vào lương, phép, báo cáo, bảng công và công trường.
- Chuẩn hóa tên sheet người dùng nhập, tránh ký tự cấm, tên trùng sau cắt và dấu nháy ở đầu/cuối. Sửa mã màu header Excel công nhân thành ARGB đủ tám ký tự.
- Các mẫu Excel được chọn trước sửa vẫn mở được trong Microsoft Excel. Chưa có file Excel lỗi cụ thể từ người dùng để đối chiếu; không kết luận mọi lỗi mẫu đều có cùng nguyên nhân với PDF.

## Điểm danh công nhân

- Danh sách giữ thứ tự khi chọn trạng thái và sau lưu, không đẩy người vừa thao tác xuống dưới.
- Thanh công cụ điểm danh trên điện thoại được hiện lại. Có lưu điểm danh, tiếp tục bản nháp và duyệt trước khi gửi.
- Chốt công cuối ngày chỉ xuất hiện sau khi gửi điểm danh đầu ngày, dùng ghi nhận biến động cuối ngày. Điều chỉnh có lý do/kiểm toán vẫn theo quyền hiện hành.
- Drawer điều chỉnh giữ dữ liệu khi server trả lỗi; thao tác chuyển bước chờ lưu nháp hoàn tất.

## Địa chỉ

- Photon tra địa chỉ phía server, không yêu cầu khóa API. Giới hạn truy vấn dùng lease chung trong PostgreSQL, cache dùng chung và chỉ tra những dòng đang hiển thị.
- Địa chỉ công trường lưu sẵn chỉ được xác nhận khi GPS nằm trong bán kính cấu hình. Kết quả bản đồ cách GPS quá 250 m bị từ chối.
- UI giữ độ chính xác GPS, liên kết bản đồ, nguồn địa chỉ và nhãn gần vị trí GPS. Dữ liệu bản đồ/thiết bị có thể thiếu số nhà hoặc sai số; không hứa địa chỉ chính xác tuyệt đối.
- Lỗi tra cứu không chặn ghi nhận chấm công. Không gửi ảnh, tên nhân viên hoặc mã tài khoản sang nhà cung cấp bản đồ.
- Migration `202610150001_attendance_address_cache.sql` áp dụng riêng TEST, từ 49 lên 50 migration. Hai mươi kiểm tra PostgreSQL chạy trong transaction rollback trước khi áp dụng. Không seed/reset hoặc thay dữ liệu nhân viên.

## Giao diện

- Dùng chung bo góc control 12 px, card 18 px, panel 22 px.
- Sửa các rule mobile từng ép góc gói công trường về 0; giữ cuộn và phần sticky.
- Ngày trong lịch công luôn giữ cùng khoảng dành cho dấu trạng thái, kể cả ngày không có dấu.
- Đơn phép có hai ô ngày đều nhau, chiều cao điều khiển thống nhất; chọn một buổi cho đơn cùng ngày, đầu/cuối cho đơn nhiều ngày.
- Đã kiểm tra 24 trạng thái fixture ở 320/390/768/1440 px. Không thêm mô tả chức năng vào UI.

## Bằng chứng kiểm tra

- Vitest: **867 đạt, 0 lỗi, 37 bài kiểm tra live opt-in không bật** (904 bài tổng). TypeScript và ESLint phần thay đổi đều đạt.
- PostgreSQL: 20 kiểm tra bộ nhớ đệm/rate limit/lease chạy rollback và đạt; TEST đã có 50 migration.
- Kiểm tra PDF bằng trình đọc độc lập MuPDF, không chỉ kiểm tra magic bytes.
- Kiểm tra XLSX bằng Microsoft Excel desktop, mở read-only và đóng không lưu.
- Chi tiết: [địa chỉ](attendance-address-resolution-20261015.md), [điểm danh](worker-attendance-flow-review-20261015.md), [mobile](mobile-consistency-review-20261015.md).
- Biên nhận triển khai và kiểm tra live được ghi tại `operations/usability-files-deployment-20261015.json` sau khi hoàn tất.


## Kết quả trên TEST

- Deployment READY: `dpl_8gCwv5ALi82pqsRSKBuHUUekBwhk`; alias https://ct-noi-bo-test-chau-tuan.vercel.app.
- 867 test đạt; 37 live test opt-in không bật.
- 24 kiểm tra alias/health/API và 7 kiểm tra địa chỉ đạt.
- Tải 9 tệp thực tế: 6 XLSX mở trong Microsoft Excel, 3 PDF render/chữ tiếng Việt/font hợp lệ trong MuPDF. Hai nút tải PDF/Excel được bấm trên giao diện thật.
- 40 trạng thái live và 6 tương tác quan sát; không có lỗi JavaScript hoặc lỗi bố cục được bộ kiểm tra ghi nhận. Các nhãn nút công trường từng bị cắt được kiểm tra lại sau sửa.
- Không ghi nghiệp vụ nghỉ phép/lương/điểm danh khi kiểm tra live. Production giữ nguyên.
