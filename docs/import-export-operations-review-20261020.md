# Giao diện lô hàng và kiểm thử vận hành — 20/10/2026

## Thay đổi giao diện

- Đưa workspace lô hàng vào layout dùng chung của bảy trang con. Chuyển tab giữ dữ liệu đã tải, bản nháp, URL và lịch sử Back/Forward.
- Tắt hiệu ứng chuyển cả trang bên trong workspace lô hàng để thao tác tab không gây cảm giác tải lại màn hình.
- Bỏ giới hạn nội dung 1.120px. Desktop đặt bảng bên trái và biểu mẫu bên phải; tablet/điện thoại tự chuyển về một cột.
- Tách số lượng và đơn vị, cho mã hàng/đơn vị dài xuống dòng; thêm thao tác điền số còn lại, nút làm mới dữ liệu và thông báo lưu/lỗi.
- Thông quan, trạng thái và lịch trình giữ phiên bản tại thời điểm bắt đầu sửa. Khi người khác cập nhật, giữ bản nháp và yêu cầu chọn tải bản mới trước khi ghi tiếp.
- Nhận hàng theo dõi cả thay đổi XNK và kho để cập nhật tiến độ sau khi người dùng kho ghi sổ.
- Giữ mã yêu cầu khi thử lại cập nhật lịch trình hoặc lập phiếu nhập sau lỗi kết nối; khóa thao tác trong khi đang gửi.
- UI chỉ bổ sung nhãn, trạng thái và dữ liệu thao tác.

## Kiểm thử

Toàn bộ thao tác nghiệp vụ dùng Supabase TEST độc lập và dữ liệu có mã E2E riêng. Không reset database. Tài khoản của từng lượt kiểm thử được khóa khi hoàn tất; chứng từ và audit được giữ để đối chiếu. Lượt đầu bị dừng bởi promise không được xử lý trong script chuyển tài khoản đã được khóa riêng; script được sửa để lỗi một ca không làm dừng cả bộ.

| Phạm vi | Kết quả |
|---|---|
| Unit toàn hệ thống | 1.026 đạt, 0 lỗi; 37 ca opt-in được chạy riêng ở dòng dưới |
| Đọc trực tiếp 37 GET route trên Supabase TEST | 37 đạt, 0 lỗi, 0 truy vấn SQL lỗi |
| Unit XNK và tab sau thay đổi cuối | 24 đạt |
| Điều hướng AppShell và XNK sau thay đổi cuối | 25 đạt |
| Helper xác định trang sẵn sàng bằng Playwright | 3 đạt; vẫn chờ dữ liệu chính/font và giữ lỗi runtime |
| TypeScript | Đạt |
| ESLint | Đạt; loại thư mục tạm `.tmp` khỏi phạm vi quét |
| Build | Đạt; sinh 288 trang |
| Kiểm thử đồng thời bổ sung `20261020385186` | 11 đạt, 0 lỗi, 0 bị chặn; gồm setup và khóa tài khoản |
| Lượt E2E đầy đủ trên bundle tối ưu `202610201aac5d` | 254 đạt, 2 lỗi, 0 bị chặn; gồm 141 màn hình desktop/điện thoại |
| Kiểm tra lại hai màn hình sau sửa trên build cuối | 4/4 đạt: nhật ký và bảng lương, mỗi màn hình ở 1.440px và 390px |

Ảnh sau sửa: [container desktop](ui-evidence/import-export-20261020/containers-1920.png), [nhận hàng desktop](ui-evidence/import-export-20261020/receiving-1920.png), [nhận hàng điện thoại](ui-evidence/import-export-20261020/receiving-390.png). [Biên nhận đồng thời](ui-evidence/import-export-20261020/concurrency-report.json).

[Ma trận E2E đầy đủ](ui-evidence/import-export-20261020/production-report.md), [kết quả và thời gian E2E](ui-evidence/import-export-20261020/production-report.json), [37 GET route trực tiếp](ui-evidence/import-export-20261020/live-read-report.json). Giữ nguyên các lỗi của lượt đầu trong biên nhận, không đổi thành đạt hồi tố.

[Biên nhận kiểm tra lại cuối](ui-evidence/import-export-20261020/final-ui-recheck.json), [nhật ký desktop](ui-evidence/import-export-20261020/audit-1440.png), [bảng lương desktop](ui-evidence/import-export-20261020/payroll-1440.png), [bảng lương điện thoại](ui-evidence/import-export-20261020/payroll-390.png). Bảng lương bắt đầu ở y=388,6px sau sửa; nhật ký tải khoảng 1,4 giây ở lượt xác nhận. Một lượt mở bảng lương lạnh mất khoảng 11 giây; thời gian này gồm đọc DB TEST và cần theo dõi trên hạ tầng vận hành.

### Hai lỗi tìm được và sửa sau lượt E2E

