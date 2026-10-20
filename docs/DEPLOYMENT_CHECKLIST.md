# Deployment checklist — Vercel + Supabase

## Trước khi deploy

- [x] Review phạm vi migration `202609150003_realtime_invalidation_bus.sql` đến `202609150006_shared_operations_hardening.sql` và dry-run đúng bốn file.
- [x] Chạy `npm run validate:migrations`, `npm run typecheck`, `npm run lint` và `npm run build`; test suite được bỏ qua theo yêu cầu trực tiếp.
- [ ] Xác nhận `.env.local` không được commit và browser bundle không có service-role key.
- [ ] Cấu hình `NEXT_PUBLIC_SUPABASE_URL`, publishable/anon key, `SUPABASE_SERVICE_ROLE_KEY` hoặc secret key server-only.
- [ ] Cấu hình `SESSION_HASH_PEPPER` tối thiểu 32 ký tự và các secret integration theo module đang bật.
- [ ] Cấu hình `APP_BASE_URL`, `APP_TIMEZONE=Asia/Ho_Chi_Minh`, release SHA/environment.

## Supabase staging trước production

- [ ] Backup và kiểm tra restore gần nhất.
- [x] Áp migration theo đúng thứ tự trên project đã link; kiểm tra lại remote khớp 21/21 migration.
- [x] Migration publication thêm `realtime_invalidations` và `notifications` đã thực thi không lỗi; vẫn cần smoke subscription bằng user JWT.
- [ ] Kiểm tra RLS: recipient nhận notification của mình; user thiếu permission không đọc invalidation domain; cross-account bị từ chối.
- [ ] Kiểm tra anon không đọc được `notifications`, `realtime_invalidations`, file hoặc row nghiệp vụ.
- [ ] Xác nhận bucket tài liệu/ảnh private và download chỉ qua signed/authorized endpoint.
- [ ] Lập lịch gọi server-side `purge_realtime_invalidations()`; không cấp execute cho browser roles.
- [ ] Chạy thử concurrent warehouse posting, approval và attendance idempotency trên dữ liệu staging.
- [ ] Kiểm tra RPC tạo chứng từ/contract/shipment, publish workflow và reassign chỉ cấp execute cho `service_role`.
- [ ] Chạy đồng thời hai receipt cùng shipment để xác nhận khóa/tolerance và ledger rollback cùng transaction khi vượt giới hạn.

## Vercel

- [x] Production có Supabase URL/publishable key và các server secret bắt buộc; secret không dùng tiền tố `NEXT_PUBLIC_`.
- [ ] Giữ CSP/security headers; review trước khi thêm third-party scripts vì access token Realtime chỉ nằm trong memory.
- [ ] Cấu hình Supabase Auth Site URL/redirect URLs đúng preview/production URLs thực tế.
- [ ] Kiểm tra giới hạn thời gian/kích thước cho PDF, Excel, upload và background integration jobs.
- [x] Kiểm tra `/api/health/live` trả `alive`, `/api/health/ready` trả `ready` và database `healthy` sau deploy.

## Smoke test sau deploy

- [ ] Login → launcher → module theo quyền → logout.
- [ ] Hai tài khoản/two tabs: notification, approval, attendance, warehouse posting, shipment status cập nhật và reconcile đúng.
- [ ] Tắt mạng/ngủ tab/mở lại: trạng thái chuyển offline/reconnecting và dữ liệu được refetch.
- [ ] Queue chấm công giữ nguyên sau refresh/session expiry; retry cho đúng một record.
- [ ] PDF nghỉ phép và Excel bảng công tải được, đúng tiếng Việt/timezone và permission.
- [ ] Kiểm tra viewport đại diện mobile/tablet/desktop với tài khoản từng vai trò.

Deploy chỉ được đánh dấu hoàn tất sau khi các mục staging và smoke test có bằng chứng. Repository hiện chưa thực hiện deploy remote.
