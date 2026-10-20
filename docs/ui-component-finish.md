# Hoàn thiện góc bo và chuyển động

## Quy ước

| Thành phần | Bán kính | Quy tắc |
|---|---:|---|
| Input, select, nút thao tác | 12px | Nhất quán giữa desktop, mobile và form trong drawer |
| Card, bảng dạng hồ sơ | 18px | Viền sáng; khoảng an toàn do workspace quản lý |
| Các ô dữ liệu lồng bên trong | 10px | Phân nhóm dữ liệu, không thêm nhiều lớp viền |
| Modal/drawer/sheet | 22px | Mobile bo hai góc trên; desktop drawer bo cạnh trái |
| Search, trạng thái | Pill | Nhãn ngắn, số liệu đọc được |

- Nút 14px, tối thiểu 44px trên điện thoại. Input trên điện thoại giữ 16px để tránh trình duyệt tự zoom.
- Giữ padding trái/phải 16px + safe-area trên điện thoại và 24–36px trên desktop.
- Đường focus riêng cho control; chỉ control được chọn có `aria-pressed`/`aria-current` mới dùng trạng thái chọn.
- Bảng hẹp chuyển sang hồ sơ đọc dọc; không che dữ liệu bằng overflow hidden.

## Chuyển động

- Trang mới: 160ms, opacity 0.86 → 1, đi lên 4px. Chạy sau khi route mới đã commit; không thêm thời gian chờ và không remount form.
- Modal/sheet: 180ms, dịch chuyển 8–12px. Nút: phản hồi chạm 120ms, scale 0.98.
- Khi hệ điều hành bật giảm chuyển động, tắt các hiệu ứng này; thay đổi cài đặt giữa lúc chạy cũng hủy hiệu ứng trang.
- Nguồn: `src/styles/interaction-finish.css`, `src/lib/ui/pageEntryMotion.ts`, AppShell.

Kiểm thử trình duyệt dùng Edge ở kích thước mobile/desktop; thao tác camera/GPS trên iPhone thật vẫn cần kiểm tra trên thiết bị qua HTTPS.
