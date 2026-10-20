# Giao diện điện thoại

Ngày cập nhật: 10/10/2026. Áp dụng cho màn hình dưới 768px.

## Bố cục và thao tác

- Thanh trên cao 60px và safe area, dùng một hàng. Trang chính hiển thị nút ứng dụng, logo, tên đơn vị, thông báo và tài khoản. Trang chi tiết hiển thị quay lại, tên màn hình, menu và tài khoản. Tiêu đề trang chi tiết được đưa vào thanh trên sau khi nội dung tải xong.
- Không hiển thị thanh tab điều hướng cố định dưới màn hình. Menu toàn màn hình có tìm kiếm ở đầu, chức năng trong ứng dụng/công trường đang mở, lưới ứng dụng theo quyền và tiện ích cá nhân. Chức năng và ứng dụng dùng lưới biểu tượng ba cột; nhóm tiện ích dùng hai cột.
- Ô tìm kiếm trong menu lọc ứng dụng, lối tắt và tiện ích theo nhãn, không phân biệt dấu tiếng Việt.
- Tab trong công trường nằm phía trên nội dung, trong luồng trang. Khi nhiều mục, tab xuống hàng; mỗi nhóm chỉ đánh dấu một mục hiện tại.
- Cá nhân ưu tiên ca làm và chấm công; nhóm Của tôi gồm Lịch công, Phiếu lương và Nghỉ phép theo quyền. Phiếu lương nhân viên dùng `/personal/payslips`.
- Dashboard hiển thị ứng dụng, nhóm chỉ số và việc cần xử lý. Hai/ba ứng dụng dùng đúng hai/ba cột, tránh ô trống lớn. Chỉ số chính nằm trên một hàng, các chỉ số còn lại ghép cặp; chỉ số cuối lẻ dùng toàn hàng. Khoảng cách giữa nhóm là 10–12px.
- Bảy hồ sơ dashboard gồm Điều hành, Nhân sự, Kho, Kế toán, Xuất nhập khẩu, Công trường và Cá nhân. Tiêu đề chung là Chào, tên tài khoản; chỉ số ưu tiên, nhóm việc và biểu đồ giữ theo nghiệp vụ của vai trò. Việc cần xử lý luôn mở; danh sách dài hiển thị ba việc trước và có Xem thêm. Biểu đồ mặc định thu gọn trên điện thoại. Đã bỏ Hoạt động gần đây, Ghi chú nhanh và Việc cần làm cá nhân khỏi dashboard trên cả desktop/mobile.
- Danh sách có tìm kiếm, bộ lọc, số bộ lọc đang dùng và thao tác chính cạnh dữ liệu. Phần nghỉ phép bỏ bộ lọc theo yêu cầu; giữ Tạo đơn nghỉ và dữ liệu đơn. Thao tác phụ mở qua Công cụ.
- Danh sách dùng thẻ bản ghi gọn: thông tin nhận diện, nút mở chi tiết 44px, hai dữ liệu chính và hàng Thông tin thêm/Thao tác. Các trường còn lại mở trong Thông tin thêm; chọn bản ghi và sắp xếp vẫn sử dụng dữ liệu/callback hiện có.
- Thao tác có form xử lý hoặc input tải file được giữ trên thẻ để không mất trạng thái khi đóng menu. Bộ lọc trong bảng mở vẫn gắn các trường lồng nhau với form gốc, gồm khoảng ngày và giá trị select.
- Form chỉ giữ thanh Lưu/Gửi ở cuối màn khi cần; khoảng cách theo safe area. Form nghỉ phép ghép ngày và buổi thành từng hàng. Form kho ưu tiên ngày, loại giao dịch, kho và dòng hàng; tham chiếu, người giao/nhận và ghi chú nằm trong Thông tin bổ sung. Nhóm này tự mở khi chứng từ đã có dữ liệu phụ; đóng/mở vẫn giữ giá trị đang nhập. Chi tiết lương dùng nhóm tổng hợp gọn và có thể mở Phụ cấp, Thưởng và Khấu trừ.
- Lịch công hiển thị đúng số tuần của tháng, thống kê từ dữ liệu tháng và trạng thái bằng chấm màu. Chọn ngày để xem giờ vào/ra, ca làm và ảnh ngay bên dưới trên điện thoại; desktop tiếp tục dùng drawer. Khi đổi tháng, giữ khung lịch và khóa điều khiển trong lúc tải, tránh hiển thị số liệu tháng cũ.
- Lịch dùng 7 cột `minmax(0, 1fr)` và ô cao cố định 54px trên điện thoại; số ngày, trạng thái và khoảng trống không làm méo hàng. Form nghỉ phép chia hai khối bo 20px, tiêu đề 20px, ô nhập 48px; số ngày lấy từ preview theo chính sách server và không tính lại khi gõ lý do.
- Header mobile sở hữu nút quay lại. Các BackLink trong nội dung và nút quay lại cuối form dùng `data-ui="back-control"`; ẩn trên điện thoại, giữ trên desktop. Chuyển bước wizard vẫn hiển thị riêng.
- Luồng phiếu lương: [Gửi và xác nhận](payslip-confirmation.md). Link điện thoại camera/GPS: [HTTPS có mật khẩu](testing/mobile-https.md).
- Trang nghỉ phép chỉ có một nút Tạo đơn nghỉ; đơn gần đây đặt trong thẻ trắng bo góc, giữ ngày nghỉ và trạng thái trong phần hiển thị chính của bản ghi mobile. Request danh sách hủy khi rời màn hình và hết thời gian chờ sau 15 giây.
- Cấu hình nghiệp vụ gom nhóm có thể mở/đóng; tìm kiếm vẫn lọc ngay trên danh mục đã tải.

