# Quyết toán phép dư cuối năm

## Nghiệp vụ đã chốt

- Phép dư không chuyển sang năm mới.
- Nhân sự nhập đơn giá tiền/ngày riêng theo nhân viên, loại phép và năm tại `/leave/settlements`.
- Số tiền = làm tròn VND (số ngày còn lại × đơn giá Nhân sự đã nhập).
- Đây là khoản thu nhập riêng trong bảng lương tháng 12, chi tiết nhân viên, phiếu lương, PDF và Excel. Excel có sheet căn cứ gồm năm, loại phép, số ngày, đơn giá và thành tiền.
- Thực nhận vẫn dùng các khoản khấu trừ của bảng lương hiện hành. Không tự đặt chính sách thuế, BHXH hay đơn giá từ lương cơ bản.

## Tự động

Job `ct-leave-year-end-cashout` chạy hằng ngày lúc **00:05 giờ Việt Nam**. Khi năm đã kết thúc, job xử lý bảng lương tháng 12 ở trạng thái đã tính hoặc đã kiểm tra. Tính/tính lại bảng lương cũng dùng cùng hàm quyết toán.

Job sử dụng Supabase Cron (`pg_cron`), lịch GMT `5 17 * * *`. Tài liệu cấu hình: [Supabase Cron quickstart](https://supabase.com/docs/guides/cron/quickstart). Lịch đã được xác nhận active trên database TEST `lgmlkagcytfjazulgfbz` ngày 15/10/2026.

| Trường hợp | Kết quả |
| --- | --- |
| Năm chưa kết thúc | Chỉ dự tính; không trừ phép hoặc cộng tiền |
| Chưa có đơn giá hoặc tiền làm tròn bằng 0 | Chờ Nhân sự nhập/sửa đơn giá |
| Còn đơn nghỉ chờ duyệt cùng loại phép trong năm | Chờ xử lý đơn nghỉ |
| Chưa có kỳ lương tháng 12 hoặc nhân viên chưa có dòng lương | Chờ lập/tính bảng lương |
| Bảng lương đã khóa hoặc đã phát hành | Không tự sửa; cần mở lại rồi tính lại |
| Đủ điều kiện | Lưu căn cứ, ghi giảm phép và cộng tiền trong cùng transaction |
| Chạy lặp | Không tạo lại khoản tiền hoặc ghi giảm lần nữa |

Nhân viên không có dòng trong bảng lương tháng 12 không được tự thêm vào roster. Quyết toán khi nghỉ việc giữa năm chưa thuộc luồng này.

## Bảo toàn dữ liệu

- Unique theo nhân viên + loại phép + năm; khóa kỳ lương và khóa số dư nhân viên khi quyết toán.
- Đơn giá có expected version, quyền `leave.balance.adjust` và audit. Quyền xem toàn bộ dùng `leave.balance.view_all`.
- Căn cứ gồm số ngày, đơn giá, phiên bản, người/ngày nhập, lý do và loại phép.
- Sau khi đã vào bảng lương, đơn giá và số dư đã quyết toán không được sửa/hoàn phép ngược. Điều chỉnh tài chính tiếp theo cần quy trình bổ sung được doanh nghiệp chốt; không tự xóa lịch sử quyết toán.
- Tính lại lương giữ khoản quyết toán và căn cứ, sửa thưởng thường không ghi đè tiền phép.
- Database lưu `bonus` bao gồm `leave_cashout_amount` để giữ công thức `net_salary` generated hiện có. DTO tách thưởng thường và tiền phép; UI, PDF, XLSX không cộng hai lần.
- Phát hành phiếu lương là phát hành chứng từ, chưa phải xác nhận chuyển tiền ngân hàng.

## Kiểm tra ngày 15/10/2026

- Migration 002 + fixture thực trên TEST bằng transaction ROLLBACK: thiếu đơn giá, quyền, stale version, đơn chờ duyệt, 5,5 ngày × 300.000 = 1.650.000 đồng, số dư về 0, chạy lặp, tính lại, sửa thưởng thường, khóa đơn giá/số dư sau quyết toán, giữ snapshot phiếu lương và bỏ qua kỳ đã khóa.
- Migration 003: 29 kiểm tra điểm danh công trường/XNK. Migration 004: 16 kiểm tra BHXH, có lỗi cưỡng bức giữa giao dịch.
- Ba migration áp dụng TEST, tổng 49 migration. Không seed/reset, không thay database hoặc alias production.
- Chạy khởi tạo job sau áp dụng: `settlementsAdded = 0`; TEST chưa có số dư thuộc năm đã kết thúc. Dữ liệu giả lập quá khứ đã rollback.
- Biên nhận chi tiết: `.tmp/business-migration-preflight-report.json`, `.tmp/test-business-migrations-20261015.json`.
- Bản test đã deploy READY: `dpl_CKA5WcXq8JTzB8ihJYF9EUTuvoHT`, [trang quyết toán](https://ct-noi-bo-test-chau-tuan.vercel.app/leave/settlements). 24 kiểm tra health/alias/API đạt; trang và cửa sổ đơn giá kiểm tra trực tiếp 390/1440px không tràn hoặc cắt nút.
