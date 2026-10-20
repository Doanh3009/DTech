# Trình bày tiến độ công việc

Màn hình `/projects/[id]/progress` dùng `ProgressBoard` cho cả desktop và mobile. Màu, khoảng cách, nút, badge, menu và form lấy từ design system hiện có; bố cục nằm tại `ProgressBoard.module.css`. Không thêm mô tả nghiệp vụ dài vào giao diện.

- Tiến độ hiện tại là trung bình phần trăm của các hạng mục gốc chưa hủy. Không cộng đầu việc con lần nữa, không coi đây là tỷ lệ theo trọng số khối lượng/hợp đồng. Khi chưa có hạng mục hợp lệ, không hiển thị phần trăm giả.
- Bộ đếm trạng thái tính từng bản ghi (giai đoạn, hạng mục, đầu việc); nhãn dùng “mục”. Cần xử lý gồm đang vướng, quá hạn hoặc đạt 100% nhưng chưa xác nhận hoàn tất, mỗi mục chỉ tính một lần.
- Hoàn thành chỉ tính trạng thái `completed`. Không suy ra hoàn thành từ phần trăm. Các mục hoàn thành hoặc đã hủy không bị báo quá hạn.
- Giữ thứ tự công việc theo `sortOrder`. Mỗi hạng mục gốc có một thẻ; công việc bên trong có thể thu gọn. Cấp sâu hơn có tên cấp cha, không dùng mức thụt lề khó hiểu trên mobile.
- Lọc theo trạng thái con vẫn giữ thẻ hạng mục gốc làm ngữ cảnh. Tổng hợp phía trên luôn phản ánh toàn bộ dữ liệu gói, không đổi theo bộ lọc.
- Các bản ghi tiến độ hiện chỉ có `projectId`, chưa có `worksiteId`; tổng hợp này là cấp gói. Bộ chọn công trường tiếp tục cung cấp ngữ cảnh khi ghi nhật ký hiện trường, không được giả lập việc lọc tiến độ theo công trường.
- Nút Cập nhật phải mở đúng bản ghi được chọn, kể cả giai đoạn. Quyền sửa, quyền cập nhật hiện trường và API nghiệp vụ hiện có tiếp tục được áp dụng.

Kiểm tra: `npm test -- src/features/projects/components/package-workspace/ProgressBoard.test.tsx`; kiểm tra giao diện thật không ghi dữ liệu: `node scripts/progress-board-qa.mjs` (máy chủ phát triển và tài khoản thử nghiệm phải sẵn sàng).
