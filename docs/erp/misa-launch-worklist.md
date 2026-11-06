# Hoàn thiện sản phẩm theo 82 yêu cầu — 03/11/2026

Nguồn yêu cầu: [ma trận 82 mục](misa-requirements.json). Mục tiêu là đi hết luồng sử dụng, gồm phân quyền, trạng thái, đối soát, lịch sử, lỗi/thử lại, xuất chứng từ và giao diện. Không chuyển một mục thành hoàn tất chỉ từ schema, CRUD, ảnh chụp hoặc HTTP 200.

Người dùng đã chọn **mô phỏng** hóa đơn điện tử, chữ ký số, ngân hàng và email ngày 03/11/2026. Các luồng này phải giữ dấu mô phỏng trên giao diện/chứng từ/receipt, có trạng thái và xử lý lỗi thực trong ứng dụng; không gửi ra nhà cung cấp thật và không xác nhận giá trị pháp lý. Nghiệm thu demo và kết nối live được ghi riêng.

## Thứ tự xử lý

| Luồng | Việc cần hoàn thiện | Liên quan |
| --- | --- | --- |
| Nhập chứng từ | Giữ form sau lưu; ngày hợp lý; cấp số giao dịch; dòng hàng trong cùng chứng từ; lịch sử; in PDF; tiếp tục bước duyệt | C02/C04/C07, 22 biểu mẫu |
| Phân quyền và riêng tư | Quyền sửa chứng từ cha khi sửa chi tiết; trường nhạy cảm và dữ liệu lương suy diễn; file/export/search/report; owner/editor/viewer | C01/C03/H02/H04/H05 |
| Mua và kho | Đơn vị/hệ số được snapshot trên giao dịch; yêu cầu → báo giá → PO → nhận → hóa đơn → công nợ/chi; trả hàng; kiểm kê và tồn theo ngày | O03/O04, E2E-02/03, GRN/ISSUE/COUNT |
| Công trình và sản xuất | Hợp đồng → dự án/WBS/ngân sách/task → nghiệm thu → thu; BOM có hiệu lực và snapshot; vật tư/phế phẩm/QC/nhập thành phẩm/giá thành | O01/O02/O05/F03, E2E-01/06/07/10 |
| Nhân sự | Tiếp nhận → hợp đồng/HSE/phân công → ca/công → lương/thuế/phân bổ; hiệu lực lịch sử và sửa kỳ khóa; phiếu lương riêng tư | H01–H06, E2E-04/05/09 |
| Tài sản và quỹ | Bàn giao → bảo trì → thu hồi/ghi giảm; phân bổ; kiểm kê quỹ; phân tách kế toán/thủ quỹ; đối chiếu ngân hàng | O06/F01/F02, E2E-08 |
| Mô phỏng tích hợp | Hóa đơn điện tử, ký số, ngân hàng, email: request/receipt, lỗi, retry, phản hồi, chống lặp và dấu mô phỏng | C05/C06/F04, E2E-11 |
| Vận hành và nghiệm thu | Mở mới doanh nghiệp/cấu hình/số dư; 12 E2E có actor; giao diện ba kích thước; kiểm tra 82 mục; handoff, backup/restore và tài liệu dùng | Toàn bộ |

## Phát hiện và thay đổi đang thực hiện

- Một số chứng từ nền (`purchase_orders`, `sales_orders`, `boms`, `work_orders`, `salary_runs`) thiếu metadata nối phần chi tiết trong registry. Đã bổ sung vào cả registry và migration đang kiểm tra.
- Lưu chứng từ trước đây đóng form ngay. Luồng mới giữ mở, tải lại bản ghi đã lưu và chỉ cho tiếp tục khi có phiên bản xác nhận. Nếu POST thành công nhưng đọc lại lỗi, nút tải lại chỉ GET, không gửi lại lệnh tạo.
- Cấp số được thực hiện trong giao dịch lưu, tách theo doanh nghiệp/loại/năm, dùng receipt hiện có để chống lặp; lỗi lưu rollback cả số. Mã tự nhập vẫn được hỗ trợ.
- Dòng chứng từ nền được chặn sửa/bỏ sau phát hành; sửa dòng làm đổi phiên bản cha và mất duyệt cũ. Đơn tự sinh được lắp phần đầu/chi tiết rồi phát hành trong cùng giao dịch.
- RPC đọc chi tiết áp dụng che trường theo vai trò và không loại nhầm chi tiết có trạng thái nháp/đã ghi nhận như người tham dự cuộc họp.
- Chọn lại giá trị hiện tại ở Select không phát sự kiện thay đổi, tránh kẹt trạng thái tải.

