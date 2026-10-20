# Offline Attendance Design

## Durable operation model

Queue IndexedDB hiện tại là nền tảng đúng. Mỗi operation cần: `clientEventId` UUID, owner account ID, project/site context đã biết gần nhất, event type, client captured time, queued time, coordinates/accuracy/permission state, photo metadata/blob reference, retry count, last error và sync state.

State machine:

```text
pending → syncing → synced
    ↘ rejected
    ↘ needs-review
```

UI chỉ báo “Đã lưu trên thiết bị” sau khi IndexedDB put thành công. Chỉ báo “Đã đồng bộ” sau response bền vững từ server. Không hiển thị success server khi mới optimistic.

## Sync protocol

1. Client tạo UUID trước capture và persist operation trước khi gửi.
2. Gửi foreground ngay khi online; retry bounded exponential backoff có jitter.
3. Server unique theo account + client event ID và trả lại record hiện hữu khi retry.
4. Server lưu cả client time và authoritative receive time; rule đánh dấu lệch thời gian lớn.
5. GPS gồm accuracy và permission status; geofence được xác nhận lại phía server.
6. Photo metadata lưu cùng operation; blob upload tách bước nhưng liên kết bằng stable ID. Không xóa blob local trước khi server xác nhận.
7. Khi reconnect hoặc app resume, đọc lại toàn queue và reconcile với API trước khi gửi lại.
8. Rejected/conflict không retry vô hạn; chuyển needs-review với lý do an toàn cho người dùng.
9. Web Locks API khóa đồng bộ theo tài khoản để các tab không upload cùng queue song song; trình duyệt không hỗ trợ Web Locks dùng khóa tuần tự trong tab.
10. Object ảnh và asset UUID được suy ra tất định từ `clientEventId`; lost-response/retry không sinh tên object mới.

## Reliability và security

- IndexedDB tồn tại qua refresh nhưng có thể bị OS/browser dọn; tài liệu người dùng phải nói rõ giới hạn.
- Background Sync không đồng đều, đặc biệt iOS; luôn có foreground fallback.
- Không tin tuyệt đối client clock, GPS hoặc ảnh. Server đánh giá policy, duplicate, assignment và anomaly.
- Queue tách theo account; logout không được gửi operation của người dùng cũ dưới session mới.
- Retry tối đa và kích thước ảnh phải giới hạn để tránh pin/data drain.
- Object tất định chưa liên kết được giữ qua lỗi để retry. Tác vụ dọn orphan chỉ được xóa sau grace period và xác nhận không còn `file_assets`/`attendance_photos` tham chiếu.

Không thêm service worker vì Background Sync không ổn định trên mọi browser; foreground lifecycle vẫn là đường đồng bộ bắt buộc.
