# BHXH: hồ sơ từng người và quá trình đóng

Ngày rà soát: 16/10/2026 (Asia/Saigon).

## Giao diện

- Mở hồ sơ bằng tên nhân viên hoặc nút **Xem chi tiết**, kể cả tài khoản chỉ có `insurance.view`.
- Hồ sơ hiển thị mã số BHXH, tình trạng tham gia, ngày bắt đầu, các khoản BHXH/BHYT/BHTN, mức lương và tỷ lệ hiện tại, thời điểm cập nhật.
- Kỳ gần nhất lấy từ các kỳ thực sự đã ghi nhận. Bảng tháng hiển thị mức lương, tỷ lệ, số tiền tạm tính, số tiền đã đóng, tình trạng và ngày đóng. Điện thoại trình bày cùng dữ liệu thành từng hàng dạng thẻ.
- Các tháng không có dữ liệu không tự sinh. Chưa có kỳ đóng hiển thị **Chưa ghi nhận kỳ đóng**. Tiền thực đóng hoặc ngày đóng chưa biết hiển thị `—`.
- Dữ liệu hồ sơ hiện tại tách khỏi dữ liệu từng kỳ. Điều chỉnh lương đóng hiện tại không thay số tiền/lương của những kỳ trước.
- Tab **Lịch sử điều chỉnh** chỉ xuất hiện với quyền `insurance.history.view`; đây là nhật ký thay đổi hồ sơ, tách khỏi quá trình đóng tháng.

## Ghi nhận kỳ đóng

- Tài khoản có `insurance.edit` được ghi nhận và sửa từng kỳ. `employeeId + contributionMonth` xác định kỳ; cập nhật gửi `expectedUpdatedAt` để ngăn ghi đè thay đổi mới.
- Số tiền thực đóng và ngày đóng chỉ nhập khi tình trạng là **Đã đóng**. Chuyển về chưa đóng/chậm đóng xóa các trường này khỏi bản gửi.
- Dữ liệu đã nhập được giữ khi lưu lỗi. Có khóa thao tác lặp trong lúc lưu; không đóng biểu mẫu đang lưu.
- Nếu ghi thành công nhưng tải lại lỗi, chỉ hiện **Tải lại**, không gửi thêm lệnh ghi.
- Biểu mẫu hồ sơ vẫn giữ chọn nhân viên, điều chỉnh trạng thái, các khoản tham gia và tải tài liệu. Gửi `recordContribution: false` để chỉnh hồ sơ riêng với sổ kỳ đóng.

## Kiểm tra

- `InsuranceConsole.test.tsx` và `InsuranceDetails.test.tsx`: **13/13 đạt**.
- Bao gồm quyền chỉ xem, mở đúng người và giữ bộ lọc khi quay lại, không suy diễn tháng còn thiếu, phân biệt lương hiện tại và lương kỳ cũ, giữ dữ liệu khi xung đột, loại thông tin thanh toán khi đổi trạng thái, chống gửi lặp, lỗi tải lại sau khi lưu, thao tác bàn phím cho tab.
- ESLint các tệp TS/TSX thuộc thay đổi đạt; hai CSS module phân tích cú pháp thành công.
- Kết quả máy đọc: `.tmp/insurance-detail-tests-20261016.json`.
- Kiểm tra Chrome ở 320/390/768/1440 px phát hiện phần kỳ gần nhất bị co còn đường viền trong lưới của vùng cuộn. Đã đặt hàng lưới theo chiều cao nội dung và giữ chiều cao tối thiểu của phần kỳ đóng. Kiểm tra hình học sau sửa đạt 4/4: tiêu đề cao ít nhất 60 px, dữ liệu tiền cao ít nhất 82 px, vùng nội dung giữ cuộn được; không có lỗi JavaScript.
- Ảnh và kết quả hình học: `docs/ui-evidence/insurance-timesheet-20261016/current-period-fix/report.json`.
- TypeScript toàn bộ dự án ở lần chạy của nhánh giao diện này chỉ báo lỗi fixture `EmployeeTimesheetMobile.test.tsx` đang được tác vụ khác cập nhật; không báo lỗi trong các tệp BHXH của tác vụ này. Kết quả kiểm tra tổng hợp và ảnh responsive do tác vụ chính ghi nhận riêng.

## Phạm vi dữ liệu

Đây là sổ dữ liệu BHXH do người có quyền ghi nhận trong hệ thống. Giao diện không tự xác nhận trạng thái từ cơ quan BHXH và không tự gán tỷ lệ đóng pháp định hay khoản thanh toán còn thiếu.
