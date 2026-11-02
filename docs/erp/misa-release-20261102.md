# Bản cập nhật MISA và giao diện ERP — 02/11/2026

Đích ứng dụng: `https://dimixo-erp.vercel.app`. Đích database: project phát triển `tcjjhxqtreemccdbvyza`. Sáu doanh nghiệp và dữ liệu đi kèm là mẫu mô phỏng; dữ liệu khách hàng phải nằm trong tenant riêng. Hai project ERP nội bộ được bảo vệ không được cập nhật.

## Phần đã chuẩn bị phát hành

- Cổng ứng dụng đặt trước dashboard, có tìm kiếm; thẻ module phẳng, icon và màu dùng token chung.
- Menu nghiệp vụ có bộ lọc và mở/đóng trên điện thoại; menu tài khoản dùng component chung. Tìm kiếm bản ghi hỗ trợ di chuyển bàn phím, giữ kết quả khi focus vào liên kết và đóng bằng Escape.
- Bố cục tiêu đề, bảng, form, số liệu và báo cáo chất lượng được thống nhất; loại bỏ nền chuyển động trong workspace và thu gọn hộp thư duyệt rỗng.
- Các migration phê duyệt, tệp đính kèm, giao việc, hồ sơ nhân viên, đề nghị thanh toán, HSE, tuyển dụng, KPI, kho tài liệu, lịch họp, tìm kiếm và quy đổi đã áp dụng trên database phát triển.
- Sửa quyền mặc định còn sót của thông báo/trigger; sửa tham chiếu đối tác trên đề nghị thanh toán; sửa volatility của các RPC có khóa/cập nhật phiên để chúng hoạt động đúng qua PostgREST.

## Bằng chứng

- [Readiness](../commercial-erp/evidence/misa-release-readiness.json): build, lint phạm vi business, 1.680 test qua và 37 test live tùy chọn bỏ qua; 33 màn hình ở 390/768/1440px không có lỗi JavaScript, lỗi API hoặc tràn ngang. Năm tương tác đã qua: lọc ứng dụng, menu điện thoại, quy đổi, trường đối tác và tải CSV.
- [Rollout](../commercial-erp/evidence/misa-feature-rollout.json): 32 migration, từ 118 lên 150; giữ nguyên số lượng tài khoản/nhân sự/vật tư/chứng từ và tổng bút toán. 33 bảng mới có RLS, không cấp quyền bảng trực tiếp; bucket tệp riêng tư.
- [PostgreSQL native](../commercial-erp/evidence/industry-schema-build.json): 93 migration trong bộ biên dịch business, 142 thực thể; mô phỏng quyền mặc định Supabase, kiểm tra volatility RPC và các luồng synthetic liên phân hệ.
- [Tài khoản](../commercial-erp/evidence/misa-account-verification.json): 18 tài khoản mẫu đăng nhập, đúng tenant/vai trò và đăng xuất thành công. Tệp mật khẩu bàn giao nằm riêng trong `.tmp`, bị Git bỏ qua.

Các kiểm tra trình duyệt đọc dữ liệu mẫu và mở form; không lưu chứng từ. Chúng bổ sung cho synthetic E2E và không chứng minh mọi trường hợp nghiệm thu trong ma trận.

## Phạm vi còn mở

Ma trận 82 yêu cầu vẫn được quản lý tại [misa-requirements.json](misa-requirements.json). Không đánh dấu toàn bộ MISA hoàn tất từ kết quả build hoặc số lượng form.

Còn các nghiệp vụ chưa hoàn chỉnh như nhập Excel/xử lý xung đột từng dòng, alias/gộp trùng, snapshot quy đổi trên các dòng giao dịch, báo cáo tùy biến/XLSX/PDF/lịch sử xuất và các trường hợp chốt kỳ/điều chỉnh nêu trong từng yêu cầu. Ngân hàng, hóa đơn điện tử, chữ ký số, BHXH/thuế và phản hồi cơ quan tiếp nhận cần nhà cung cấp, credentials và cấu hình thực tế. Các tham số lương/thuế/bảo hiểm phải được đối chiếu theo hồ sơ vận hành trước khi dùng cho giao dịch thật.

Bằng chứng deployment cuối cùng sẽ ghi URL, deployment ID, commit và kết quả kiểm tra sau phát hành. Tài liệu này không xác nhận hệ thống đã đáp ứng toàn bộ chế độ kế toán hoặc mọi tiêu chí của 82 yêu cầu.
