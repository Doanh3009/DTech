# Không gian chứng từ và nhận hàng — 05/11/2026

Đợt này hoàn thiện phần bên trong chứng từ, theo luồng làm việc trên cùng một màn hình. [Bằng chứng kiểm tra cục bộ](../commercial-erp/evidence/document-interior-local.json) ghi rõ phạm vi, kích thước và kết quả; đây là kiểm tra giao diện bằng dữ liệu giả lập, không phải nghiệm thu nghiệp vụ trên doanh nghiệp thật.

## Bố cục và thao tác

Khung chứng từ gồm nhận diện, trạng thái và đối tượng liên quan ở đầu; vùng nội dung cuộn riêng; thanh hành động ở cuối. Thông tin chung và dòng hàng nằm trong phần **Chứng từ**. Duyệt, nhận hàng, tệp và lịch sử được mở theo ngữ cảnh của chứng từ hiện tại.

- Bản nháp mới dùng **Lưu nháp & thêm dòng**. Sau POST thành công, ứng dụng đọc lại chi tiết bằng GET để lấy phiên bản đã xác nhận rồi mở trình nhập dòng ngay trong chứng từ.
- Chứng từ có sẵn mở ở bảng dòng đã lưu. **Thêm dòng** hoặc **Sửa** mở trình nhập có chủ đích; validation hiển thị tại trường và đưa focus đến trường lỗi. Hủy nhập có xác nhận khi đang có thay đổi.
- Dòng mua/bán ghép số lượng nhập với đơn giá theo cùng đơn vị. Số lượng cơ sở và hệ số được trình bày riêng. Bảng có thành tiền, số dòng và tiền hàng; khi dữ liệu phân trang, nhãn ghi rõ tiền hàng của trang hiện tại.
- Dòng lưu dùng phiên bản của chính dòng; tải lại chi tiết cập nhật phiên bản chứng từ cha. Kết quả chưa xác nhận giữ nguyên yêu cầu để thử lại; không tạo UUID mới sau mất phản hồi.
- Chứng từ đã phát hành trình bày dữ liệu dạng nhãn/giá trị và dòng hàng chỉ xem. Không mở lại trình nhập chỉ vì tài khoản có quyền tạo một chứng từ mới.
- Chuyển phần hành hoặc điều hướng phải xử lý thay đổi chưa hoàn tất. Hủy xác nhận điều hướng giữ nguyên chứng từ và dữ liệu đang nhập.

Nguồn thực thi: `BusinessRecords`, `BusinessDocumentWorkspace`, `BusinessDocumentLines`, `BusinessTransactionQuantity`, `BusinessRecordFormFields` và `BusinessPurchaseReceiving`. Thành phần dùng token, biểu mẫu, bảng, trạng thái và dropdown chung của ERP.

## Nhận hàng trong đơn mua

Đơn mua đã phát hành có phần **Nhận hàng & đối chiếu**. Người dùng chọn vật tư từ những dòng được phép xem, nhập số lượng nhận theo đơn vị cơ sở, kho, ngày và giá nhận. Một phiếu được tạo cho một mặt hàng; thao tác tiếp theo có thể lập phiếu nhận khác.

Sau khi lưu phiếu, ứng dụng đọc lại đúng phiếu và phiên bản bằng GET. Nút **Nhận vào kho** chỉ xuất hiện khi trạng thái phê duyệt hiện tại cho phép. Với luồng có chính sách, phiếu đi qua trình duyệt và duyệt trước khi ghi nhận; với luồng không yêu cầu chính sách, phiếu vẫn cần ngữ cảnh và phiên bản đã xác nhận. Sau thao tác, ứng dụng đọc lại phiếu và tải lại đối chiếu đơn mua.

Trong mẫu kiểm tra, dòng được sửa thành **3 thùng = 36 cái**, đơn giá cơ sở **1.000**. Phiếu nhận một phần **12 cái**, giá trị **12.000**, được phản ánh lại trong đối chiếu của đơn có giá trị đặt **36.000**. Các con số và trạng thái này do API giả lập trả về.

Hiện màn nhận hàng chưa có read model số lượng còn lại tích lũy theo từng vật tư. UI không suy diễn số lượng còn nhận từ tổng giá trị và không thay thế kiểm tra vượt nhận ở service/RPC. Nghiệm thu nhập kho, giá vốn, hóa đơn, công nợ và quyền người lập/người duyệt cần bằng chứng nghiệp vụ riêng.

## Kiểm tra cục bộ

Fixture `/ui-preview/erp-workareas` tại `http://127.0.0.1:3102` dựng các component thật. Playwright chặn các API của doanh nghiệp mẫu và trả dữ liệu có trạng thái trong bộ nhớ. Không đăng nhập tài khoản thật, không ghi dữ liệu vào máy chủ hoặc nhà cung cấp bên ngoài.

Kết quả ghi nhận **29 kiểm tra, 41 ảnh**, tại 1440×1000, 768×1000, 390×1000 và 390×620:

