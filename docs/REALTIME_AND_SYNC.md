# Realtime and Sync

## Nguyên tắc

PostgreSQL là source of truth. Realtime chỉ kích hoạt invalidate/refetch; không blind append payload vào state order-sensitive. Mọi subscription phải có scope filter, cleanup khi unmount/user đổi, dedup event và reconcile sau reconnect.

## Foundation triển khai

`lib/realtime/coordinator.ts`, `components/providers/RealtimeProvider.tsx` và `lib/realtime/scopedSubscription.ts` cung cấp:

- channel name chuẩn `ct:<scope>:<table>`;
- bắt buộc filter dạng `column=eq.value`, không cho subscribe cả bảng;
- dedup theo commit timestamp, event type và record/delivery ID;
- trạng thái dùng chung connecting/connected/reconnecting/degraded/offline;
- invalidate lại sau reconnect, online, focus, pageshow và tab resume để bù event mất khi tab ngủ;
- BroadcastChannel để các tab của cùng tài khoản cùng reconcile nhưng không nhân đôi một event;
- fallback reconciliation 60 giây khi tab đang hiển thị;
- `removeChannel` khi cleanup và giới hạn bộ nhớ dedup;
- no-op an toàn khi Supabase browser chưa cấu hình.

Notification bell dùng subscription scope theo `recipient_account_id` và vẫn giữ polling 60 giây làm fallback. Dashboard, attendance, leave, approval inbox, kho, xuất nhập khẩu và thông báo hệ thống đăng ký domain reconciliation; dữ liệu luôn được tải lại qua API có authorization.

## Xác thực Realtime

Phiên chính vẫn nằm trong cookie HttpOnly. Endpoint same-origin `/api/v1/auth/realtime-token` chỉ trả access token ngắn hạn sau khi xác minh cả Supabase user, trạng thái app account và `app_sessions`; không trả refresh token hoặc service-role key, dùng `no-store`, và browser client không persist session. Token được đưa thẳng vào transport Realtime trong bộ nhớ và làm mới định kỳ. Đây là ranh giới tăng bề mặt XSS có chủ đích: CSP phải được giữ chặt, không thêm script bên thứ ba tùy ý và không lưu token vào local/session storage.

Migration `202609150003_realtime_invalidation_bus.sql` tạo outbox chỉ chứa metadata invalidate, policy theo recipient/permission và publication; migration `202609150006_shared_operations_hardening.sql` bổ sung invalidation cho bước duyệt, ủy quyền và workflow. Không phát raw row nghiệp vụ qua bus. Các migration mới chỉ được tạo trong repository; cần review và áp theo checklist trước khi production Realtime hoạt động.

## Workflow nên dùng Realtime

- Notification và approval inbox: scope recipient/assignee, refetch count/list.
- Attendance: scope account/project/site, refetch server-confirmed status.
- Project updates/issues: scope project ID.
- Warehouse: scope warehouse/document; sau posting phải refetch ledger/balance.
- Executive dashboard: invalidate aggregate widget theo domain event, không subscribe toàn bảng.

Không dùng aggressive polling, không tạo subscription trong render và không coi `SUBSCRIBED` là bằng chứng dữ liệu đã mới nhất. Bus cần chạy `purge_realtime_invalidations()` theo lịch để giữ tối đa khoảng hai ngày dữ liệu.
