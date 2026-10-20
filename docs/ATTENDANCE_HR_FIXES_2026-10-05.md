# Chấm công, HR và xuất Excel — 05/10/2026

## Thay đổi

- HR xem ảnh chấm vào/ra trực tiếp trong danh sách theo ngày, mở ảnh lớn và chuyển ảnh bằng nút hoặc phím mũi tên. Có lọc nhân viên, phòng ban, ca, trạng thái và minh chứng; phân trang 20 nhân viên; không mở hồ sơ nhân viên khi bấm ảnh.
- Hiển thị ngày đang xem theo `DD/MM/YYYY`, giờ Việt Nam, thời gian vào/ra, trạng thái ảnh, tọa độ và độ chính xác GPS. Không giữ dữ liệu ngày cũ trong khi ngày mới đang tải.
- API ảnh riêng tư kiểm tra quyền; dùng ảnh gốc nếu chưa có thumbnail. Tải ảnh theo nhu cầu và nhận biết ảnh không còn khả dụng.
- Nhân viên dùng các chức năng cá nhân; quyền `timesheet.view` cá nhân không còn mở ứng dụng Nhân sự. Các trang HR và API hồ sơ được kiểm tra quyền riêng.
- Loading dùng icon vòng tròn SVG trên nền tròn 64 px ở giữa viewport, gồm lúc bấm điều hướng và lúc tải dữ liệu. Theo phản hồi tiếp theo, đã thay logo xoay 3D bằng icon `LoaderCircle`. Animation tắt khi người dùng bật reduced motion. Icon được render qua portal để bố cục/transform của card không làm lệch vị trí.
- Nút quay lại dùng cùng chiều rộng nội dung trang. Card, toolbar, bảng và form dùng chung token khoảng cách. Chat chỉ tải bộ giao diện soạn tin khi mở; danh sách nhân viên đọc danh mục và dữ liệu trang song song.
- Excel `.xlsx` có bảng công ngang theo ngày, ký hiệu nghỉ, tổng công, sheet chi tiết và bảng lương có tổng tiền, trạng thái tiếng Việt, định dạng tiền và bố cục in. Giữ nguyên dữ liệu lương đã lưu; không tự tính lại thực nhận theo công thức mới.
- Báo cáo đọc đủ các trang dữ liệu vượt giới hạn 1.000 dòng và chỉ truy vấn module cần xuất/có quyền. Kỳ công đã khóa nhưng chưa có snapshot được đọc từ dữ liệu kỳ hiện có.
- Sửa truy vấn quan hệ phòng ban bị mơ hồ ở danh sách hợp đồng, chọn nhân viên cho hợp đồng, tạo văn bản hợp đồng và tìm kiếm nhân viên.
- GPS chấm công cá nhân và điểm danh công trường ghi tọa độ thực, không chặn theo bán kính. Thiếu quyền/vị trí có trạng thái lỗi và thao tác thử lại; vị trí độ chính xác thấp được ghi nhận để kiểm tra. Browser cần HTTPS hoặc localhost và quyền vị trí.
- Dashboard xuất nhập khẩu đọc song song, giới hạn tối đa bốn lô hàng trong mỗi nhóm để giảm chuỗi truy vấn nối tiếp.
- Cập nhật màn hình chấm công theo phản hồi UI: sáu KPI là card riêng với khoảng cách 16 px (12 px trên điện thoại), viền và nền theo trạng thái. Bỏ class KPI global gây nền trắng chung và xung đột grid; CSS module quản lý toàn bộ card. Tiêu đề bảng 20 px, tên nhân viên 16–17 px/semibold, phòng ban 14 px, mã và ca 13 px; dữ liệu bảng 15 px, nhãn cột 14 px. Ngày được hiển thị thành nhãn riêng cạnh tiêu đề, ảnh minh chứng giữ thao tác trực tiếp.

## Dữ liệu và triển khai

Migration [202610050001_separate_employee_self_service_from_hr.sql](../supabase/migrations/202610050001_separate_employee_self_service_from_hr.sql) gỡ quyền directory HR cũ của vai trò giám sát và thêm quyền bảng công cá nhân rõ ràng. Migration này chưa được áp dụng lên Supabase từ phiên sửa code. Nhân viên thường hiện đã được chặn HR bằng code mới; mapping giám sát cũ trong DB cần migration nếu triển khai quy tắc chỉ HR quản lý directory.

