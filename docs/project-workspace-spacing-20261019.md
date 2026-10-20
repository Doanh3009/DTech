# Khoảng đệm khung công trường — 19/10/2026

- Khung gói/công trường có padding 16px desktop, 12px mobile; các phần cách nhau 12px.
- Header, thanh tab và nội dung có viền mảnh, dùng radius chung. Thanh tab có khoảng đệm 8px; giữ padding bên trong nội dung hiện có để tránh cộng khoảng trống kép.
- Bỏ hoàn toàn dòng và hàng trống “Đã đồng bộ”. Chỉ hiện thông báo ngoại tuyến, cập nhật chờ gửi hoặc gửi lỗi; nút thử lại giữ nguyên.
- Điều hướng điện thoại tiếp tục dùng thanh điều hướng mobile hiện có.
- Phạm vi: `PackageWorkspace.tsx` và `PackageWorkspace.module.css`. Không thay dữ liệu, quyền hoặc nghiệp vụ.
- TypeScript và focused ESLint đạt; build Vercel/health được ghi trong biên nhận triển khai. Không chạy browser hoặc bộ test tự động.