Các migration `202611030001`–`202611030009` đã áp dụng lên Supabase phát triển ngày 03/11/2026, tổng 161 migration, không đổi dữ liệu hiện có. PostgreSQL cục bộ đầy đủ, các luồng ghi trên trình duyệt, PDF/tệp và bốn dịch vụ mô phỏng đã được kiểm chứng. Chi tiết và giới hạn kiểm tra ở [bản chứng từ và mô phỏng](../commercial-erp/misa-document-workspace.md). Đã push GitHub và deploy Vercel commit `e6cb821`. [Receipt](../commercial-erp/evidence/misa-document-workspace-release.json) xác nhận READY, 84 ảnh/18 biểu mẫu trên Vercel và 18 tài khoản đúng vai trò.

## Đợt kiểm chứng ngày 03/11/2026

Đã kiểm chứng 28 quy tắc chứng từ và 30 quy tắc mô phỏng trên SQL thật; trình duyệt đi qua đơn mua, tệp riêng tư, phát hành, đề nghị thanh toán duyệt hai người, phiếu ngân hàng, email/hóa đơn/ký mô phỏng và lịch sử ở ba kích thước. Không đóng toàn bộ 82 yêu cầu từ bằng chứng này.

## Việc tiếp theo đang mở

- Snapshot đơn vị/hệ số quy đổi trên từng giao dịch; alias/ghép danh mục và lịch sử sử dụng.
- Danh mục đơn vị/phòng ban/chức danh, lịch sử hiệu lực và tác động đến phạm vi truy cập khi điều chuyển.
- Kiểm tra sâu các nguồn suy diễn lương trên sổ, ngân hàng và báo cáo; mở rộng quyền theo nhiệm vụ thực tế.
- Hoàn trả/điều chỉnh và đối chiếu chi tiết mua–nhận–hóa đơn–chi; phân tách kế toán/thủ quỹ và kiểm kê quỹ.
- Hoàn thiện các tiêu chí còn thiếu của 12 E2E, form version migration, báo cáo tùy biến và kiểm chứng vận hành/khôi phục. Tiếp tục đối chiếu từng tiêu chí của 82 mục, không dùng số test hoặc ảnh để thay cho nghiệm thu.

## Checkpoint ngày 05/11/2026 — gom vùng làm việc

Theo phản hồi người dùng, 14 module được tổ chức theo vùng tác nghiệp: chứng từ liên quan dùng chung màn hình và tab, dòng chi tiết nằm theo chứng từ, danh mục/thiết lập thu gọn. Deep link và bộ lọc cũ được giữ; chuyển loại bản ghi remount form và nhắc trước khi rời chứng từ chưa hoàn tất. Xem [thiết kế và kiểm chứng](work-area-navigation.md).

Đã viết ứng viên snapshot đơn vị cho đơn mua/đơn bán, nhận hàng và phiếu kho, cùng UI nhập trực tiếp. Kiểm tra giao diện dùng fixture đã đạt; bộ kiểm chứng PostgreSQL chưa hoàn tất và migration chưa áp dụng lên cloud. Alias/ghép danh mục, các giao dịch khác và nghiệm thu toàn luồng mua–kho vẫn mở. Mã hiện chưa commit/push/deploy vì công cụ duyệt hành động hết hạn mức.

## Đợt tiếp theo ngày 05/11/2026 — nội dung chứng từ

Đã mở rộng phần bên trong: đầu chứng từ và dòng nằm cùng vùng, nhóm trường theo nghiệp vụ, nhập/sửa dòng theo thao tác chủ đích, thành tiền từ dữ liệu đã lưu, dạng chỉ xem khi phát hành. Nhận một phần và sửa phiếu nhận nháp được thực hiện trong đơn mua; lưu/ghi nhận đều đọc xác nhận bằng GET. Bản nháp đầu chứng từ được giữ khi dòng ngoài phiên thay đổi; chỉ nhận phiên bản cha sau khi đọc lại dữ liệu, tránh dùng phiên bản mới với nội dung cũ. Định khoản và nhận hàng cũng tham gia kiểm tra dữ liệu chưa lưu. [Chi tiết giao diện và giới hạn](document-workspace.md).

Đã vượt qua điểm chặn thực thi của checkpoint trước: hồi quy SQL đủ 22 bộ trên 105 migration/142 thực thể, 32 kiểm tra giao dịch quy đổi và sáu kiểm tra nâng cấp. Migration `202611040001` đã nâng Supabase phát triển từ 161 lên 162, giữ nguyên dữ liệu giao dịch và 18 tài khoản. Xem [SQL](../commercial-erp/evidence/document-interior-native.json), [nâng cấp](../commercial-erp/evidence/document-interior-cloud-upgrade.json). Snapshot cho bốn loại giao dịch đã có bằng chứng; alias/ghép danh mục, các loại khác, đối chiếu số lượng còn nhận theo từng vật tư và toàn bộ tiêu chí mua–kho vẫn mở.
