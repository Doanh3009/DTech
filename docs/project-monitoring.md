# Project Updates, Issues và Monitoring

## Data model

Migration `202609120001_project_monitoring.sql` bổ sung:

- `projects.health`, cấu hình báo cáo hằng ngày và ngưỡng stale.
- `project_update_types` cho sáu loại cập nhật mặc định.
- `project_updates` tách trạng thái nội dung, trạng thái phát hành và trạng thái đồng bộ.
- `project_update_versions` lưu before/after của mỗi lần sửa.
- `project_issues` và `project_issue_history` quản lý vòng đời vấn đề độc lập với update.
- `project_health_history` lưu thay đổi tình trạng dự án do người có quyền xác nhận.
- `project_update_attachments` tham chiếu `file_assets`; ảnh điểm danh có thể được tham chiếu qua `source_attendance_photo_id` mà không sao chép binary.
- `project_domain_events` là outbox cho notification/report integration.

Các index timeline, dashboard, issue attention, full-text đơn giản và event chưa xử lý được tạo trong migration. Bucket `project-update-files` là private, giới hạn 10 MB và whitelist MIME.

## Routes và UI

- `/projects/:id/overview`: tình trạng, điểm danh, cập nhật ghim và cập nhật mới nhất.
- `/projects/:id/updates`: timeline có filter/search và cursor.
- `/projects/:id/updates/new`: form ngắn, camera sau, file, draft local và draft server.
- `/projects/:id/updates/:updateId`: chi tiết, issue, attachment, edit, pin và archive.
- `/projects/:id/team`, `/schedule`, `/worker-attendance`, `/documents`, `/history`: tab route-backed.
- `/project-monitoring`: tổng quan quản lý/Ban giám đốc, cần chú ý và cập nhật mới.
- `/project-monitoring/issues`: trung tâm vấn đề, resolve/reopen.
- `/project-monitoring/recent`: toàn bộ cập nhật gần đây.

Phiên điểm danh có `work_note` cung cấp action tạo draft update với project/worksite/session được điền sẵn.

## Permissions và scope

Nhóm quyền mới:

- `project_update.*` cho create/view/edit/archive/pin.
- `project_issue.*` cho view/manage/resolve.
- `project_health.update` cho tình trạng tổng thể.
- `project_monitoring.*` cho dashboard theo phạm vi hoặc toàn công ty.

Repository luôn kiểm tra permission và membership dự án ở server. File private của update cũng kiểm tra lại phạm vi dự án trước khi cấp signed URL. Service-role không được dùng như một cơ chế thay thế authorization.

## Dashboard

Dashboard dùng query giới hạn cho cập nhật gần nhất và issue, không tải toàn bộ timeline. Cờ “Chưa có cập nhật gần đây” độc lập với health và không tự đổi dự án sang chậm tiến độ. Thứ tự cần chú ý là Critical, High, Medium, Low, sau đó vấn đề cũ hơn.

## Integration

Domain event được phát cho:

- `project.update.created`
- `project.issue.created`
- `project.issue.high`
- `project.issue.resolved`
- `project.health.changed`

`projectReportData` cung cấp DTO/service hook cho báo cáo cập nhật, issue và lịch sử health. PDF/Excel báo cáo chưa được sinh trong phạm vi này.

## Tests

Unit test bao phủ auto-title, validation issue/severity, health delayed reason, stale flag, attention ordering và cảnh báo issue trước khi đóng dự án. Bộ test toàn dự án, lint, typecheck và production build được chạy trước khi bàn giao.

## Known limitations

- Comment và mention chưa triển khai; data model không khóa khả năng bổ sung sau.
- Offline V1 lưu text draft trong local storage. Tệp được tải sau khi update đã tạo; nếu lỗi, nội dung vẫn tồn tại và UI thông báo số tệp cần tải lại.
- Chưa có Task, Milestone, Kanban, Gantt, WBS hoặc phần trăm tiến độ.
- Notification outbox đã có nhưng worker gửi email/push phụ thuộc hạ tầng tích hợp ở bước triển khai vận hành.
