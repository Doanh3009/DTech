# Hoàn thiện kế toán và giao diện — 17/10/2026

## Thay đổi

- Sidebar cách mép 12 px, bo đủ bốn góc 22 px; document và workspace dùng chung canvas để không lộ dải trắng ở góc hoặc cạnh. Menu, tooltip và cuộn giữ lớp hiển thị riêng.
- Chuyển trang có kiểm tra native/fallback và chế độ giảm chuyển động; fallback không làm mất DOM hoặc dữ liệu đang nhập. Có liên kết bàn phím đến nội dung chính.
- Dashboard kế toán dùng lương đã chốt trong sáu tháng đến tháng nghiệp vụ hiện tại; không dùng các kỳ test năm 2091–2099 làm xu hướng hiện tại, không tạo điểm dữ liệu thay cho tháng thiếu.
- Biểu đồ tiếp nhận phiếu dùng kỳ đã phát hành gần nhất đến tháng hiện tại, tách chưa xem / đã xem chờ xác nhận / đã xác nhận. Nhãn và bảng số liệu mở đúng bộ lọc.
- Danh sách việc kế toán đọc mọi kỳ chưa hoàn tất, cả kỳ đã khóa chưa gửi và kỳ đã phát hành còn lỗi/chờ gửi thông báo; không chỉ đọc năm kỳ mới nhất.
- Workspace lương có dữ liệu đầu vào từng nhân viên, dự tính theo căn cứ công, tính/điều chỉnh, xác nhận kiểm tra, khóa, phát hành riêng/hàng loạt và biên nhận gửi. Đổi công/hồ sơ lương làm hiện yêu cầu tính lại; không đánh dấu mọi bước hoàn thành khi dữ liệu đã cũ.
- Gửi hàng loạt chặn nhân viên thiếu tài khoản trước khi phát hành. Trigger ghi hàng đợi cùng transaction với snapshot; lỗi giao thông báo/chat được lưu và gửi lại với khóa chống trùng. Phiếu đã phát hành, đã gửi, đã xem và đã xác nhận được trình bày riêng.
- Phiếu lương lọc tháng, mỗi nhân viên một phiếu hiệu lực, lịch sử phiên bản mở riêng, phân trang 20. Chi tiết tách thực nhận / thu nhập / khấu trừ / phép dư / căn cứ tính. Điện thoại đặt xác nhận và PDF gần thực nhận, giữ bộ lọc khi quay lại.

## Kiểm chứng trước triển khai

- TypeScript, ESLint và bộ Vitest toàn workspace được kiểm tra lại ngày 17/10; kết quả cuối trong biên nhận triển khai.
- 35 kiểm tra PostgreSQL thật trong transaction ROLLBACK: atomic publication, lỗi cưỡng bức, thiếu người nhận, chống trùng, claim giới hạn 40, lease, retry, thu hồi và quyền service-only.
- Migration `202610160002_payslip_delivery_outbox.sql` đã áp dụng TEST, tổng 52 migration; không tạo hàng đợi cho phiếu cũ và không thay đổi số nhân viên/hồ sơ lương/bảng lương/phiếu/tin nhắn/thông báo hiện có.
- 8 trạng thái dashboard, 28 trạng thái phiếu lương, 40 trạng thái quy trình lương với component thật ở 320/390/768/1440 px. Luồng lương có 32 thao tác API mô phỏng, bao gồm lỗi lưu giữ nội dung và gửi lại sau lỗi.
- Trang fixture và generated type riêng đã gỡ trước build. Kiểm tra live sau triển khai được ghi riêng, không dùng ảnh inject CSS để kết luận bản mới đã triển khai.

## Giới hạn và nghiệp vụ cần giữ rõ

- Công thức hiện tại tính lương theo công thực tế hoặc công thực tế cộng phép/công tác, với phụ cấp/thưởng/khấu trừ từ hồ sơ và điều chỉnh kế toán có lý do. Chưa tự suy ra công thức thuế, OT hoặc BHXH doanh nghiệp chưa cung cấp.
- Đã gửi thông báo không có nghĩa đã chuyển tiền. Biên nhận cũ chưa tồn tại được ghi rõ, không suy ra đã giao.
- Worker dùng batch và lease; khi kết nối hoặc chức năng bị gián đoạn, hàng đợi còn lại có thể gửi lại từ workspace. Không có cron tự gửi được cấu hình trong thay đổi này. Mốc 20 giây kiểm tra giữa batch, không phải timeout cứng cho từng kết nối Supabase.
- Bằng chứng browser dùng Chrome với viewport mô phỏng; chưa thay thế UAT thiết bị iOS/Android vật lý và nghiệp vụ giao dịch của mọi module.

Chi tiết: [phiếu lương](payslip-workspace-review-20261016.md), [SQL giao phiếu](payslip-delivery-sql-review-20261016.md), [shell và motion](shell-polish-review-20261016.md).


## Kết quả triển khai

- READY `dpl_GrGWNUuq9SDA1zJPtSeYuSyY4CMr`, https://ct-noi-bo-test-chau-tuan.vercel.app; source SHA `1d3dd4577374b10d9c783c11233a6fd94e417163c1642e8e9c9c0980cf9fe94a`. TEST 52 migration; production giữ nguyên.
- 1016 test đạt; TypeScript/ESLint/build đạt. 24 kiểm tra health/alias/API và 5 kiểm tra API kế toán đạt.
- 76 trạng thái fixture và 154 trạng thái live đạt; không tràn/cắt nút hoặc lỗi JavaScript/API nghiệp vụ trong các màn hình đã kiểm tra.
- Đã bấm mở chi tiết lương từng nhân viên, các bước xử lý, lịch sử phiên bản phiếu; kiểm tra bốn viewport 320/390/768/1440 và hai chế độ chuyển động. Không xác nhận hoặc phát hành phiếu thật khi audit.
- Lượt kiểm tra thực tế phát hiện và sửa nhãn nút hành động bảng lương bị cắt; bản cuối dùng nhãn Mở cùng nhãn truy cập đầy đủ.
- Biên nhận: [accounting-completion-deployment-20261017.json](operations/accounting-completion-deployment-20261017.json).
