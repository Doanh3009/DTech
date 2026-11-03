# Giao diện ERP khách hàng

Giao diện tại `/erp/[slug]` dùng chung cho sáu gói ngành. Tên doanh nghiệp, thương hiệu, module và quyền lấy từ cấu hình và phiên đăng nhập. Bộ quy tắc nằm tại [Design DNA](../../design-system/dtech-erp/MASTER.md) và [thiết kế workspace](../../design-system/dtech-erp/pages/business-workspace.md).

## Bố cục và thao tác

- Gateway dùng `ErpModuleCard` chung, icon Lucide và màu nghiệp vụ từ registry. Tìm module bỏ qua dấu tiếng Việt.
- Trong module, breadcrumb xác định phân hệ và nghiệp vụ. Điều hướng chia Chứng từ / Danh mục / Chi tiết, chỉ hiện mục có quyền đọc. Menu điện thoại dùng cùng nguồn dữ liệu.
- Tìm kiếm đầu trang giới hạn trong module đang mở; gateway tìm trong các module được phép. `Ctrl K` hoặc `⌘ K` đặt focus vào ô tìm; phím mũi tên di chuyển giữa kết quả; Escape đóng kết quả.
- Danh sách ưu tiên mã, tên, trạng thái và bốn trường nghiệp vụ. Nút Cột hiển thị chọn thêm trường hoặc khôi phục mặc định. Điện thoại dùng thẻ dữ liệu, hai trường chính và phần thông tin mở rộng.
- Biểu mẫu chia nhóm thông tin chung, đối tượng, ngày và giá trị theo trường thực tế. Trường nội dung dài dùng textarea; trường Có/Không gửi boolean. Lỗi hiển thị tại trường và focus vào trường lỗi đầu tiên. Thanh lưu nằm ngoài vùng cuộn; thao tác giữ request UUID và phiên bản chứng từ hiện có.
- Kế toán, mua hàng và CRM dùng tab chung có ArrowLeft / ArrowRight / Home / End. Chọn lại tab hiện tại không khởi động lại trạng thái tải. Chỉ số tiền hiển thị dạng gọn, có giá trị đầy đủ trong nhãn truy cập và tooltip.
- Đăng nhập và đổi mật khẩu dùng cùng bề mặt, kích thước điều khiển và màu thương hiệu. Không đưa danh sách module vào màn đăng nhập.

## Tìm kiếm và dữ liệu

Migration `202611020015_business_module_search.sql` bổ sung RPC `business_search_module_records`. Hàm suy ra tenant từ phiên, kiểm tra module, gói ngành và quyền đọc từng bản ghi; xác định module theo `workspaceFeature` giống registry giao diện. Kết quả chỉ gồm ID, loại, nhãn, mã, tên và thời điểm cập nhật, tối đa 50 kết quả. Chỉ `service_role` có quyền gọi RPC; trình duyệt gọi API business.

Migration đã áp dụng vào project phát triển `tcjjhxqtreemccdbvyza`; số migration từ 151 lên 152. Đối chiếu trước/sau giữ nguyên tài khoản, nhân sự, vật tư, tồn kho, chứng từ, tổng Nợ/Có và dữ liệu ERP nội bộ. Xem [chứng cứ rollout](evidence/erp-workspace-search-rollout.json).

## Phạm vi nghiệm thu

Kiểm tra giao diện gồm gateway, các module ngành xây dựng và điện tử, danh sách, sáu loại biểu mẫu, điều hướng điện thoại, bàn phím, chọn cột và lỗi nhập liệu tại 390 / 768 / 1440px. Mở form và thử validation trên dữ liệu trải nghiệm không ghi chứng từ. Kiểm thử lưu/CAS và các lệnh nghiệp vụ dùng dữ liệu tổng hợp cục bộ.

Đây là đợt hoàn thiện giao diện. Ma trận 82 yêu cầu nghiệp vụ MISA vẫn cần nghiệm thu riêng; màn hình đẹp hoặc kiểm thử đọc thành công không xác nhận hoàn tất toàn bộ nghiệp vụ, kết nối nhà cung cấp hay tuân thủ pháp lý.
