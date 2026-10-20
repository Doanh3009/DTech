# Chi tiết BHXH và danh sách bảng công — 16/10/2026

## BHXH

- Bấm tên hoặc **Xem chi tiết** mở hồ sơ từng người. Hiển thị tình trạng tham gia, mã BHXH, các khoản BHXH/BHYT/BHTN, mức lương và tỷ lệ hiện tại.
- Kỳ đóng gần nhất và quá trình đóng theo tháng được lưu riêng với lịch sử sửa hồ sơ. Có tình trạng, mức lương đóng, tỷ lệ, tạm tính, tiền thực đóng và ngày đóng.
- Người có `insurance.edit` ghi nhận hoặc sửa một kỳ đóng. Form giữ dữ liệu khi lỗi; cập nhật kiểm tra phiên bản và ghi audit trong cùng giao dịch. Không sửa lùi kỳ mới nhất khi cập nhật tháng cũ.
- `insurance.view` đọc sổ kỳ đóng; `insurance.history.view` tiếp tục kiểm soát lịch sử biến động hồ sơ, `insurance.document.view` kiểm soát tài liệu. Không thay đổi quyền các vai trò.
- Không có tháng thì hiển thị **Chưa ghi nhận kỳ đóng**. Không tạo tháng thiếu, suy ra nợ, dùng tạm tính làm tiền đã nộp hoặc tự đặt tỷ lệ theo luật.
- Hồ sơ cũ và lịch sử được giữ nguyên. Chỉ chuyển những tháng được ghi rõ sang sổ tháng; bỏ các lịch sử trùng thời gian có giá trị mâu thuẫn, không chọn ngẫu nhiên trạng thái đã/chưa đóng.

## Bảng công

- Mặc định là danh sách từng nhân viên với ngày công, ngày đi trễ, phép, không lương, vắng và trạng thái.
- Dùng số tổng hợp đã lưu của kỳ công. Giữ tìm kiếm, phòng ban, lọc cần rà soát, phân trang và cập nhật theo dữ liệu mới.
- Bấm nhân viên mới mở lịch riêng. Bấm ngày xem ca, vào/ra, công, trễ, nghỉ, nguồn và điều chỉnh.
- Ngày thiếu dữ liệu hiện **Chưa có dữ liệu**, không tự coi là vắng. Quay lại danh sách giữ đúng kỳ đã chọn.

## Dữ liệu TEST đã đối chiếu

- Trước sửa: năm hồ sơ BHXH, năm sự kiện thay đổi, không có tháng đóng được ghi nhận.
- Kỳ công 09/2026: 52 dòng tổng hợp, tám người có ngày trễ; chỉ một bản ghi chi tiết ngày. Không được tính lại các số tổng đó bằng lịch ngày đang thiếu.
- Sau migration TEST: 51 migration; năm hồ sơ và năm sự kiện cũ giữ nguyên. Không tạo kỳ đóng giả hoặc seed/reset dữ liệu.

## Kiểm tra

- 30 kiểm tra PostgreSQL trong transaction rollback đạt trước khi áp dụng migration.
- Kiểm tra giao diện bằng component thật, API giả chặn tại trình duyệt: 32 trạng thái ở 320/390/768/1440 px, không ghi nghiệp vụ.
- Đã sửa các lỗi phát hiện bằng ảnh: chọn kỳ và tên nhân viên bị bóp trên mobile, nút cập nhật lịch nhỏ, khung kỳ đóng bị co mất nội dung.
- Chi tiết triển khai và kiểm tra live được lưu tại `operations/insurance-timesheet-deployment-20261016.json` sau khi hoàn tất.

Tài liệu: [dữ liệu BHXH](insurance-monthly-data-review-20261016.md), [giao diện BHXH](insurance-person-details-review-20261016.md), [bảng công](timesheet-list-review-20261016.md).


## Kết quả triển khai

- READY `dpl_A9T58R3ReyHr7iBT41yruSCYhfAn`, https://ct-noi-bo-test-chau-tuan.vercel.app; TEST 51 migration, production giữ nguyên.
- 924 test đạt, không lỗi; 37 live test opt-in không bật.
- 24 kiểm tra alias/health/API và 14 kiểm tra API chức năng đạt.
- 32 trạng thái fixture và 36 trạng thái live đạt; không lỗi bố cục/JavaScript/API ngoài phản hồi avatar trống dự kiến.
- Đã bấm tên và Xem chi tiết BHXH, đổi người, xem lịch sử, mở form kỳ đóng; chưa gửi thay đổi. Đã tìm/lật trang bảng công, mở lịch/ngày thật và quay lại đúng kỳ.
