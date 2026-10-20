# Rà soát phiếu lương — 16/10/2026

## Giao diện và thao tác

- Mặc định chọn tháng gần nhất không vượt tháng hiện tại, tránh đẩy các kỳ thử nghiệm nhiều năm sau lên đầu.
- Mỗi nhân viên và tháng chỉ hiện một phiếu hiệu lực. Phiếu đang phát hành được ưu tiên; nếu không còn phiếu phát hành thì hiện phiên bản mới nhất với trạng thái thực tế.
- Các phiên bản cũ vẫn nằm trong lịch sử của đúng nhân viên và tháng, có ngày phát hành, xem, xác nhận, thu hồi, lý do và liên kết mở từng bản.
- Theo dõi ba nhóm tách biệt: chưa xem; đã xem và chờ xác nhận; đã xác nhận. Các số tổng không cộng lại phiếu đã thu hồi hoặc phiên bản cũ.
- Bộ lọc tháng, tìm nhân viên, theo dõi và phân trang 20 phiếu. Liên kết từ dashboard nhận `month=YYYY-MM` và `receipt=unseen|pending|confirmed`.
- Khi mở chi tiết rồi trở lại, tháng và bộ lọc tiếp nhận được giữ qua liên kết. `scope=self` được giữ cho giao diện cá nhân trong tuyến kế toán.
- Chi tiết gồm thực nhận, tổng thu nhập, khấu trừ, từng khoản thu nhập và trạng thái tiếp nhận. Phép dư và căn cứ tính lương mở theo nhu cầu từ snapshot đã phát hành.
- Nhãn “Lương theo công” phản ánh đúng khoản lương đã tính tỷ lệ công. Không gán phiếu phát hành thành trạng thái đã chuyển tiền.
- Trên điện thoại, xác nhận và tải PDF đặt ngay dưới thực nhận. Tên dài và mã nhân viên tách dòng; trạng thái không ép hẹp tên.
- Thu hồi có chống bấm lặp, timeout, lý do 3–500 ký tự, giữ nội dung khi lỗi; khi đã thu hồi thành công, lỗi tải lại danh sách không làm mất kết quả cập nhật tại chỗ.

## Dữ liệu và quyền

Không sửa API, công thức tính, dữ liệu đã phát hành, quyền sở hữu hoặc cơ chế PDF. Giao diện cá nhân tiếp tục gọi `scope=self`; backend chỉ trả phiếu đang phát hành của đúng nhân viên. Lịch sử đầy đủ chỉ xuất hiện khi API đã cấp dữ liệu đó cho người xem.

## Kiểm chứng

- 26/26 kiểm thử tại `payslipPresentation.test.ts`, `PayslipConsole.test.tsx`, `PayslipDetail.test.tsx`.
- ESLint các nguồn, trang và kiểm thử liên quan đạt.
- 28 trạng thái trình duyệt với component thật và dữ liệu cô lập tại 320, 390, 768, 1440 px: danh sách kế toán, lịch sử, chi tiết, căn cứ mở, danh sách cá nhân, chi tiết cá nhân, xác nhận.
- Không có tràn ngang, hộp thoại ra ngoài viewport, nút bị cắt, lỗi runtime hoặc yêu cầu ghi nghiệp vụ thật trong các trạng thái trên.
- Đã xem ảnh thủ công và sửa lỗi CSS toàn cục làm tên và mã nhân viên bị đặt cạnh nhau trên điện thoại.
- Báo cáo: `docs/ui-evidence/accounting-completion-20261016/payslips-local/report.json`.
- Xác nhận trong fixture là phản hồi giả lập trong trình duyệt; kiểm thử không xác nhận hoặc thu hồi phiếu thật trên cơ sở dữ liệu.

Trang fixture chỉ dùng phát triển đã được gỡ trước khi triển khai. Kiểm chứng TEST sau triển khai do báo cáo tích hợp ghi nhận riêng.
