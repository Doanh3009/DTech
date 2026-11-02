# Bản cập nhật MISA và giao diện ERP — 02/11/2026

Đích ứng dụng: `https://dimixo-erp.vercel.app`. Đích database: project phát triển `tcjjhxqtreemccdbvyza`. Sáu doanh nghiệp và dữ liệu đi kèm là mẫu mô phỏng; dữ liệu khách hàng phải nằm trong tenant riêng. Hai project ERP nội bộ được bảo vệ không được cập nhật.

## Phần đã phát hành

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

Bằng chứng deployment cuối cùng đã ghi URL, deployment ID, commit và kết quả kiểm tra sau phát hành. Tài liệu này không xác nhận hệ thống đã đáp ứng toàn bộ chế độ kế toán hoặc mọi tiêu chí của 82 yêu cầu.

## Bản vá trước bàn giao

Đã cập nhật Next.js lên `16.4.3`, Zod lên `4.6.7` và các dependency bắc cầu tương thích. Chuyển schema record sang khóa chuỗi tường minh, sửa truy cập schema CRM và giữ nguyên ngữ nghĩa PATCH nhân sự: trường trạng thái không gửi lên thì không tự nhận mặc định `active`. Bộ kiểm tra hồi quy hiện có xác nhận lệnh rỗng bị từ chối và nhân sự đã nghỉ việc không bị đổi trạng thái khi sửa thông tin khác.

Build, TypeScript, lint phạm vi sửa và 1.680 test đã qua; 37 test live tùy chọn bỏ qua. Kiểm tra 159 client artifact không thấy secret. Audit dependency runtime không còn mức high/critical; vẫn còn chín cảnh báo moderate trong chuỗi ExcelJS, chưa coi là đã xử lý toàn bộ bảo mật dependency. Chi tiết và nguồn advisory nằm trong [bằng chứng bản vá](../commercial-erp/evidence/misa-security-release.json).

## Kết quả triển khai

Đã push commit [`c847c8b`](https://github.com/Doanh3009/DTech/commit/c847c8b8b901f2a54b6897db2063fce0e5cffdbf) lên nhánh `feature/commercial-erp-p0-audit` và deploy tại [DIMIXO ERP](https://dimixo-erp.vercel.app). Deployment `dpl_ANFxh8FaSAXuMSgsCCVyNvAeKn4C` ở trạng thái READY, Node 24.x, vùng Singapore; alias trỏ đúng deployment và metadata khớp commit nguồn.

Kiểm tra sau deploy: health/live, health/ready, trang chủ và đăng nhập HTTP 200; 12 API đọc HTTP 200; 33 màn hình trên 390/768/1440px không lỗi JavaScript/API, không tràn ngang; năm tương tác đã qua; cả 18 tài khoản của sáu tenant đăng nhập, đọc đúng vai trò và đăng xuất thành công. Kiểm tra trình duyệt dùng dữ liệu mẫu và không lưu chứng từ nghiệp vụ. [Biên bản phát hành](../commercial-erp/evidence/misa-vercel-release-20261102.json) ghi chi tiết.

Tài khoản/mật khẩu ở tệp riêng `.tmp/DIMIXO-ban-giao-tai-khoan.md`, không có trong GitHub. Đây là bản chạy trên môi trường phát triển với doanh nghiệp mô phỏng; phạm vi còn mở ở trên vẫn áp dụng trước khi nghiệm thu vận hành thật.

## Nhập danh mục CSV/XLSX

Bổ sung nhập vật tư, đối tác và kho với mẫu XLSX, xem trước từng dòng, chọn tạo/cập nhật/bỏ qua, hiển thị giá trị cũ → mới, CSV lỗi, receipt thử lại và lịch sử nhập theo tenant. Migration `202611020014` đã áp dụng trên môi trường phát triển, tổng 151 migration; dữ liệu cũ và 18 tài khoản giữ nguyên. [Hướng dẫn và giới hạn](catalog-import.md), [bằng chứng kiểm chứng](../commercial-erp/evidence/misa-catalog-import-release.json). Phạm vi này chưa hoàn tất toàn bộ 2.02 hay ma trận 82 yêu cầu.
