# Gửi và xác nhận phiếu lương

- Kế toán khóa bảng lương rồi chọn **Gửi phiếu lương**. Luồng publish hiện có tạo snapshot từng nhân viên và gửi thông báo/chat. Link thông báo mở `/personal/payslips`.
- Nhân viên vào Cá nhân → Phiếu lương → Chi tiết và chọn **Xác nhận phiếu lương**. `viewed_at` vẫn chỉ phản ánh đã mở xem.
- API `POST /api/v1/accounting/payslips/:id/confirm` nhận `{version}`. Người dùng phải có `payslip.self.view` và nhân viên liên kết phải sở hữu phiếu. Không được xác nhận hộ bằng quyền xem bảng lương.
- RPC `confirm_own_payslip` chỉ được gọi bằng service_role phía server. Khóa hàng, kiểm tra chủ sở hữu/tài khoản hoạt động/trạng thái phát hành/phiên bản, ghi xác nhận và audit trong cùng transaction.
- Gửi lại cùng phiên bản trả thời điểm xác nhận cũ, không tạo thêm audit. Phiếu bị thu hồi không nhận xác nhận mới; lịch sử xác nhận trước đó được giữ. Phiên bản mới cần xác nhận mới.
- Danh sách kế toán hiển thị trạng thái xác nhận của nhân viên. Mobile kế toán giữ phạm vi nghiệp vụ theo quyền; phạm vi cá nhân được chọn theo route, không theo kích thước màn hình.
- Migration: `supabase/migrations/202610100001_payslip_employee_confirmation.sql`. Đã áp dụng vào project TEST riêng. Triển khai môi trường khác cần áp dụng migration trước.
