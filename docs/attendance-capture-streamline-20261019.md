# Tinh gọn chấm công cá nhân — 19/10/2026

## Luồng sử dụng

- Cá nhân → Chấm vào / Chấm ra mở camera tại chỗ, dùng trạng thái đã tải; không phát sinh điều hướng mạng để mở camera.
- Nút chụp đồng thời ghi nhận lượt công. Chỉ hiện màn lưu lại ảnh nếu bộ nhớ thiết bị không lưu được.
- `/attendance/quick` mở camera trực tiếp, không chuyển qua màn tổng quan thứ hai.
- Bỏ mốc tham chiếu chưa xác thực khỏi địa chỉ và khỏi màn cá nhân. Công trường có địa chỉ được máy chủ xác thực vẫn giữ tên công trường.
- Kết quả dùng giờ chụp cố định, hiện thành công sau khi đồng bộ ảnh và bản ghi; trước đó hiện đã lưu trên thiết bị / chờ đồng bộ. Cảnh báo đi trễ tính theo giờ chụp và ngưỡng ca.
- Trong ca, chỉ có chấm vào được hiển thị Đã chấm vào hoặc Đi muộn. Thiếu lượt ra chỉ được xác định sau giờ kết thúc ca; dữ liệu đối soát Nhân sự được giữ.

## GPS và mạng

- Khởi động watch GPS chính xác cao ngay, song song với định vị mạng; lỗi định vị mạng không hủy bộ thu GPS. Không phụ thuộc trạng thái Wi-Fi.
- Chỉ nhận tọa độ thật, mới trong 15 giây, kèm sai số và thời điểm định vị. Bỏ tọa độ cũ quá 60 giây so với lúc chụp; không thay bằng tọa độ văn phòng/công trường.
- Lưu được tọa độ tạm thời trong khi tiếp tục cải thiện độ chính xác. Khi chụp cho phép chờ thêm tối đa 6 giây nếu sai số còn lớn hoặc 10 giây nếu chưa có tọa độ. Hủy watch / timeout khi đóng camera.
- Khi GPS không trả tọa độ: vẫn ghi ảnh và thời gian. Chính sách GPS bật sẽ gắn gps_unavailable + needs_review để Nhân sự kiểm tra, không tự xác nhận vị trí hoặc tự tính đủ ngày công. Nhãn chính sách đổi thành Rà soát khi thiếu GPS.
- Giờ hiệu lực dùng capturedAtClient cho cả trực tuyến và ngoại tuyến, có kiểm tra tuổi tối đa 48 giờ / tương lai 5 phút và cờ sai lệch đồng hồ. Máy chủ giữ giờ nhận riêng. Lưu gpsCapturedAt trong metadata.
- Hàng đợi chờ giao dịch IndexedDB commit rồi mới báo đã lưu. ID và thời gian không đổi khi thử lại; intendedType tránh biến lần gửi lại chấm vào thành chấm ra.
- Mất kết nối thực dù navigator.onLine vẫn true được ghi nhận là lượt chờ mạng. Trở lại có mạng tự đồng bộ trên màn Cá nhân và màn camera, có khóa theo tài khoản, thứ tự thời gian và backoff. Trạng thái hôm nay hợp nhất lượt chờ của đúng tài khoản để tránh chụp trùng.

## Giới hạn

- Web không thể bảo đảm độ chính xác GPS của mọi thiết bị; cần quyền vị trí, HTTPS và dịch vụ vị trí của thiết bị. Không đổi địa chỉ/sai số để tạo độ chính xác giả.
- Ngoại tuyến áp dụng khi ứng dụng đang mở và đã tải trạng thái; không bổ sung service worker hay hứa mở mới toàn bộ website khi mất mạng.
- Quyền chấm công, chính sách bật/tắt chấm công và chính sách ngoại tuyến vẫn được máy chủ kiểm tra.
- Không cần migration hoặc sửa dữ liệu chấm công cũ.

## Kiểm tra kỹ thuật

TypeScript, ESLint và build được thực hiện trong lượt sửa. Chưa chạy kiểm thử tự động hoặc kiểm tra GPS bằng điện thoại thật trong lượt này.
