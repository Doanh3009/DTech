# Địa chỉ chấm công — 15/10/2026

## Đã thực hiện

- Chấm công cá nhân, lịch công, nhật ký, chi tiết lượt công và màn hình duyệt ảnh dùng chung `AttendanceLocationAddress`.
- Dịch vụ mặc định Photon chuyển GPS sang tên địa điểm/đường và địa giới từ OpenStreetMap, không cần API key. Chỉ các mục đang xuất hiện trên màn hình mới được tra, các yêu cầu trùng tọa độ được gộp và tuần tự hóa ở trình duyệt.
- Điểm bản đồ phải cách GPS không quá 250 m. Nhãn **Gần vị trí GPS** phân biệt dữ liệu bản đồ gần nhất với tọa độ đo thật; **GPS ±… m** giữ nguyên độ chính xác của thiết bị. Liên kết bản đồ luôn mở đúng tọa độ đã ghi nhận.
- Mốc tham chiếu trong hệ thống không được coi là địa chỉ chính xác. Với công trường, chỉ dùng địa chỉ đã cấu hình khi backend kiểm tra GPS trong bán kính công trường; nguồn hiển thị **Theo công trường**.
- Lỗi mạng, không tìm được tên địa chỉ, thiếu hạ tầng cache hay nhà cung cấp bị giới hạn đều giữ liên kết bản đồ và không cản trở ghi nhận chấm công.

## Nhà cung cấp và giới hạn

Photon cho phép dùng API dự án trong giới hạn hợp lý, có thể giới hạn hoặc dừng dịch vụ và không cam kết tính sẵn sàng. Nguồn chính thức: [Photon Demo Server](https://github.com/komoot/photon#demo-server), [Reverse API](https://github.com/komoot/photon/blob/master/docs/api-v1.md#reverse).

- `GEOCODING_PROVIDER=photon` (mặc định), `disabled`, hoặc `nominatim`.
- `GEOCODING_REVERSE_URL` tùy chọn thay bằng endpoint HTTPS do đơn vị vận hành cấu hình. Adapter Nominatim chỉ dùng endpoint riêng/đã được phép; mã từ chối `nominatim.openstreetmap.org`.
- [Chính sách Nominatim công cộng](https://operations.osmfoundation.org/policies/nominatim/) không phù hợp cho việc tự động gửi GPS nhân sự; không dùng làm phương án dự phòng.
- POST `/api/v1/attendance/address` yêu cầu đăng nhập, quyền chấm công và tài khoản đang hoạt động; đầu vào chỉ có vĩ độ/kinh độ, không có URL bên ngoài hay ID nhân viên.
- Tọa độ không nằm trong URL API của ứng dụng hoặc log. Cache máy chủ dùng khóa SHA256, không có tên/ID nhân viên hay tọa độ đầu vào. Kết quả bản đồ có tọa độ đối tượng được nhà cung cấp trả về để bảo toàn căn cứ đối chiếu.
- Ba bảng cache/gate/quota bật RLS; tài khoản ứng dụng không đọc được trực tiếp. Hai RPC chỉ cấp cho `service_role`.
- Một lease dùng chung cho mọi instance theo nhà cung cấp; tối thiểu 1,1 giây giữa yêu cầu, không gọi song song. Quota 30 cache miss/tài khoản/phút; 429 áp dụng thời gian chờ chung.
- Cache địa chỉ 30 ngày, không tìm thấy một ngày, lỗi một phút. Dữ liệu cache hết hạn được dọn dần trong các lần tra tiếp theo. Bộ nhớ trình duyệt tối đa 500 mục, không lưu GPS vào localStorage.

## Kiểm chứng

- Tọa độ công cộng khu vực UBND Thành phố Hồ Chí Minh, 10.7769 / 106.7009: Photon trả HTTP 200 và đối tượng **Khuôn viên UBND Thành phố Hồ Chí Minh**, Sài Gòn. Không dùng GPS nhân viên để gọi thủ công.
- 20 kiểm tra PostgreSQL trên TEST, toàn bộ DDL và dữ liệu giả rollback; kiểm tra quyền/RLS, lease dùng chung, thời gian chờ, quota, cache và lease cũ không ghi đè.
- Unit/component/API kiểm tra Unicode tiếng Việt, địa chỉ thiếu dữ liệu, điểm bản đồ quá xa, quyền truy cập, gộp yêu cầu, xử lý mất mạng và nguồn địa chỉ công trường.
- Migration `202610150001_attendance_address_cache.sql`; root quản lý việc áp dụng và phát hành TEST.

Địa chỉ phụ thuộc độ chính xác GPS và độ phủ bản đồ. Phần này không thay đổi quy tắc ghi nhận GPS hoặc cho phép chấm công ngoài các quyền hiện có.