## Biểu đồ và logo

- Cột và thanh ngang dùng chung thang đo có mốc 0, chiều cao/chiều dài tính trực tiếp từ giá trị. Nhãn cột ở đầu cột; trên điện thoại dùng thanh ngang và nhãn số rõ. Không ép số nhỏ lên mức tối thiểu hoặc cắt giá trị vượt thang khai báo.
- Biểu đồ tròn có số lượng và phần trăm, giữ đúng tỷ lệ. Các vòng KPI trang trí đã được thay bằng biểu tượng; vòng tiến độ chỉ dùng cho dữ liệu phần trăm thực sự. Màu biểu đồ dùng token riêng sáng.
- Tổng nhân sự, phòng ban và cơ cấu cùng dùng nhóm đang làm, thử việc và chờ nhận việc. Nhân sự chưa phân phòng được giữ lại; danh sách lớn đọc đủ các trang và phần dư được gộp thành Các phòng ban khác.
- Logo chính thức dùng PNG gốc 447 × 559, cắt vùng biểu trưng vuông bằng CSS để giữ tỷ lệ; logo tùy chỉnh vẫn được ưu tiên và có fallback. Header có vùng chạm 44px và biểu trưng 32px.

## Quy tắc triển khai

Nền sáng, thẻ trắng, điểm nhấn màu dịu; bo góc thẻ 12px, điều khiển 10px. Vùng chạm 44–48px; input 16px để tránh tự zoom trên điện thoại. Không thêm mô tả dưới chức năng, hành động hoặc mục điều hướng. Luôn giữ trường dữ liệu cần thao tác qua thẻ, bảng mở rộng hoặc màn chi tiết.

Các lớp mobile được import sau `enterprise.css` trong root layout theo thứ tự `mobile-design.css`, `mobile-shell.css`, `mobile-components.css`, `mobile-workspaces.css`, `mobile-home.css`, `brand-logo.css`, `mobile-polish.css`. CSS nghiệp vụ riêng dùng module và breakpoint tương ứng. Không đổi quyền ở backend để phục vụ bố cục.

`AppShell` dùng `visualViewport` để nhận biết bàn phím khi đang nhập và xử lý chiều cao overlay. Thanh thao tác form không chiếm phần màn hình còn lại khi nhập liệu. Cần tiếp tục đối chiếu trên máy iOS/Android thật vì kích thước bàn phím và thanh trình duyệt tùy thiết bị.

