# Nhập danh mục theo doanh nghiệp

Phạm vi: vật tư (`items`), đối tác (`partners`) và kho (`warehouses`) trong registry `businessImportCatalogs.json`. Mở danh mục tương ứng và chọn **Nhập Excel / CSV**. Đây là một phần của C02/2.02, không thay thế toàn bộ nghiệp vụ quản lý danh mục trong ma trận MISA.

## Tệp và xem trước

- Tải mẫu XLSX, điền một trang tính hoặc dùng CSV UTF-8. Tối đa 1 MB, 200 dòng dữ liệu nằm ở dòng 2–201 và 16 cột. Dòng 1 là tiêu đề; Mã/Tên bắt buộc. Tên cột nhận nhãn tiếng Việt hoặc khóa registry, không nhận cột lạ hay hai tiêu đề cùng ánh xạ một trường.
- XLSX dùng ô số thật cho giá. CSV dùng dấu chấm thập phân, không dùng dấu phân nhóm hàng nghìn. Giá trị enum nhận mã hoặc nhãn tiếng Việt. Các cột mã/điện thoại/mã số thuế trong mẫu có định dạng văn bản để giữ số 0 ở đầu.
- Không nhận XLS, macro, nội dung nhúng, gộp ô, công thức hoặc liên kết trong ô dữ liệu. Kiểm tra cấu trúc ZIP, giới hạn giải nén thực tế, số trang tính và vị trí dòng/cột trước khi ExcelJS đọc workbook.
- Xem trước không ghi danh mục. Bảng giữ số dòng gốc, chỉ ra dòng sai, mã trùng trong tệp và mã đã tồn tại. Dữ liệu cập nhật hiển thị giá trị cũ → mới. Có thể tải CSV lỗi.
- Lệnh ghi sau chuẩn hóa cũng giới hạn 1 MB. Tệp có nhiều ghi chú dài cần chia nhỏ trước khi nhập.
- Cột không có trong tệp được giữ nguyên khi cập nhật. Ô trống của cột có trong tệp được xử lý theo kiểu/default của trường: trường tùy chọn được xóa; enum/giá có default dùng default; trường bắt buộc trống là lỗi. Tạo mới vẫn phải đủ dữ liệu bắt buộc.

## Chọn và ghi

Dòng mới hợp lệ mặc định được chọn tạo; mã đã tồn tại và dòng lỗi mặc định bỏ qua. Người dùng chọn cập nhật từng dòng hoặc áp dụng cập nhật cho các mã trùng hợp lệ rồi xác nhận tổng số tạo/cập nhật. Không gộp hai dòng cùng mã trong một tệp.

Máy chủ kiểm tra lại schema, quyền và phạm vi. RPC suy ra `tenant_id` từ phiên; cập nhật phải khớp ID, mã và `row_version` đã xem trước. Quy tắc lưu tay vẫn áp dụng, gồm cấm đổi đơn vị cơ sở khi vật tư đã được tham chiếu. Nhập không tự kích hoạt lại danh mục ngừng sử dụng.

Xung đột đã biết được trả riêng từng dòng; dòng thất bại không ghi, dòng hợp lệ vẫn được ghi. Một lỗi bất ngờ hủy giao dịch RPC. UUID yêu cầu và hash payload lưu receipt; nút **Thử lại cùng yêu cầu** gửi nguyên lệnh cũ nếu chưa xác nhận kết quả. Yêu cầu đã nhận không tạo thêm bản ghi hoặc tăng phiên bản lần nữa. Muốn xử lý dòng thất bại, kiểm tra lại tệp để lấy phiên bản mới rồi lập yêu cầu mới.

Lịch sử giữ tên/hash tệp, thời điểm, người thực hiện và kết quả; không lưu bản tệp gốc hay toàn bộ dữ liệu nguồn. Chủ doanh nghiệp xem lịch sử trong tenant; người nhập khác xem lịch sử của mình trong danh mục được phép.

## Quyền và API

Nhập cần quyền đọc ở phạm vi toàn tenant và ít nhất một quyền tạo/sửa danh mục. Mỗi dòng tiếp tục đòi đúng quyền tạo hoặc sửa. Viewer, tài khoản chỉ có phạm vi own/department/projects, module bị tắt và tenant không khả dụng đều bị chặn. Bảng lịch sử có RLS, không cấp truy cập bảng trực tiếp cho anon/authenticated/service_role; chỉ RPC đã kiểm tra phiên được cấp execute cho service_role. ERP nội bộ dùng dữ liệu toàn cục không tham gia luồng này.

Đường dẫn `/api/v1/business/[slug]/imports/[kind]`:

| Phương thức | Dữ liệu | Kết quả |
| --- | --- | --- |
| GET | `view=template` | XLSX một trang tính, private/no-store |
| GET | `view=history` | 20 kết quả gần nhất trong phạm vi được phép |
| POST | multipart, một trường `file` | Xem trước, không ghi danh mục |
| POST | JSON: requestId, fileName, fileHash, rows | Tạo/cập nhật các dòng đã chọn và receipt |

Chưa gồm ánh xạ cột tùy ý, tìm trùng gần đúng, alias/gộp danh mục, nhập chứng từ nhiều dòng hoặc tạo bút toán từ tệp. Những phần này vẫn mở trong 2.02 và các yêu cầu liên quan.
