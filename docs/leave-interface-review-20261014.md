# Giao diện nghỉ phép — 14/10/2026

## Luồng đang sử dụng

Nhân sự cấp phép theo quyết định đã có. Nhân viên lưu nháp, sửa và gửi đơn. Đơn đang chờ làm giảm phần khả dụng; duyệt bước cuối mới ghi sử dụng vào sổ phép. Thu hồi và hủy tuân theo quyền và chính sách. Hủy đơn đã duyệt hoàn đúng số ngày đã ghi trừ.

Quản lý theo dõi lịch nghỉ theo tháng, chọn ngày để xem từng nhân viên, buổi nghỉ và trạng thái. Danh sách đơn có phòng ban, loại nghỉ, trạng thái, tìm kiếm và phân trang. Người quản lý trực tiếp xem phạm vi nhóm; nhân sự có quyền toàn công ty xem phạm vi toàn công ty.

## Thay đổi giao diện

- Số dư nhân viên: một dòng cho mỗi nhân viên theo loại phép đang chọn; tách đã cấp, chuyển năm, điều chỉnh, đã dùng, chờ duyệt, còn lại và khả dụng. Loại cùng tên được phân biệt bằng mã.
- Chi tiết nhân viên mở trong drawer, có sổ phép và lịch sử đơn của năm đã chọn. Bảng số dư không gộp ledger của các loại có ID khác nhau.
- Cấp phép có chọn nhiều nhân viên; điều chỉnh có lý do, ngày hiệu lực và số dư dự kiến. Tải nhân viên bằng endpoint phân quyền nghỉ phép riêng.
- Quy trình duyệt có tạo/sửa, chọn tài khoản hoặc vai trò thực, thêm/xóa/đổi thứ tự bước. Cấu hình và phiên bản published của nền tảng phê duyệt chung được lưu trong cùng transaction.
- Chi tiết đơn và duyệt hoạt động theo quyền trên điện thoại. Các quyết định mở xác nhận; từ chối/hủy cần lý do. Có sửa đơn nháp và xuất PDF theo quyền.
- Trạng thái kỳ công đã khóa và bảng lương đã phát hành hiển thị các bước đã hoàn tất.

## Kiểm tra và bằng chứng

Ảnh và báo cáo bố cục tại `docs/ui-evidence/leave-design-20261014/`: 64 trạng thái hiển thị ở 320, 390, 768 và 1440px; không phát hiện tràn ngang, nhãn nút bị cắt hoặc lỗi JavaScript. Dữ liệu trong lượt rà giao diện là fixture cục bộ, các API nghiệp vụ được chặn. Lượt rà này không xác nhận việc duyệt/cấp/điều chỉnh trên dữ liệu thật. Trang fixture chỉ chạy trong development và đã được gỡ trước khi deploy.

TypeScript và ESLint phạm vi thay đổi đã chạy thành công. Migration `202610140001_leave_workflow_integrity.sql` đã áp vào Supabase TEST `lgmlkagcytfjazulgfbz`; tổng 46 migration. Receipt riêng: `.tmp/test-leave-migrations.json`. Đây là việc áp DDL, chưa phải kiểm thử cạnh tranh hoặc UAT nghiệp vụ.

Bản Preview `dpl_9HqowjSdyH8sXJPNWtvuqgZiBKAg` đã build READY và được gắn vào alias test. Kiểm tra live bằng tài khoản quản trị test xác nhận các API đọc đơn, số dư/sổ phép, cấu hình và picker trả 200. Phiên kiểm tra đã được đăng xuất. Chưa thực hiện UAT gửi/duyệt/hủy/cấp/điều chỉnh thật sau deploy. Bằng chứng: [leave-deployment-20261014.json](operations/leave-deployment-20261014.json).

Sửa lỗi phát hiện trong rà hình: trường tháng quá hẹp ở 320px; số dư trong drawer bị grid co xuống 2px; icon xóa bước trắng trên nền trắng. Các sửa này được giới hạn trong CSS module nghỉ phép.

## Phạm vi còn lại

Các quy tắc và giới hạn dữ liệu nằm trong [leave-business-integrity-20261014.md](leave-business-integrity-20261014.md). Hiện vẫn tách đơn trừ phép theo từng năm, kiểm tra trùng theo khoảng ngày và chạy tính lại công sau thay đổi phép trong kỳ đang mở. Cấu hình chuyển phép chưa có job tự chuyển cuối năm.

Khi tổng hợp công, dữ liệu mới dùng cờ trừ phép và ngày làm việc trong snapshot đã gửi; dữ liệu cũ thiếu snapshot dùng cách đọc trước đây. Không viết lại giao dịch lịch sử.
