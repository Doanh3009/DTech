# Supabase chung — dữ liệu tách theo doanh nghiệp

Yêu cầu thay thế mô hình mỗi khách một project ngày 23/10/2026. Project DTech hiện hữu là control plane và lưu các doanh nghiệp dùng thử; không tạo Supabase mới khi cấp tài khoản.

## Ranh giới

- Dữ liệu ERP nội bộ hiện có vẫn được giữ nguyên. Các truy vấn cũ dùng service role chưa được coi là truy vấn nhiều doanh nghiệp.
- Không gian ERP khách mới dùng bảng `business_*`, khóa `tenant_id`, khóa ngoại có tenant và RPC riêng. CRM liên kết tenant với hồ sơ khách.
- Tài khoản khách và phiên đăng nhập nằm trong miền business; không cấp role admin nội bộ hoặc phiên Supabase Auth nội bộ cho khách. Mật khẩu scrypt, cookie phiên ngẫu nhiên HTTP-only, token phiên chỉ lưu HMAC, giới hạn đăng nhập, đổi mật khẩu ban đầu và thu hồi phiên khi khóa/reset.
- Bảng business bật RLS và không cấp quyền trực tiếp cho anon/authenticated. Các API khách chỉ gọi RPC kiểm tra session hash, doanh nghiệp, trạng thái/quyền, thời hạn và phiên bản. Không nhận tenant của người dùng làm bằng chứng quyền.
- Gói ngành quyết định nghiệp vụ có thể dùng, không quyết định quyền đọc dữ liệu doanh nghiệp khác. Hai khách cùng ngành vẫn tách dữ liệu.
- Danh mục vật tư, kho, đối tác, BOM, lệnh/công đoạn, lô, chất lượng, bán hàng/công nợ và công trình dùng bảng có ràng buộc; không tạo bảng chứa dữ liệu giả để minh họa ngành.
- Cấp dùng thử là một giao dịch database: giữ request UUID, tạo tenant, cấu hình, tài khoản owner và nhật ký. Retry trả lại cùng receipt; không tạo trùng. Không lưu mật khẩu rõ trong CRM/database/log.

## Sáu gói đầu tiên

Nguồn cấu hình `src/config/businessIndustries.json`. Các màn nghiệp vụ dùng DNA chung và metadata biểu mẫu; schema/RPC mới phải kiểm tra mã gói, danh sách tính năng và khóa ngoại cùng tenant ở database.

Việc có schema/giao diện ghi nhận không đồng nghĩa đã hoàn thiện MES thiết bị, tính giá thành kế toán, FEFO tự động hay kế toán tổng hợp. Nghiệp vụ được công bố theo đúng các command và bằng chứng đã chạy.

## Giao hàng theo đơn bán

Quy trình sản xuất, lô/chất lượng, công trình và đồng bộ web setup được bổ sung trong [quy trình sáu ngành](industry-workflows.md), migration `202610230012`–`202610230014`. Tài liệu này ghi rõ cách tính, luồng đảo chứng từ, phạm vi dữ liệu mẫu và những chức năng chưa nằm trong gói vận hành.

Luồng bán hàng có command xuất nhiều dòng trong một transaction, giao từng phần, kiểm tra hàng trong đơn, giới hạn số lượng giao/trả, phiên bản đơn và thử lại cùng request UUID. Đảo phiếu xuất của đơn hoàn thành mở lại đơn theo số lượng thực giao. Các lệnh nhập/xuất thủ công chịu cùng trigger tại sổ kho. Xem [hợp đồng giao hàng](sales-fulfillment.md). Migration `202610230010` và các migration business phụ thuộc mới được kiểm tra native; chưa áp dụng cloud trong đợt giao hàng này.