Audit Supabase chỉ đọc: các bảng chính và bucket báo cáo tồn tại. Tài khoản duy nhất chưa có role không hoạt động và chưa gắn nhân viên. Ba mẫu báo cáo hiện có và workbook hoàn tất đã lưu không có ký tự Unicode hỏng. Một lần xuất cũ thất bại do thiếu snapshot kỳ công.

Dữ liệu kiểm tra hiện chỉ có một dòng công ngày và chín dòng tổng hợp. Ngày không có dữ liệu được để trống khi xuất, tránh biến dữ liệu thiếu thành công hoặc nghỉ giả. Ảnh minh chứng hiện có là ảnh xám của bộ seed; QA dùng ảnh lưu thật nhưng danh sách HR trong preview dùng fixture cô lập.

## Kiểm tra

- Unit/integration kiểm tra bộ lọc ngày, chuyển ảnh, quyền xem ảnh, retry lỗi tải, GPS ngoài bán kính/thiếu quyền, workbook binary/Unicode/tổng số và phân quyền HR.
- Browser: HR review 1440×900 và 390×844; tài khoản nhân viên lấy GPS ở Hà Nội ngoài địa điểm cấu hình, chụp ảnh và bật nút xác nhận; mất quyền GPS được báo rõ. Không gửi sự kiện chấm công vào DB trong QA.
- Bộ QA chung: `node scripts/attendance-fixes-qa.mjs`. Có thể đặt `UI_QA_BASE_URL` để chạy trên production server riêng. Kiểm tra icon loading ở giữa màn hình, kết thúc loading, mở lại chat, không tràn ngang và căn nút quay lại.
- Audit GET chỉ đọc, chạy opt-in: `node scripts/run-live-read-audit.mjs`. Audit gọi handler với identity admin mô phỏng để kiểm tra truy vấn thực; kiểm tra session/403 của nhân viên được thực hiện riêng bằng browser và regression tests.
- Evidence HR/GPS: `docs/ui-evidence/attendance-review/`. Evidence bố cục/loading: `docs/ui-evidence/attendance-fixes/`.
- Audit dữ liệu cuối: **37/37 GET đạt**, gồm widget dashboard default/global. Bằng chứng: [live-read-audit-2026-10-05.json](live-read-audit-2026-10-05.json). Identity admin được mô phỏng; đây không phải kiểm thử session/JWT/RLS của admin.
- Kiểm tra cuối: **407 unit/regression tests đạt**, 37 test audit live bỏ qua trong lượt mặc định và chạy riêng như trên; `npm run lint`, `npm run typecheck`, build production webpack và 39 migration validation đạt.
- Browser trên bản production cục bộ cuối: bảy route thuộc ba vai trò nhân viên/giám sát/kế toán đạt ở 1920×1080 và 390×844, dữ liệu đã tải hoàn tất; logo lệch tâm 0 px, nhân viên nhận 403 tại các API HR, chat mở lại được. Server production phục vụ QA đã dừng sau kiểm tra.
- Lượt kiểm tra cùng bảy route trên server dev hiện có cũng đạt; server dev của workspace được giữ chạy.
- Sau khi thay logo bằng icon vòng tròn: browser kiểm tra 1920×1080 và 390×844 đạt, icon lệch tâm 0 px và không tải ảnh logo; reduced motion tắt animation, icon biến mất khi tải xong. ESLint các file thay đổi và `npm run typecheck` đạt. Ảnh kiểm tra: `docs/ui-evidence/loading-spinner/`.
- Sau khi sửa card tổng hợp và phân cấp chữ: 6 regression tests của `AttendanceAdminDashboard`, ESLint file thay đổi và `npm run typecheck` đạt. Browser kiểm tra 1680/1440/1280/1024/768/767/390/360 px: card tách rõ, kích thước chữ đúng, không tràn trang, lọc ngày/tìm nhân viên đạt; mở ảnh và chuyển ảnh đạt ở 1440/768/390 px, không có lỗi console/runtime. Dữ liệu và ảnh trong lượt này là fixture cô lập, không ghi DB. Bằng chứng: [attendance-hierarchy/report.json](ui-evidence/attendance-hierarchy/report.json).

Số liệu thời gian từ dev hoặc một lượt GET phụ thuộc mạng/cold compilation; không dùng để cam kết tốc độ production.
