# Bảng công nhân viên — 16/10/2026

## Luồng đã thay đổi

- `/timesheets/matrix` mở danh sách nhân viên, mỗi người một hàng: tên, mã, phòng ban, ngày công, ngày đi trễ, nghỉ phép, nghỉ không lương, vắng, trạng thái rà soát.
- Bấm tên hoặc mũi tên mở lịch công riêng của nhân viên trong kỳ. Bấm ngày mở chi tiết ca, chấm vào/ra, công, thời gian làm, trễ/sớm, phép, nguồn dữ liệu và điều chỉnh.
- Liên kết quay lại danh sách giữ `periodId`. Trang danh sách nhận `searchParams` bất đồng bộ theo tài liệu Next.js cài tại workspace.
- Tìm nhân viên, lọc phòng ban, lọc cần rà soát, phân trang 20 người, chọn kỳ và realtime được giữ lại.
- Chiều rộng danh sách dưới 740 px trình bày từng hàng dọc với nhãn số liệu; lịch bảy cột chỉ xuất hiện trong hồ sơ một người.

## Dữ liệu và quyền

- Số liệu danh sách và phần tổng hợp trong hồ sơ đọc trực tiếp `TimesheetSummary` đã lưu. Không suy ra số ngày đi trễ hoặc số phép từ tập ngày chưa đầy đủ.
- Ngày không có bản ghi hiện `Chưa có dữ liệu`; không biến ngày trống thành ngày làm, vắng hay nghỉ. Tổng hợp khác tổng các bản ghi ngày sẽ hiện trạng thái chưa đủ dữ liệu.
- Giờ chấm công hiển thị theo `Asia/Ho_Chi_Minh`.
- Điều chỉnh công chỉ hiện với quyền `timesheet.adjust`, kỳ chưa chốt và nhân viên có trong kỳ. API giữ trách nhiệm kiểm tra quyền thực tế.
- Không có ghi dữ liệu nghiệp vụ hay thay đổi cơ sở dữ liệu trong phạm vi này.

## Kiểm tra

- 14/14 test thành phần đạt: kỳ trống, cột tổng hợp, tổng đã lưu khi thiếu ngày, tìm kiếm/phòng ban, rà soát, 52 nhân viên/phân trang, khôi phục kỳ, lịch 31 ngày, lọc đúng người, chi tiết và múi giờ, ngày rỗng, quyền chỉ đọc, kỳ chốt, liên kết ngày và ngày ngoài kỳ.
- TypeScript toàn workspace đạt (`tsc --noEmit --incremental false`).
- ESLint cho các thành phần, test và hai trang liên quan đạt.
- Hai CSS module được PostCSS phân tích thành công.
- Rà trình duyệt ban đầu phát hiện tên kỳ bị cắt ở 320 px; đã cho select nguyên hàng và giữ hai nút hành động 44 px ở hàng kế tiếp.
- Kết quả test: `.tmp/timesheet-list-focused-20261016.json`.
- Kiểm tra trình duyệt responsive và bản test do root thực hiện sau khi tích hợp.