- Nhật ký hệ thống thiếu xử lý lỗi mạng và kết thúc trạng thái tải. Bổ sung hủy request cũ, giới hạn chờ 15 giây, kết thúc tải trong `finally`, thông báo lỗi và thử lại tại chỗ. Giữ bảng đã có khi đổi bộ lọc; response cũ không ghi đè bộ lọc mới. Hai unit test mới kiểm tra mất mạng/thử lại và response trả sai thứ tự.
- Bảng lương bắt đầu ở y=408,6px, thấp hơn tiêu chí dưới 400px. Thu gọn khoảng cách và padding thanh công cụ. Cập nhật ca trình duyệt theo tiêu đề tháng thực tế và vùng lương điện thoại đang hiển thị, vẫn giữ kiểm tra tên chỉ hiện một lần và nút cao tối thiểu 44px.

Không chạy lại toàn bộ 256 ca sau hai thay đổi cục bộ này: đã chạy lại toàn bộ unit, build/TypeScript, ESLint và hai màn hình liên quan ở cả hai kích thước. Các API nghiệp vụ không thay đổi trong hai sửa chữa cuối.

### Nhiều người thao tác

- Tám tài khoản thuộc tám vai trò đọc đồng thời bằng phiên riêng.
- Hai người cập nhật ETA cùng phiên bản: một HTTP 200, một HTTP 409; chỉ có một bản lịch sử và một lần tăng phiên bản.
- Hai người sửa thông quan cùng phiên bản: một thành công, một xung đột.
- Lập phiếu nhập đồng thời với cùng mã yêu cầu trả cùng ID phiếu; phiếu nháp chưa làm tăng thực nhận.
- Hai phiên ghi sổ cùng phiếu chỉ tăng tồn và thực nhận một lần.
- Hai phiếu khác nhau cùng ghi sổ, tổng vượt số lượng lô hàng: một thành công, một bị chặn; thực nhận không vượt giới hạn.
- Phiên XNK tự thấy tiến độ nhận hàng thay đổi sau khi phiên kho ghi sổ; thời gian đo được khoảng 3,7 giây, gồm thời gian ghi sổ và tải dữ liệu mới.
- Bảy tab và sáu mục điều hướng XNK giữ nguyên document/phiên làm việc; bản nháp container còn nguyên sau Back/Forward.
- Kiểm tra ảnh và tràn ngang ở 1.920, 1.366, 768, 390 và 375px.

### Hiệu chỉnh bộ kiểm thử cũ

Đối chiếu với schema và giao diện hiện tại trước khi sửa fixture/kỳ vọng: bảo hiểm có trạng thái đóng, sửa dòng lương có lương theo công, chọn mã điều chỉnh ngoài mã kiểm kê dành riêng, đọc lại phiên bản lương sau khi chốt công tự đồng bộ, duyệt phép lặp trả xung đột nhưng không trừ phép thêm. Các ca unit cũ được cập nhật cho drawer gửi phiếu, điểm danh cần HR rà soát khi thiếu GPS, thời hạn lấy GPS, menu kho và mục vật tư công trường. Các kiểm tra chống ghi đè, mất dữ liệu, quyền và số dư vẫn được giữ.

Lượt dev có timeout khi Next.js đang biên dịch và khi bộ chờ theo dõi cả tra địa chỉ nền. Chẩn đoán nhật ký công xác nhận font đã tải, không có loader, 300 dòng đã hiển thị nhưng request tra địa chỉ vẫn còn chạy. Helper được sửa chỉ bỏ chờ phần tra địa chỉ tùy chọn; vẫn chờ API nghiệp vụ, font, loader và vẫn giữ lỗi runtime/HTTP 5xx. Ba fixture trình duyệt xác nhận điều này, gồm API nghiệp vụ bị giữ lại rồi trả HTTP 503. Lượt xác nhận cuối dùng bundle tối ưu (`next start`) ở `localhost:3301`, cùng Supabase TEST; không dùng kết quả timeout dev để tính đạt.

## Giới hạn kết luận

Tám phiên kiểm thử và hai thao tác ghi tranh chấp là phạm vi đã đo. Kết quả này chưa xác nhận sức chịu tải hàng trăm người, khả năng khôi phục backup, độ sẵn sàng của hạ tầng hay chấp thuận UAT của người vận hành. 37 ca opt-in đã được chạy riêng trên database TEST và đạt toàn bộ, không tính từ trạng thái bỏ qua của bộ unit mặc định. Thay đổi hiện nằm trong workspace; chưa phát hành lên website đang vận hành.

Bản xem thử cuối: `http://localhost:3301`, bundle tối ưu dùng database TEST. Server dev phục vụ kiểm thử đã dừng. Cả bốn manifest E2E của lượt làm việc đều có `sealedAt`; không còn tài khoản E2E của các lượt này được để hoạt động.
