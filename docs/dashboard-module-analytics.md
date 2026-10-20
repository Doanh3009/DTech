# Dashboard phân hệ

## Phạm vi

- `/dashboard` hiển thị một phân hệ được cấp quyền tại một thời điểm, tối đa bốn KPI và hai biểu đồ.
- Chuyển phân hệ chỉ xuất hiện khi người dùng có nhiều phân hệ thống kê. Ô ứng dụng vuông đặt dưới biểu đồ.
- Bỏ danh sách công việc, thông báo, ghi chú và biểu mẫu khỏi màn hình tổng quan.
- Giao diện dùng hướng data-first của UI/UX Pro Max: nền trung tính, bảng màu hạn chế, đường viền nhẹ, không bóng trang trí.

## Dữ liệu và quyền

- `moduleAnalytics.ts` dùng chung bộ lọc ứng dụng, trạng thái bật/tắt module và quyền widget cho server/client.
- API `scope=global` chỉ trả metrics/charts của những widget được cấp quyền, không trả danh sách attention.
- Kế toán có quyền payroll xem quỹ lương và tình trạng kỳ lương. Quyền `payslip.self.view` chỉ xem trạng thái phiếu lương cá nhân; dữ liệu nguồn tiếp tục lọc theo nhân viên và trạng thái phát hành.
- Biểu đồ dùng dữ liệu thật. Quỹ lương lấy tối đa năm kỳ gần nhất; tiến độ lấy tối đa sáu dự án; phòng ban lấy tối đa tám nhóm lớn nhất. Không suy diễn doanh thu hay lợi nhuận từ dữ liệu lương.
- Các biểu đồ thanh biểu diễn nhóm có thể giao nhau; donut chỉ dùng nhóm loại trừ nhau. Tình trạng dự án bao gồm cả hoàn thành.
- Trạng thái lỗi có thử lại, dữ liệu trống không có số liệu giả, biểu đồ đường có bảng số liệu truy cập được bằng bàn phím.

## Kiểm tra

- `npm run typecheck`: đạt.
- ESLint các file thay đổi: đạt.
- `npm test -- --run`: 77 files / 277 tests đạt.
- `node scripts/ui-route-audit.mjs` và `node scripts/ui-screen-audit.mjs`: đạt.
- `node scripts/dashboard-current-qa.mjs`: đạt với tài khoản giám sát, kế toán và nhân viên; kiểm tra server payload theo quyền, chuyển module, refresh, focus, reduced motion, không tràn ngang, ô ứng dụng vuông và không lỗi hydration.
- Kích thước kiểm tra: 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920px. Ảnh trong `docs/ui-evidence/dashboard-module-analytics/`.
