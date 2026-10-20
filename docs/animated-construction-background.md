# Nền xây dựng chuyển động cho trang đăng nhập

Hoàn thành ngày 13/10/2026 theo mẫu đính kèm: nét kỹ thuật 2D trên nền trắng ngà, các dải mint, xanh nhạt và beige; giữ khoảng trống ở giữa cho khối đăng nhập.

## Tệp triển khai

| Tệp | Vai trò |
| --- | --- |
| [LoginBackdrop.tsx](../src/features/system-admin/components/LoginBackdrop.tsx) | Ghép nền, wrapper di chuyển và các SVG độc lập |
| [ConstructionIllustrations.tsx](../src/features/system-admin/components/ConstructionIllustrations.tsx) | Hình vẽ kỹ thuật, các nhóm nét phục vụ chuyển động |
| [LoginBackdrop.module.css](../src/features/system-admin/components/LoginBackdrop.module.css) | Màu sắc, vị trí, animation và responsive |

Có 11 SVG độc lập, đáp ứng 10 nhóm hình trong yêu cầu; cờ lê và thước cuộn được tách riêng. Mỗi hình có `viewBox`, nét mảnh và chuyển động riêng bằng CSS. Không thêm thư viện, vòng lặp JavaScript, ảnh nền raster hay phép biến đổi 3D.

## Chuyển động

### Đổi vị trí theo phản hồi

- Desktop từ 1600×900: các icon chạy quanh khung theo cùng một vòng, lệch pha để lần lượt chiếm vị trí của nhau; 60 giây/vòng.
- Laptop và tablet: hai luồng ở cạnh, bên trái đi xuống, bên phải đi lên; 28 giây/vòng. Hình mờ dần ngoài màn hình trước khi quay lại đầu luồng, tránh các nét chồng lên nhau.
- Điện thoại: cần cẩu và thép chữ I đổi bên ở góc trên trong 22 giây; mũ và ray đổi bên ở dải dưới trong 20 giây. Đoạn chuyển phía trên đi sát mép và được cắt một phần để giữ logo thoáng.
- Độ đậm tăng để dễ thấy chuyển động. Wrapper di chuyển vị trí; SVG con vẫn giữ hiệu ứng nét/móc/bánh răng riêng.
- Không dùng vòng lặp JavaScript. Chế độ giảm chuyển động đưa tất cả về bố cục tĩnh ban đầu.

### Chuyển động trong từng hình

| Hình | Hiệu ứng | Chu kỳ |
| --- | --- | --- |
| Cần cẩu | Khung giữ nguyên hình dạng; móc nâng/hạ, dây kéo dài đồng bộ | 9 giây |
| Mũ bảo hộ | Nhấp nhô 8 px; điện thoại 2 px | 8 giây |
| Đường ray đôi | Vệt sáng nhẹ chạy dọc từng ray, lệch pha | 10 giây |
| Bánh răng | Quay một chiều, đều | 28 giây |
| Thép chữ I | Vẽ từng nhóm nét; giữ đường viền mờ để nhận diện | 10 giây |
| Bản vẽ | Các lớp nét hiện/ẩn lần lượt | 11 giây |
| Công trình | Các tầng hiện/ẩn lần lượt, khung đứng yên | 12 giây |
| Móc công nghiệp | Di chuyển dọc nhẹ | 8,5 giây |
| Thước cuộn | Nhấp nhô 7 px | 9,5 giây |
| Cờ lê | Nhấp nhô 8 px | 11 giây |
| Áo bảo hộ | Thay đổi độ đậm nhẹ | 9,2 giây |

Các chu kỳ lặp liền mạch. Khi hệ điều hành bật giảm chuyển động (`prefers-reduced-motion`), mọi animation dừng và các hình hiển thị tĩnh.

## Responsive và tương tác

