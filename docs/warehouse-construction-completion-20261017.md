# Hoàn thiện kho và công trường — 17/10/2026

## Kho

- Tổng quan có chứng từ chờ ghi sổ, kiểm kê đang mở và cảnh báo theo từng kho/mặt hàng. Không cộng số lượng khác đơn vị thành một chỉ tiêu.
- Danh sách kho, tồn, chứng từ, sổ kho và kiểm kê có bộ lọc, tìm kiếm và phân trang. Các lần đọc tổng hợp dùng phân trang database để tránh mất dữ liệu sau ngưỡng mặc định.
- Phiếu nhập/xuất/chuyển/điều chỉnh lưu các thay đổi trước khi ghi sổ. Kiểm tra phiên bản ở database; không ghi sổ một bản nháp đã bị sửa ở phiên khác. Đơn giá, tham chiếu, mục đích, ghi chú và liên kết lô hàng được giữ lại khi sửa.
- Phiếu xuất/chuyển hiển thị tồn khả dụng và tồn dự kiến sau ghi sổ. Database vẫn kiểm tra tồn trong giao dịch; thao tác phía trình duyệt không thay thế kiểm tra này.
- Hủy nháp và đảo chứng từ dùng hộp thoại có lý do. Phiếu đã ghi sổ không được sửa/xóa trực tiếp; giữ nguyên sổ kho.
- Tồn đã cấu hình ngưỡng nhưng chưa có phát sinh vẫn hiện 0 và cảnh báo hết hàng.
- Kho dùng tên dự án, công trường, người quản lý. Kho mới cấp phạm vi xem/thao tác cho người tạo trong cùng giao dịch. Không được ngừng kho đang còn hàng hoặc có kiểm kê đang mở.

## Kiểm kê

1. Chọn kho, ngày, phạm vi và chính sách giao dịch. Phạm vi toàn kho gồm hàng có tồn hoặc đã cấu hình tại kho; phạm vi chọn hàng có thể thêm hàng mới phát hiện.
2. Có thể tìm hàng và lưu từng đợt. Ô trống là chưa kiểm, khác số 0 đã kiểm. Có thể xóa một số đã nhập về trạng thái chưa kiểm.
3. Chỉ ghi sổ khi tất cả dòng đã được kiểm. Phiên bản được kiểm tra lại trong giao dịch.
4. Chênh lệch tạo phiếu điều chỉnh thực; không có chênh lệch thì hoàn tất mà không tạo phiếu rỗng. Gửi lại cùng yêu cầu không tạo thêm giao dịch.
5. Hủy kiểm kê chưa ghi sổ phải có lý do và giải phóng khóa giao dịch của kho.
6. Chính sách cho phép giao dịch trong lúc kiểm kê sẽ từ chối ghi sổ nếu có phát sinh sau mốc chụp tồn. Người dùng hủy và lập lại kiểm kê để xác nhận số thực tế mới; hệ thống không tự suy đoán thời điểm đếm của từng dòng.

## Công trường

- Tab Vật tư nối kho đã liên kết với dự án/công trường: tồn, ngưỡng, cảnh báo và chứng từ gần đây. Cần đồng thời có quyền xem dự án và phạm vi kho; không cấp thêm quyền tự động.
- Các nút nhập, xuất, chuyển và sổ kho theo quyền, có sẵn ngữ cảnh dự án/công trường/kho.
- Hôm nay ưu tiên việc đang vướng, quá hạn, đến hạn và đang thi công; số đếm tính trên toàn danh sách trước khi giới hạn các mục hiển thị. Nhân lực tính người duy nhất, không cộng trùng ca.
- Vướng mắc mở lấy riêng từ danh sách vấn đề theo quyền, có đường dẫn để xử lý và giữ bộ lọc dự án. Với người chỉ xem cập nhật gần đây, nhãn không ngụ ý đó là toàn bộ vấn đề.
- Tiến độ dùng người đã phân công trong dự án; không tải ngẫu nhiên 100 nhân viên đầu tiên của toàn công ty. Dữ liệu nhập được giữ khi gặp lỗi lưu/phiên bản.
- Có thể sửa tên, địa chỉ, GPS, bán kính, ngày hiệu lực và trạng thái công trường. Cập nhật kiểm tra thời điểm sửa trước đó, tránh ghi đè phiên khác.
- Đồng bộ lại dữ liệu sau cập nhật hiện trường, điểm danh và kết nối lại. Hàng đợi ngoại tuyến giữ trạng thái và phản hồi khi đồng bộ thất bại.

## Giao diện

Dùng chung token bo góc, ô nhập và nút. Điện thoại dùng thẻ dữ liệu, bộ lọc đủ rộng, tên/mã hàng tách dòng và chênh lệch kiểm kê hiện ngay. Hộp thoại giữ nội dung khi lỗi và chặn thao tác trùng trong lúc lưu. Nội dung giao diện chỉ dùng nhãn, dữ liệu và trạng thái.

## Phạm vi kiểm tra

- 49 kiểm tra PostgreSQL bằng giao dịch ROLLBACK trên database TEST; đối chiếu số lượng và digest của dữ liệu nghiệp vụ trước/sau.
- Migration `202610170002_warehouse_completion.sql`, SHA-256 `3884956cb92b3168657362990df31187431f1f5c2d1efe009088f9c5f3a2242d`, đã áp dụng TEST, tổng 54 migration. Production không thay đổi.
- Giao diện kiểm tra bằng Chrome ở 320, 390, 768, 1440 px; thao tác ghi dùng fixture cô lập. Kết quả bản triển khai được ghi trong biên nhận vận hành.
- Không mô phỏng tranh chấp khóa giữa nhiều phiên PostgreSQL đồng thời hoặc kiểm tra trên thiết bị điện thoại vật lý.

## Xác nhận triển khai

- Bản TEST READY `dpl_4RnUm8dprL3SFqNGVdYcEfUxvKRW`; production giữ nguyên.
- 57 trạng thái fixture và 50 trạng thái trực tiếp trên bản test đạt; không ghi nghiệp vụ thật khi xem giao diện.
- 6 trạng thái chuyển trang bình thường qua liên kết, quay lại và đổi tab đạt.
- 18 kiểm tra API kho/công trường/quyền và 26 kiểm tra health/alias/API đạt.
- Phiếu cũ ở trạng thái đã gửi có thao tác ghi sổ; chuyển tab giữ nguyên công trường đang chọn.
