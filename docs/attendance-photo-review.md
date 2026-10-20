# Kiểm tra ảnh chấm công theo ngày

Màn hình `/attendance/today` mở trực tiếp khung ảnh vào/ra của nhân viên. Hàng đợi ưu tiên nhân viên có ảnh và dấu hiệu bất thường; nhóm chưa có ảnh tách riêng để không chặn việc xem ảnh đã đồng bộ.

## Thao tác

- Chọn ngày bằng ô ngày hoặc nút ngày trước/sau.
- Xem ảnh vào/ra cạnh nhau; nhấn ảnh để phóng to. Nhiều lượt cùng loại có nút chọn từng giờ.
- `←` / `→`: chuyển nhân viên. `Enter`: đã xem và chuyển tiếp. `F`: đánh dấu và chuyển tiếp. Phím tắt không can thiệp khi nhập liệu, dùng bộ lọc hoặc mở hộp phóng to; Enter trên nút/link vẫn thực hiện hành động của nút/link đó.
- “Đã xem và tiếp” chỉ mở khi tài khoản có quyền xem ảnh, toàn bộ ảnh đã đồng bộ của người đó đã tải thành công trong khung chính hoặc hộp phóng to, và không còn ảnh đang chờ đồng bộ. Ảnh thiếu/lỗi không được xem là đã đọc.
- “Đánh dấu” lưu riêng người cần xem lại. “Hoàn tác” hủy thao tác gần nhất.
- Hàng đợi dựng tối đa 40 nhân viên mỗi lần, chỉ dùng thumbnail tải chậm theo vùng nhìn. Ảnh lớn chỉ tải cho nhân viên đang xem và tối đa hai ảnh của nhân viên kế tiếp.

## Tiến độ cá nhân

Tiến độ lưu trong localStorage theo tài khoản và ngày, gồm ID nhân viên, dấu vân tay bằng chứng và trạng thái đã xem/đánh dấu. Không lưu tên, GPS hoặc nội dung ảnh. UI ghi “Trên thiết bị này”; nếu browser chặn lưu trữ hoặc không có tài khoản thì dùng bộ nhớ và ghi “Trong phiên này”.

Đây là tiến độ xem ảnh cá nhân, không phải phê duyệt hay điều chỉnh công. Các thao tác không cập nhật `attendance_status`, không ghi quyết định nghiệp vụ vào DB và không đồng bộ giữa thiết bị. Điều chỉnh công vẫn dùng quy trình hiện có trong nhật ký công.

Thay đổi tập lượt chấm, ảnh, giờ, trạng thái công/ảnh/GPS/đồng bộ hoặc dấu hiệu bất thường sẽ mở lại lượt kiểm tra. Hai tab cùng browser cập nhật tiến độ bằng sự kiện storage. API ảnh tiếp tục kiểm tra quyền và thời hạn bằng chứng; không thêm cache chung cho URL ảnh riêng tư.

## Dữ liệu mẫu

`/ui-preview/attendance/photos` chỉ mở ở development, dùng nhân viên giả và ảnh SVG minh họa có dấu “ẢNH MẪU”. Không gọi API công, không ghi DB. Có cặp ảnh đủ, đi muộn/GPS, ảnh chưa đồng bộ, nhiều lượt vào và người nghỉ.

## Kết quả kiểm tra 05/10/2026

- TypeScript và ESLint các tệp thay đổi đạt.
- 13 kiểm thử workstation đạt: quyền ảnh, ngày cũ, tải lỗi/thử lại, ảnh trùng, tải xong trước khi đánh dấu, chuyển tiếp, hoàn tác, bằng chứng thay đổi, phím tắt, giới hạn hàng đợi và hủy request.
- Browser tại 1920×1080, 1440×900, 768×1024 và 390×844 đạt: không tràn ngang, ảnh giữ nguyên nội dung trong khung, đánh dấu/xem tiếp/hoàn tác/phóng to, tiến độ sau reload và tách ngày. Không có lỗi runtime.
- Ảnh và báo cáo: `docs/ui-evidence/attendance-photo-workspace/`. Chạy lại bằng `node scripts/attendance-photo-preview.mjs`; dùng mẫu SVG, không đo thời gian tải ảnh storage thật hoặc mạng production.
