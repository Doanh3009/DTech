# Field Operations — Gói / Công trường

## Phạm vi đã triển khai

- `Hôm nay` là màn vào tác nghiệp: việc ưu tiên, nhân lực, vướng mắc mở và cập nhật gần đây.
- `worksite` được giữ trong URL để deep-link/back/refresh không mất ngữ cảnh.
- Cập nhật tiến độ và báo vướng là hai luồng riêng. Báo vướng dùng `severity` hiện có; không tạo category giả.
- Cập nhật hiện trường được ghi vào IndexedDB trước, sau đó mới đồng bộ API. Nội dung dùng `clientUpdateId`; ảnh dùng `clientAttachmentId` và chỉ bị xóa khỏi hàng đợi sau khi server xác nhận.
- Snapshot dữ liệu đang xem được cache theo `accountId + projectId`; dữ liệu chờ đồng bộ không dùng chung giữa tài khoản.

## Phạm vi dữ liệu theo công trường

Đã lọc thật theo `worksiteId`:

- phân công/roster;
- phiên điểm danh;
- cập nhật hiện trường, vấn đề và tệp đính kèm;
- hồ sơ/tài liệu được tạo từ cập nhật.

## TODO kiến trúc bắt buộc trước khi lọc task theo công trường

`project_progress_nodes`/`ProjectProgressNode` hiện chưa có `worksiteId`. Vì vậy màn Công việc tiếp tục hiển thị dữ liệu **cấp gói** ngay cả khi người dùng chọn một công trường; UI nêu rõ phạm vi này và không lọc giả.

Hướng nâng cấp:

1. Thêm nullable `worksite_id` vào `project_progress_nodes`, foreign key tới `worksites(id)`.
2. Ràng buộc DB/API: worksite phải thuộc cùng project; node con không được lệch worksite của node cha nếu node cha đã có worksite.
3. Bổ sung `worksiteId` vào `projectProgressInputSchema`, repository mapping và query index `(project_id, worksite_id, status)`.
4. Backfill có kiểm soát: node hiện tại giữ `NULL` với nghĩa “cấp gói”, không tự gán công trường đầu tiên.
5. UI hiển thị hai nhóm rõ ràng: “Cấp gói” và công trường đang chọn; chỉ sau migration này mới bật lọc task theo công trường.

## Quy tắc xung đột offline

- Tiến độ gửi giá trị tuyệt đối kèm `rowVersion`; conflict phải dừng và giữ item ở trạng thái lỗi để người dùng thử lại sau khi tải dữ liệu mới.
- Update và attachment retry an toàn nhờ client id duy nhất.
- Ảnh được nén phía client, lưu Blob cục bộ, upload tách khỏi metadata; không xóa trước khi server xác nhận.