- Desktop trên 1100 px: 11 hình.
- Tablet từ 768 đến 1100 px: 6 hình.
- Điện thoại dưới 768 px: 4 hình với kích thước nhỏ hơn.
- Số hình nhìn thấy trong từng khung hình có thể thay đổi khi hình đi vào/ra khỏi mép màn hình.
- Nền ở dưới khối đăng nhập, `pointer-events: none`, `aria-hidden="true"`; SVG không nhận focus.
- Đã kiểm tra 1920×1080, 1366×768, 1024×768, 768×1024, 390×844 và 320×640: không tràn ngang; hình trang trí không giao với vùng logo hoặc form.
- Focus tài khoản, Tab sang mật khẩu và nút hiện/ẩn mật khẩu hoạt động; giá trị mật khẩu được giữ nguyên.
- Hash của 18 tệp được bảo vệ liên quan form, logo, trang đăng nhập, style chung và xác thực không đổi so với đầu nhiệm vụ.

## Kết quả kiểm tra

| Kiểm tra | Kết quả |
| --- | --- |
| Typecheck | Đạt |
| ESLint toàn bộ mã nguồn, loại thư mục tạm `.tmp` | Đạt |
| Production build | Đạt, tạo 282 trang |
| Toàn bộ unit test trước cập nhật di chuyển đổi vị trí | 708 đạt, 37 bỏ qua; 127 tệp đạt, 1 tệp bỏ qua |
| Browser QA trên 6 kích thước | Đạt |
| Giảm chuyển động trên desktop/điện thoại | Không còn animation hoạt động |
| Layout shift do nền | 0 tại tất cả kích thước kiểm tra |

CLS toàn trang trong lần đo nằm từ khoảng 0,00000029 đến 0,00000674. Các phép đo này là mẫu kiểm tra trong Chrome, không phải số liệu theo dõi người dùng thực tế.

Một lần chạy test đồng thời với build gặp timeout ở TimesheetMatrix. Chạy riêng bài đó và toàn bộ suite sau đó đều đạt; không thay đổi test hay timeout. Build vẫn có log `system_settings.read_failed` từ môi trường cấu hình hiện tại nhưng hoàn thành với mã thoát 0.

## Ảnh và dữ liệu kiểm tra

Ảnh nền trước khi bổ sung di chuyển đổi vị trí:

- [Desktop 1920 px](ui-evidence/construction-background-20261013/desktop-1920.png)
- [Laptop 1366 px](ui-evidence/construction-background-20261013/laptop-1366.png)
- [Điện thoại 390 px](ui-evidence/construction-background-20261013/mobile-390.png)
- [Báo cáo browser QA](ui-evidence/construction-background-20261013/report.json)

Bản di chuyển đổi vị trí:

- [Desktop sau 10 giây](ui-evidence/construction-background-motion-20261013/desktop-1920-10s.png)
- [Laptop sau 10 giây](ui-evidence/construction-background-motion-20261013/laptop-1366-10s.png)
- [Điện thoại sau 4 giây](ui-evidence/construction-background-motion-20261013/mobile-390-4s.png)
- [Điện thoại sau 15 giây](ui-evidence/construction-background-motion-20261013/mobile-390-15s.png)
- [Báo cáo kiểm tra di chuyển](ui-evidence/construction-background-motion-20261013/report.json)

Đã lấy 241 mẫu vị trí qua 60 giây ở mỗi kích thước (tổng 1446 mẫu): không giao với logo/form, không giao giữa các nét icon đang thấy, không tràn ngang hoặc che điều khiển. Cả 6 kích thước đều đứng yên khi bật giảm chuyển động; 18 hash nguồn được bảo vệ không đổi. Lint, typecheck và production build của bản cập nhật đạt; không chạy lại toàn bộ unit test cho lần thay đổi nền này.

## Giới hạn

- Ở 320×640, nội dung form hiện có cần cuộn dọc: chiều cao tài liệu 674 px. Nền không tạo tràn ngang hoặc layout shift.
- Browser QA dùng phiên ẩn danh và chặn các request ghi; không gửi tài khoản thật hoặc kiểm tra giao dịch nghiệp vụ. Một request nội bộ của Next dev đến `/__nextjs_original-stack-frames` bị chặn trong lượt kiểm tra giảm chuyển động trên điện thoại; không có lỗi trang được ghi nhận.
- Đã kiểm tra cấu hình animation và lấy mẫu chuyển động ngắn; chưa quay video toàn chu kỳ hoặc đo FPS trên điện thoại cấu hình thấp thực tế.