- Tạo đơn mua → POST → GET xác nhận → nhập/sửa dòng trong cùng phần chứng từ → phát hành → nhận một phần → POST/GET phiếu → duyệt nếu cần → ghi nhận → GET và tải lại đối chiếu.
- Có và không có chính sách phê duyệt theo dữ liệu giả lập; trạng thái có chính sách được kiểm tra ở 768 px. Đây không phải kiểm chứng phân tách người lập/người duyệt trên backend.
- Một phản hồi lưu phiếu bị làm mất sau khi fixture đã ghi nhận. Lần thử lại dùng cùng UUID và payload; fixture chỉ giữ một phiếu.
- Không có lỗi trang, lỗi API giả lập hoặc lệnh ghi ngoài fixture. Khung không tràn chiều ngang, thanh cuối giữ vị trí khi nội dung cuộn, không có form lồng nhau.
- Từng nút của thanh cuối nằm trong khung, kể cả 390×620; focus ban đầu của dòng mới nằm trong vùng nội dung đang hiển thị. Việc soát kiểu chữ, mật độ và các trạng thái ngoài kịch bản vẫn cần xem giao diện thực tế.

Suite unit liên quan trong repository ghi nhận **2.162 đạt, 37 bỏ qua**; lint có 0 lỗi và 5 cảnh báo đã tồn tại; build cục bộ đạt. Những kết quả này không xác nhận deployment, kết nối dữ liệu thật hay hoàn tất toàn bộ 82 yêu cầu.

## Kiểm chứng SQL và nâng cấp riêng

[Hồi quy PostgreSQL](../commercial-erp/evidence/document-interior-native.json) thực thi schema, quyền và giao dịch thật trong cơ sở dữ liệu cô lập: 105 migration, 142 thực thể, 22 bộ kiểm chứng. Có 32 kiểm tra đơn vị giao dịch và sáu kiểm tra nâng cấp, ngoài 28 quy tắc chứng từ, 30 quy tắc mô phỏng và các luồng cũ. Một lỗi thứ tự kiểm tra quyền ở wrapper quy đổi đã được sửa: quyền sửa cả đầu chứng từ cũ và đích được kiểm tra trước khi trả lỗi phiên bản; không dùng lỗi CAS để tiết lộ trạng thái nguồn ngoài phạm vi.

[Receipt Supabase phát triển](../commercial-erp/evidence/document-interior-cloud-upgrade.json) xác nhận migration `202611040001` đã áp dụng, từ 161 lên 162 migration. Bốn bảng giao dịch được backfill snapshot theo đơn vị cơ sở/hệ số 1; dữ liệu nghiệp vụ trước nâng cấp, sáu doanh nghiệp, 18 tài khoản, bút toán, tổng Nợ/Có, audit và command không đổi. Không chạy seed, roles hay thay Vault. RPC chọn đơn vị chỉ cấp cho server; helper chuẩn hóa và wrapper cũ tiếp tục riêng tư. Đây là bằng chứng nâng cấp dữ liệu, tách biệt với fixture giao diện và nghiệm thu nhà cung cấp ngoài.

[Trình duyệt nối SQL thật cục bộ](../commercial-erp/evidence/document-interior-native-browser.json) đã qua ba kích thước 1440/768/390, 14 kiểm tra và 15 ảnh, không có lỗi trang/API hoặc truy cập bên ngoài. Mỗi lượt tạo đơn qua UI, nhập **2 hộp = 24 cái**, sửa thành **3 hộp = 36 cái**, phát hành, nhận một phần **6 cái**, ghi nhận phiếu và xác nhận phát sinh kho thật cùng đối chiếu **72.000 đặt / 12.000 nhận**. Dữ liệu nằm trong PostgreSQL cô lập, khác fixture bộ nhớ và khác cloud; transport loopback không thay thế nghiệm thu PostgREST/Storage được host. [Dòng mới](../ui-evidence/document-interior-native/parent-inline-line-entry-1440.png), [sửa dòng trên điện thoại](../ui-evidence/document-interior-native/line-edit-390.png), [nhận hàng và đối chiếu](../ui-evidence/document-interior-native/receipt-posted-matching-1440.png).

## Ảnh đại diện

| Trạng thái | Ảnh |
| --- | --- |
| Chứng từ đã phát hành, chỉ xem | [Desktop](../ui-evidence/document-interior-local/1440x1000-released-readonly.png) |
| Bản nháp mới | [Desktop](../ui-evidence/document-interior-local/1440x1000-new-document-draft.png) |
| Lưu cha rồi mở dòng ngay trong chứng từ | [Desktop](../ui-evidence/document-interior-local/1440x1000-saved-parent-inline-editor.png) |
| Nhập dòng và quy đổi | [Desktop](../ui-evidence/document-interior-local/1440x1000-line-entry-conversion.png), [điện thoại](../ui-evidence/document-interior-local/390x1000-line-entry-conversion.png) |
| Bảng dòng và tiền hàng | [Desktop](../ui-evidence/document-interior-local/1440x1000-saved-line-grid.png) |
| Sửa dòng | [Desktop](../ui-evidence/document-interior-local/1440x1000-line-edit.png), [màn hình thấp](../ui-evidence/document-interior-local/390x620-line-edit.png) |
| Nhận một phần trong đơn mua | [Desktop](../ui-evidence/document-interior-local/1440x1000-partial-receiving.png) |
| Phiếu đã đủ bước duyệt | [Tablet](../ui-evidence/document-interior-local/768x1000-receipt-approved.png) |
| Phiếu đã ghi nhận và đối chiếu được tải lại | [Desktop](../ui-evidence/document-interior-local/1440x1000-receipt-posted-match.png), [điện thoại](../ui-evidence/document-interior-local/390x1000-receipt-posted-match.png) |
