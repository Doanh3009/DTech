# Danh sách chọn và menu — 04/11/2026

Đợt này hoàn thiện các component dùng chung, không thêm nghiệp vụ hoặc thay đổi database.

## Thay đổi giao diện

- Khung trắng, bóng nhẹ, bo góc và khoảng cách thống nhất theo token của ERP. Trạng thái chọn, rê chuột, focus, vô hiệu hóa, đang tải và không có kết quả được phân biệt.
- Tìm kiếm tiếng Việt có hoặc không dấu. Tên đối tượng và mã được trình bày thành hai dòng, giữ nguyên nhãn truy cập để điều khiển bằng bàn phím.
- Danh sách cuộn trong khung; vị trí tự chọn phía trên/dưới và bám viewport. Dropdown lồng trong menu giữ menu cha khi chọn; Escape đóng lớp trên cùng trước.
- Giữ FormData, kiểm tra trường bắt buộc, reset form và sự kiện select/input hiện có. Placeholder bị vô hiệu hóa không được trình bày như một giá trị hợp lệ.
- Bộ chọn kỳ trên tổng quan ERP và bốn ô chọn trong đăng ký dùng thử sử dụng component chung. Loại bỏ popup select mặc định của trình duyệt tại các vị trí này.
- Kỳ theo dõi hiển thị đủ tháng/năm; icon và nhãn trong menu thao tác thẳng hàng. Mũi tên ô tham chiếu phản ánh trạng thái mở.
- Preview phát triển ở `/ui-preview/dropdowns`; production trả 404.

Styles được tập trung tại `src/styles/dropdowns.css`; token bóng tại `src/styles/tokens.css`. Phần styles cũ tương ứng đã được chuyển khỏi `enterprise.css`.

## Kiểm tra

Trình duyệt trên mẫu phát triển: 22 ảnh, 16 kiểm tra ở 390/768/1440 px và viewport thấp; kiểm tra khung không tràn, dòng chọn từ 44 px, tìm kiếm, chọn/xóa tham chiếu, menu lồng, Escape trong biểu mẫu và FormData đăng ký. Không có lệnh ghi dữ liệu nghiệp vụ.

Unit: 2.060 đạt, 37 bài tích hợp được bỏ qua theo cấu hình. Ba nhóm kiểm tra cũ nhạy về thời gian đã được chạy độc lập, sau đó toàn bộ suite chạy lại với bốn worker và đạt. Typecheck đạt; lint có 0 lỗi và 5 cảnh báo đã tồn tại. Bằng chứng triển khai được ghi riêng sau khi Vercel READY.

## Tình trạng sản phẩm và cấp ERP cho khách

Sản phẩm hiện có hai phần: trang giới thiệu/tiếp nhận yêu cầu và ứng dụng ERP theo doanh nghiệp tại `/erp/[slug]`.

Luồng hiện hữu: khách gửi yêu cầu → đội triển khai xử lý hồ sơ trong trung tâm điều hành → chọn gói ngành/module → cấp doanh nghiệp và tài khoản quản trị → cấu hình dữ liệu và nghiệm thu theo phạm vi → bàn giao. Form đăng ký chỉ xác nhận đã nhận yêu cầu, không xác nhận tài khoản được tạo tức thì.

Nguồn kiểm tra: `TrialRequestForm.tsx`, `BusinessProvisionPanel.tsx`, `businessService.provisionBusiness`, API `/api/v1/crm/customers/[id]/workspace` và RPC `business_provision_customer`. API cấp ERP dùng quyền trung tâm triển khai; tài khoản khách không có quyền cấp doanh nghiệp mới.

Đã có lõi ERP lưu dữ liệu và xử lý giao dịch thật, cùng cơ chế cách ly doanh nghiệp và phân quyền. Chưa nghiệm thu đủ 82 yêu cầu; bốn kết nối hóa đơn điện tử, ký số, ngân hàng và email là mô phỏng theo lựa chọn của người dùng. Chưa có bằng chứng nghiệm thu luồng mua/thanh toán tự động cấp trọn bộ ERP. Vì vậy, trạng thái hiện tại phù hợp demo và triển khai thử nghiệm theo phạm vi đã kiểm chứng; không được mô tả là đã hoàn thiện toàn bộ ERP thương mại.

## Bản triển khai đã kiểm tra

Commit ứng dụng `b6fa9c5c28cef80a92790e55952e36a3dd6de74c` đã push GitHub và triển khai tại https://dimixo-erp.vercel.app; Vercel READY, alias khớp và health trả ready. [Receipt phát hành](evidence/dropdown-release.json) ghi mã triển khai và kết quả.

Trên Vercel: 25 ảnh, 18 kiểm tra tại 390/768/1440 px; kỳ theo dõi hiển thị đủ tháng/năm, mũi tên tham chiếu chuyển trạng thái và menu desktop căn hàng. Kiểm tra chọn kỳ có API 200, chọn rồi bỏ bản nháp, FormData đăng ký và production 404 cho trang preview. Không có lỗi trang/API hoặc lệnh ghi nghiệp vụ; phiên trải nghiệm đã đăng xuất (200). Build cuối và TypeScript đạt; quét 166 artifact client không có giá trị bí mật.
