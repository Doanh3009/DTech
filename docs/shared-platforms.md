# Nền tảng dùng chung — Prompt 12

## Approval Platform

`approval_cases` chỉ lưu định danh, snapshot hiển thị và workflow version; payload nghiệp vụ vẫn ở bảng domain. `approval_steps` snapshot người duyệt tại lúc submit. Leave được đồng bộ hai chiều qua trigger và adapter; Timesheet Adjustment được index vào lịch sử. Action dùng row lock ở DB, từ chối yêu cầu lý do, reassignment/delegation giữ actor thật và bắt buộc audit.

## Notification Platform

Domain phát `domain_events`; template map bằng `event_key`. Delivery key duy nhất bảo đảm retry không gửi trùng. V1 chỉ giao trong ứng dụng; schema đã giữ channel cho email/Zalo/Slack/push. Quản trị viên sửa template có tăng version; placeholder ngoài whitelist và HTML bị từ chối. Security/system là nhóm bắt buộc. System Notice hỗ trợ toàn công ty, vai trò hoặc phòng ban theo khoảng thời gian hiệu lực.

## Document Platform

Document Center index `file_assets` bằng metadata và `document_links`, không copy binary. Company documents dùng bucket private. Stable route kiểm tra `document.view` cùng quyền Employee/Project/Warehouse/Shipment trước khi cấp signed URL 5 phút. Thay tệp tạo `document_versions`; archive không hard delete.

## Audit Platform

Audit là append-only ở database và API chỉ có GET. UI resolve nhãn action, actor và before/after; sanitizer đệ quy loại password/token/secret/CCCD/banking. `correlation_id` nối approval, notification và domain operation.

## Configuration Platform

`/settings` là index tìm kiếm theo nhóm, dẫn tới typed sub-route. Workflow publish tạo version bất biến. Master data đã sử dụng tiếp tục theo quy tắc inactive; các bảng typed hiện có giữ `active`, version hoặc effective date phù hợp.

## Tác vụ nền

Các hook `approval reminder`, `document.expiring_soon`, `shipment attention` dùng `domain_events.idempotency_key` và `notifications.delivery_key`. Scheduler/provider bên ngoài sẽ được nối ở prompt Integration; không có email/Zalo giả lập trong V1.
