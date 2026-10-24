# Cấp tài khoản ERP khách hàng

Ngày cập nhật: 24/10/2026.

## Nơi thao tác

Control center → Khách hàng → Cấu hình ERP → Tài khoản ERP. Phần này chỉ có trong không gian đội triển khai. ERP khách không có khối cấu hình doanh nghiệp hoặc công cụ quản trị project Supabase.

Đội triển khai có `crm.view` được xem danh sách theo doanh nghiệp; cần thêm `crm.manage` để cấp tài khoản, cấp lại mật khẩu, tạm ngừng hoặc mở lại. API `/api/v1/crm/customers/[id]/workspace/accounts` giữ cùng kiểm tra quyền với các thao tác setup hiện có.

## Quy tắc

- Tạo tài khoản biên tập hoặc chỉ xem; không tạo thêm quản lý. Một doanh nghiệp giữ một tài khoản quản lý.
- Tên tài khoản duy nhất trong doanh nghiệp; cùng tên tài khoản ở hai doanh nghiệp vẫn tách dữ liệu và mật khẩu.
- Tài khoản được cấp hoặc cấp lại phải đổi mật khẩu ở lần đăng nhập kế tiếp. Riêng các danh tính mô phỏng đã được chuẩn bị sẵn trong script dữ liệu trải nghiệm không yêu cầu bước này.
- Mật khẩu ban đầu được sinh ở server, chỉ trả cho thao tác cấp/cấp lại. Danh sách tài khoản không trả mật khẩu hoặc hash. UI giữ thông tin vừa cấp trong bộ nhớ của trang, có thể sao chép để bàn giao.
- Cấp lại mật khẩu và tạm ngừng sẽ kết thúc phiên hiện có. Mở lại không khôi phục phiên cũ.
- Quản lý không bị tạm ngừng/cấp lại qua bảng nhân viên; dùng luồng cấp lại mật khẩu quản lý hiện có để tránh thao tác nhầm.
- Lệnh có request UUID, payload hash, receipt và phiên bản workspace. Tài khoản được tìm bằng cả `tenant_id` và `account_id`.
- Thay đổi tăng phiên bản workspace và hồ sơ CRM, đồng thời ghi lịch sử triển khai/audit. Không ghi mật khẩu/hash vào audit hoặc receipt.
- Khóa theo thứ tự operator → hồ sơ CRM → tenant → tài khoản → phiên. Không cấp tài khoản khách vào `app_accounts`, không tạo quyền admin nội bộ.

## Dữ liệu trải nghiệm

Mỗi doanh nghiệp có ba danh tính mô phỏng: quản lý, kế toán (biên tập), nhân viên (chỉ xem). Tổng cộng 18 tài khoản cho sáu doanh nghiệp; không tạo thêm tài khoản ERP nội bộ. Thông tin đăng nhập riêng nằm trong `.tmp/DIMIXO-tai-khoan-trai-nghiem.md`.

Ba vai trò hiện áp dụng ở phạm vi doanh nghiệp và module được cấp cho doanh nghiệp. Chưa có phân quyền chi tiết theo từng phần hành kế toán hoặc từng công trình.