Trạng thái tiêu đề được render trên khung bằng React; không sửa thuộc tính của PageHeader khi nội dung còn đang hydrate. Cách này tránh cảnh báo khi Next.js stream nội dung trang.

## Đối chiếu lần này

Đã đối chiếu bảy hồ sơ dashboard, Cá nhân, menu, Lịch công, Nghỉ phép, Nhân viên, bộ lọc, Bảng lương, Chi tiết lương, Tạo phiếu nhập, Công trường, Tin nhắn và Cấu hình trên trình duyệt với dữ liệu Supabase test. Các kích thước gồm 360, 390, 430, 720 và 1440px; không thấy trang tràn ngang hoặc thanh tab cố định dưới màn hình ở các màn đã xem. Đã mở menu, bộ lọc, thao tác bản ghi, biểu đồ, chọn ngày/đổi tháng và kiểm tra đóng/mở trường phụ giữ giá trị.

Ảnh lần này nằm trong `test-results/mobile-refine/`, tên bắt đầu bằng `final-` và `v2-` (không commit). Không ghi nhận lỗi runtime hoặc hydration trong lượt đối chiếu. Các số liệu hiển thị lấy từ read model/API hiện có.

TypeScript và lint các file thay đổi đã qua. Lượt thiết kế này không tạo chứng từ hoặc ghi sổ nghiệp vụ, không chạy lại bộ E2E nghiệp vụ. Chưa đối chiếu trên thiết bị iOS/Android vật lý.

## Chi tiết nghiệp vụ và trạng thái tải — 10/10/2026

- `GlobalLoadingIndicator` ở root layout là nơi duy nhất vẽ chỉ báo tải giữa màn hình. Mỗi request/component đăng ký một token trong `loadingActivity`; token được thu hồi khi hoàn tất, lỗi, hủy hoặc unmount. Nhiều tác vụ cùng chạy vẫn chỉ hiển thị một chỉ báo. Spinner nội tuyến của link ẩn trên mobile.
- `Button.busy` giữ nguyên nhãn và khóa thao tác trong lúc xử lý. Các nút lưu, gửi, xuất, tải tệp, phân công, điểm danh, đăng nhập/đăng xuất và cập nhật dashboard được chuyển sang mẫu này. Trạng thái đồng bộ tệp, GPS/camera và lỗi nghiệp vụ vẫn có nhãn riêng.
- Chi tiết lô hàng chuyển sang `ShipmentWorkspace`: tổng quan, hàng hóa, container, chứng từ, thông quan, nhận hàng và lịch sử. Desktop dùng các cột thông tin; mobile dùng lưới nhãn/giá trị hai cột và bộ chọn mục ở trên nội dung. URL từng mục giữ nguyên.
- Tổng quan dùng dữ liệu tuyến, hãng vận chuyển, ETD/ETA hiện tại và ban đầu, ngày thực tế, thông quan, lịch sử và số dòng/container/chứng từ. Mục khác thu gọn phần nhận diện trên mobile để thao tác nằm gần đầu màn hình. Không suy diễn số liệu hoặc lấp giá trị thiếu bằng dữ liệu giả.
- Chứng từ ưu tiên nút mở form tải lên, checklist bắt buộc và các tệp; chứng từ bổ sung có thể mở xem. Nhận hàng giữ ô số lượng trên thẻ bản ghi; thông tin dự kiến/đã nhận vẫn nằm trong Thông tin thêm. Tiến độ lấy từ API receiving, thanh chỉ giới hạn phần vẽ trong 0–100%.
- Các action lô hàng dùng permission hiện có, transition hiện có, row version và payload API hiện có; khóa gửi lặp. Giá trị form không bị xóa khi request lỗi. Form cập nhật nằm trong nhóm có thể mở/đóng trên mobile.
- Kiểm tra ảnh chấm công đặt bốn nhóm ảnh ở trên, nút làm mới chỉ còn biểu tượng trên mobile, trạng thái chưa có ảnh dùng biểu tượng thiếu ảnh. Khung rỗng gọn; chọn nhóm/người đặt trước ảnh kiểm tra. Vẫn giữ xem ảnh đầy đủ, GPS, duyệt trên thiết bị, đánh dấu, hoàn tác và quyền xem ảnh.
- Thanh Kiểm thử thu gọn cả trên desktop để giảm khoảng trống trước nội dung nghiệp vụ. Chỉ tải bộ chọn tài khoản sau khi mở thanh này.

