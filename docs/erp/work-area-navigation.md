# Không gian làm việc trong module — 05/11/2026

Mỗi module có tổng quan và tối đa sáu vùng tác nghiệp chính. Chứng từ liên quan ở cùng vùng, chuyển qua các tab liên kết; danh mục và thiết lập nằm trong mục thu gọn. Registry dùng chung ở `src/config/businessWorkAreas.json`.

Ví dụ mua hàng có hai vùng: nhu cầu → báo giá → lựa chọn nhà cung cấp, và đặt mua → nhận hàng. Dòng đơn mua nằm trong biểu mẫu đơn mua; không chiếm một mục điều hướng chính. Kho có một vùng nhập/xuất, điều chuyển, kiểm kê và một nhóm danh mục vật tư/kho thu gọn. Nhân sự có sáu vùng hồ sơ, công/ca, nghỉ phép, tuyển dụng, đánh giá, văn bản.

`/erp/[slug]/module/[feature]` giữ dashboard hiện hữu. Thêm `?area=...&view=...` mở vùng có bảng, form và thao tác thật của loại chứng từ đã chọn. Thay view remount bảng theo loại chứng từ; trạng thái form không truyền sang loại khác. Liên kết vùng dùng `BusinessLink` để áp dụng cùng kiểm tra rời thay đổi chưa lưu.

Route `/erp/[slug]/[kind]?q=...` vẫn giữ nguyên loại bản ghi và truy vấn. Một deep link vào `purchase_lines` không bị chuyển truy vấn sang đơn mua. Vùng tương ứng được chọn và mục chi tiết mở theo ngữ cảnh. Tìm trong module vẫn tìm được các loại chi tiết.

Nhắc rời chứng từ áp dụng cho liên kết trong ERP và sự kiện tải lại/đóng tab. Luồng Back/Forward trong cùng ứng dụng của trình duyệt chưa được nghiệm thu trong đợt này.

Điều hướng lọc theo ngành, module và quyền đọc trước khi tạo vùng/tab. Vai trò được xem chi tiết nhưng không được xem cha vẫn có đường mở chi tiết; không tự mở quyền xem cha. RPC và API không thay đổi. Các loại chưa đăng ký ở lần nâng cấp sau được giữ trong công cụ phụ thay vì biến mất.

Dashboard tiếp tục hiển thị số liệu, hàng đợi và đối chiếu theo nghiệp vụ. Đã bỏ các dãy liên kết toàn bộ thực thể lặp lại phía trên bảng. Giao diện không thêm mô tả dưới chức năng hoặc điều hướng. Chi tiết kỹ thuật và tiêu chí bàn giao nằm trong tài liệu này.

Thiết kế dùng token hiện có, mục tiêu bấm từ 44 px và điều hướng liên kết có `aria-current`.

## Vùng chứng từ

`BusinessDocumentWorkspace` là khung trình bày không gọi API, không sở hữu trạng thái form. Caller truyền `workspace`, `kind`, `data`, `selected`, `dirty`, các slot tùy chọn `navigation`, `notices`, `summary` và nội dung chính. Form đầu chứng từ và bảng dòng nằm chung trong `children`; tab hỗ trợ chỉ dành cho duyệt, tệp và lịch sử. Tổng hợp chỉ xuất hiện khi caller truyền dữ liệu thật, không tự tạo số 0 hoặc KPI.

Dùng `Drawer size="wide" className={businessDocumentDrawerClassName}` và đặt component là con trực tiếp của Drawer. Khung mã/tên/trạng thái và điều hướng giữ vị trí; `[data-ui="business-document-body"]` cuộn phần làm việc; thanh lưu vẫn dùng `footer` hiện có của Drawer. Desktop rộng tối đa 1440 px, chiều cao theo visual viewport; điện thoại giữ footer và các nút trong vùng nhìn thấy. Không thay đổi overlay dùng chung.

Khung chỉ hiển thị tham chiếu có nhãn đúng với ID hiện tại và được phép đọc. Khi đổi nhà cung cấp, không tái sử dụng nhãn của đối tượng cũ; không đưa UUID lên phần tóm tắt. Các field bị chặn theo vai trò hoặc module tiếp tục bị bỏ qua.

## Checkpoint đầu ngày 05/11/2026

Ngày 05/11/2026: 2.103 test đạt, 37 bỏ qua theo cấu hình; TypeScript và build đạt. Lint không có lỗi, còn năm cảnh báo có sẵn. Preview phát triển có 45 ảnh, 43 kiểm tra ở 390/768/1440 px cho 14 module và ô nhập quy đổi. API trong preview dùng fixture, không ghi dữ liệu và không thay thế nghiệm thu PostgreSQL hoặc cloud. [Bằng chứng giao diện](../commercial-erp/evidence/workareas-local.json).

Bản sửa hiện nằm trong workspace, chưa commit/push hoặc deploy. Bộ duyệt tự động của công cụ hết hạn mức nên dry-run Supabase chưa được thực thi. Kiểm chứng PostgreSQL đầy đủ của migration đơn vị còn mở; không công bố migration đã đạt hoặc 82 yêu cầu đã hoàn tất. [Checkpoint](../commercial-erp/evidence/workareas-checkpoint.json).

## Cập nhật kiểm chứng ngày 05/11/2026

Checkpoint trên là trạng thái trước khi khôi phục khả năng thực thi. Đợt tiếp theo hoàn thiện [nội dung chứng từ và nhận hàng](document-workspace.md): thông tin chung và bảng dòng nằm chung, trình nhập dòng mở khi cần, dữ liệu đã phát hành trình bày chỉ xem, nhận một phần ngay trong đơn mua. Thanh nút được kiểm tra từng nút ở màn hình 390×620; focus sau lưu đưa ô nhập dòng vào vùng nhìn thấy.

Đã đạt 2.161 unit test (37 bỏ qua), 22 bộ kiểm chứng PostgreSQL trên 105 migration/142 thực thể, gồm 32 quy tắc đơn vị giao dịch và sáu kiểm tra nâng cấp dữ liệu cũ. Migration `202611040001` đã áp dụng lên Supabase phát triển; tổng 162 migration, sáu doanh nghiệp và 18 tài khoản giữ nguyên. Dấu kiểm bốn bảng giao dịch, số bút toán, tổng Nợ/Có, audit và command trước/sau không đổi. Xem [bằng chứng SQL](../commercial-erp/evidence/document-interior-native.json) và [receipt nâng cấp](../commercial-erp/evidence/document-interior-cloud-upgrade.json). Trạng thái công bố ứng dụng được ghi riêng trong receipt phát hành; các kiểm tra này không đóng toàn bộ 82 yêu cầu.
