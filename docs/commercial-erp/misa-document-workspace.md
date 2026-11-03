# Chứng từ và dịch vụ mô phỏng — 03/11/2026

Người dùng chọn mô phỏng hóa đơn điện tử, chữ ký số, ngân hàng và email. Chức năng này chỉ mở ở doanh nghiệp có `is_demo = true`. Yêu cầu, lỗi, lần thử lại, phản hồi và biên nhận được lưu trong PostgreSQL. Không có kết nối nhà cung cấp hoặc gửi email thật.

## Sử dụng

1. Tạo chứng từ, nhập tên, đối tượng và ngày; để trống số để hệ thống cấp khi lưu thành công.
2. Lưu nháp. Cửa sổ giữ mở; chứng từ có dòng hàng chuyển sang **Chi tiết**. Thêm dòng, tệp và biểu mẫu trước khi trình duyệt.
3. Mở **Duyệt & ghi nhận**. Người được giao duyệt dùng tài khoản của mình; chứng từ tài chính không cho người lập tự duyệt. Phát hành hoặc ghi sổ khi đủ điều kiện.
4. Mở **Mô phỏng**, chọn dịch vụ và kịch bản. Email yêu cầu địa chỉ xem trước. Chờ thử lại hoặc chờ phản hồi được xử lý bằng nút trên đúng yêu cầu đã lưu.
5. Xem **Lịch sử**, tải PDF chứng từ hoặc biên nhận mô phỏng. PDF và biên nhận có dấu trải nghiệm/mô phỏng.

Kỳ kế toán phải được mở trước ngày hạch toán. Khi sang tháng mới, chủ doanh nghiệp mở kỳ trong **Kỳ kế toán**. Không tự mở kỳ khi ghi sổ.

## Hành vi đã kiểm chứng

- Số chứng từ tách theo doanh nghiệp, loại và năm; lỗi lưu không tiêu thụ số. Lệnh thử lại giữ nguyên UUID và trả lại receipt, kể cả khi chứng từ đã đổi trạng thái.
- Đơn mua, đơn bán, BOM, lệnh sản xuất và bảng lương có chi tiết ngay trong chứng từ. Sửa dòng kiểm tra quyền cập nhật cha, làm đổi phiên bản cha và bỏ duyệt/tính cũ. Dòng đã phát hành bị khóa.
- Lưu thành công nhưng đọc lại lỗi chỉ hiện **Tải lại chứng từ**. Thao tác này đọc lại, không tạo thêm chứng từ.
- Nguồn thanh toán, nguồn khắc phục và hồ sơ ký được chọn bằng số/tên. Máy chủ kiểm tra doanh nghiệp, module, trạng thái và phạm vi đọc; nhãn tham chiếu cũng tuân theo phạm vi.
- Người xem bị chặn dữ liệu bảng lương, trả lương, thuế lương cá nhân và hồ sơ tuyển dụng; khi che lương gốc cũng bỏ snapshot có thể suy diễn số lương.
- PDF dùng phông tiếng Việt, dữ liệu được phép đọc và dòng định khoản được phép xem. Lịch sử không trả payload hay chi tiết audit thô; nội dung lý do được che với người xem.
- Ngân hàng mô phỏng tạo dòng sao kê có mã `SIM-…` từ bút toán ngân hàng đã ghi sổ, không tạo bút toán thu/chi thứ hai. Có thể tiếp tục đối chiếu sao kê theo luồng hiện có.
- Ký mô phỏng lưu kết quả `simulated_signed` trong biên nhận riêng; không ghi `signed` hoặc tạo tệp chữ ký pháp lý trong outbox nhà cung cấp thật.

## Kiểm chứng

- PostgreSQL cục bộ: 104 migration, 142 entity; bộ kiểm tra đầy đủ về vận hành, công, lương, nhân sự, tuyển dụng, KPI, kho, CRM, tài liệu, tìm kiếm, nhập danh mục và quyền. Phần chứng từ mới có 28 kiểm tra; mô phỏng có 30 kiểm tra, gồm 16 kịch bản của bốn dịch vụ.
- Trình duyệt ghi dữ liệu: Next.js thật → cầu nối HTTP loopback → RPC PostgreSQL thật với role `service_role`, giao dịch và quyền thực. Tệp riêng tư được lưu/đọc byte trong thư mục cục bộ và kiểm tra SHA-256. Đây không phải kiểm chứng dịch vụ PostgREST/Storage cloud. Ảnh ở 390/768/1440 px; có thử mất phản hồi sau khi máy chủ đã ghi nhận.
- Unit: 2.053 đạt, 37 bỏ qua theo cấu hình tích hợp. Typecheck và build đạt. Lint không có lỗi, có 5 cảnh báo đã tồn tại. Kiểm tra 159 artifact phía trình duyệt không tìm thấy secret.
- Supabase phát triển: migration `202611030001`–`202611030009`, tổng 161 migration. So sánh trước/sau giữ nguyên số bản ghi và các tổng kiểm soát của dữ liệu hiện có, sổ cân đối; RPC mới chỉ cho máy chủ thực thi, bảng riêng không có quyền truy cập trực tiếp.

Bằng chứng: [kiểm tra schema](evidence/industry-schema-build.json), [kiểm tra trình duyệt](evidence/misa-document-workspace-browser.json), [triển khai database](evidence/misa-document-workspace-rollout.json).

## Phạm vi còn mở

Đây là một đợt hoàn thiện trong [82 yêu cầu](../erp/misa-requirements.json), chưa phải xác nhận nghiệm thu toàn bộ 82 mục. Cơ cấu tổ chức/lịch sử, quy đổi đơn vị trên từng giao dịch, các điều chỉnh và đối chiếu chuyên sâu, báo cáo tùy biến và kiểm chứng vận hành vẫn được theo dõi ở [danh sách hoàn thiện](../erp/misa-launch-worklist.md). Kết nối nhà cung cấp thật không thuộc phạm vi mô phỏng người dùng đã chọn.