Ảnh xem trước của đợt này dùng tên `detail-*` trong `test-results/mobile-refine/`. Đây là đối chiếu giao diện trên trình duyệt, không phải lượt E2E ghi nghiệp vụ hay kiểm tra trên điện thoại vật lý.

## Gradient, thời gian tải và tài khoản kiểm thử — 10/10/2026

- Canvas mobile dùng cùng token `--workspace-canvas` với desktop, gồm gradient hồng, cam và tím sáng. Thẻ, input và menu giữ bề mặt trắng để đọc và thao tác.
- Dashboard không mount `PersonalWorkspaceCards`, nên không tải thêm API note/todos. Dữ liệu ghi chú/việc cá nhân cũ vẫn được giữ trong database.
- Tổng quan nhân sự dùng lại danh sách đã đọc cho biểu đồ để tính các chỉ số, giảm từ bảy xuống ba truy vấn ban đầu; vẫn đọc đủ các trang khi vượt giới hạn Supabase. Chỉ số và biểu đồ dùng cùng tập nhân viên hiện tại.
- `PersonalToday` dùng chung request đang chạy cho tải ban đầu/realtime, hủy khi unmount và có timeout 12 giây. Strict Mode không gửi hai lần request ca làm khi mount; retry giữ nguyên dữ liệu đã tải.
- Shell hiển thị nút Kiểm thử theo môi trường, tài khoản trong danh mục và cookie tester đã ký. Việc mở trang không chờ thêm hai lượt đọc database chỉ để vẽ nút. API kiểm thử vẫn xác minh cookie, marker database, ownership và trạng thái tài khoản trước khi trả dữ liệu/chuyển phiên.
- Chuyển tài khoản đọc một danh sách tài khoản đã xác minh để kiểm tra cả tài khoản đích và phiên hiện tại; chạy song song với xác minh phiên hiện tại. Không thực hiện lại marker/account lookup riêng cho từng tài khoản.
- Bộ chọn tài khoản hủy request khi đóng/unmount, bỏ qua phản hồi cũ, giới hạn đọc danh sách/mở gate 12 giây và đăng nhập 20 giây. Lỗi mạng hoặc timeout trả lại điều khiển và cho phép thử lại; không tự động gửi lại đăng nhập.
- Next 16 cần `allowedDevOrigins` cho handshake dev. Cấu hình tự lấy các địa chỉ IPv4 của máy chạy server, không cho phép wildcard toàn bộ origin. Proxy so Origin với Host thực của request và APP_BASE_URL; tránh lỗi 403 khi Next chuẩn hóa URL dev về localhost.

Đã xem giao diện desktop 1440px và mobile 360/390px qua địa chỉ Wi-Fi của server. Danh sách mười tài khoản và chuyển Nhân sự → Kho trả HTTP 200; không thấy lỗi runtime hoặc tràn ngang ở các màn đã xem. Chỉ số nhân sự sau tối ưu giữ 149 nhân sự hiện tại, 143 đang làm, 2 thử việc, 80 hồ sơ chưa hoàn thiện và 4 hợp đồng sắp hết hạn tại thời điểm đối chiếu. TypeScript/lint đã qua. Chưa chạy lại E2E ghi nghiệp vụ hoặc kiểm tra trên điện thoại vật lý; thời gian mở lần đầu của bản dev còn gồm biên dịch Next.js và độ trễ Supabase.
