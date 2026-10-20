# Kết quả hoàn thiện Dashboard và Gói/Công trường

Ngày xác nhận: 25/09/2026

## Phạm vi đã hoàn tất

- Giữ nguyên khu vực **Ứng dụng của tôi** và thiết kế lại phần Dashboard còn lại theo bố cục ERP data-first.
- Thay cụm thẻ và biểu đồ trang trí bằng thanh tác vụ nhanh, dải KPI, danh sách cần xử lý, việc cá nhân, ghi chú và trạng thái vận hành.
- Tổ chức lại responsive cho màn Gói/Công trường; bảng công việc không còn đè lên khối **Cần quan tâm** ở độ rộng 1295 px.
- Giữ bảng dữ liệu ở desktop và chuyển sang bố cục thẻ trên màn hình nhỏ; không phát sinh cuộn ngang toàn trang.
- Sửa biểu thức `pattern` tên đăng nhập để tương thích chuẩn regex `/v` trên trình duyệt mới. Tài khoản có dấu chấm như `test.supervisor` đăng nhập bình thường.
- Loại bỏ lớp nền riêng của Dashboard để nội dung nằm trực tiếp trên canvas ứng dụng, không còn cảm giác một khung nền lồng bên trong.
- Bổ sung lớp giao diện điện thoại dùng chung tại `src/app/mobile.css`: điều khiển chạm 48 px, form/drawer theo chiều dọc, safe area, trạng thái nhấn và hỗ trợ điện thoại xoay ngang.
- Thay bản ghi mobile dạng “bảng desktop xếp dọc” bằng card có định danh, tiêu đề, lưới metadata và hành động mở chi tiết.
- Tối ưu cả bốn tab Gói/Công trường cho điện thoại: header rút gọn, tab biểu tượng, công việc dạng card, chi tiết hồ sơ mở bằng drawer và CTA nghiệp vụ cố định phía dưới.

## Tệp triển khai chính

- `src/features/dashboard/components/DashboardView.tsx`
- `src/features/dashboard/components/DashboardView.module.css`
- `src/features/projects/components/package-workspace/PackageWorkspace.module.css`
- `src/lib/auth/username.ts`
- `src/lib/auth/username.test.ts`
- `scripts/erp-workspace-qa.mjs`
- `scripts/mobile-native-qa.mjs`
- `src/app/mobile.css`
- `src/components/shared/DataTable.tsx`

## Kết quả kiểm tra

- `npm run typecheck`: đạt.
- `npm run lint`: đạt.
- `npm test`: 69 tệp, 240 bài kiểm thử đạt.
- `npm run build`: đạt với Next.js 16.3.4.
- Browser QA: đạt ở 1440×900, 1295×640 và 390×844 cho cả Dashboard và Gói/Công trường.
- Mobile QA: đạt 18 trường hợp tại 360×800, 390×844 và 844×390, gồm Dashboard, Chức vụ và bốn tab Gói/Công trường.
- Tất cả thao tác chính được kiểm tra có vùng chạm tối thiểu 44 px; không có nội dung hoặc tab tràn ngang.
- Không có lỗi hydration, lỗi JavaScript hoặc tràn ngang ngoài dự kiến trong các viewport đã kiểm tra.

Trong lúc build, môi trường hiện tại vẫn ghi log `system_settings.read_failed` khi tạo trang tĩnh. Đây là lỗi đọc dữ liệu cấu hình môi trường; build vẫn hoàn thành thành công và không ảnh hưởng thay đổi giao diện trong phạm vi này.

## Bằng chứng giao diện

Ảnh chụp được lưu tại `docs/ui-evidence/erp-workspace/` cho ba kích thước desktop, viewport tái hiện ảnh lỗi của người dùng và mobile.
