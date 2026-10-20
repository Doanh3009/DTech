# MASTER 02 — Tiến độ thực thi

Cập nhật gần nhất: 2026-09-14 (Asia/Ho_Chi_Minh)

## Baseline

- Repository là modular monolith Next.js 16.3.4, React 19, TypeScript strict, Supabase, Vitest và ESLint.
- Có 17 migration theo thứ tự; các phân hệ HR, chấm công, nghỉ phép, dự án, kho, xuất nhập khẩu, phê duyệt, thông báo, báo cáo và quản trị đã có route/service/schema ở nhiều mức độ hoàn thiện.
- Giữ nguyên toàn bộ thay đổi đang có từ MASTER 01/UI redesign; không reset hoặc ghi đè thay đổi ngoài phạm vi.
- Realtime ban đầu: có helper subscription theo filter và NotificationBell; chưa có coordinator toàn ứng dụng, resume/reconnect/multi-tab reconciliation hoặc ma trận domain đầy đủ.
- RLS: nhiều bảng đã `enable row level security`, nhưng audit migration chỉ thấy policy đọc mapping tài khoản của chính mình. Browser không giữ Supabase access token do token nằm trong cookie HttpOnly; vì vậy không được tuyên bố Postgres Changes đã hoạt động production cho toàn hệ thống.
- Storage dùng bucket private và service/API làm ranh giới chính; policy trực tiếp cho browser chưa đủ bằng chứng để đánh dấu hoàn tất.

### Lệnh baseline thực tế

| Lệnh | Kết quả |
| --- | --- |
| `npm run typecheck` | đạt |
| `npm run lint` | đạt |
| `npm test` | 32 file, 134 test đạt |
| `npm run validate:migrations` | đạt, 17 migration đúng thứ tự |
| `npm run build` | đạt, 224 route; có log fallback `system_settings.read_failed` khi Supabase không phản hồi lúc prerender |

## Trạng thái stage

| Stage | Trạng thái | Bằng chứng / phạm vi | Việc còn lại / hành động an toàn kế tiếp |
| --- | --- | --- | --- |
| 0 — Audit và checkpoint | completed | Audit Git, scripts, routes, migrations, auth, RLS, Storage, Realtime, offline và validation baseline | Duy trì checkpoint sau mỗi thay đổi nguyên tử |
| 1 — Cross-cutting correctness | completed | Coordinator lifecycle, trạng thái trung tâm, dedup, BroadcastChannel, token bridge memory-only, bus invalidation metadata, RLS recipient/permission, publication migration và `REALTIME_MATRIX`; migration đã áp remote | Phải kiểm chứng allow/deny RLS và delivery đa tài khoản bằng user JWT thực tế |
| 2 — HR và attendance | in progress | Queue IndexedDB, lost-response/session-expiry tests, Web Locks đa tab, deterministic photo path/asset ID; kỳ công/ngoại lệ/ca/lịch đã reconciliation theo domain | Cần workflow HR/timesheet persisted và multi-tab IndexedDB trên Supabase staging/browser thật |
| 3 — Leave và projects | in progress | PDF A4 nhúng font Việt và test phân trang; project API/repository giới hạn assigned/managed/created/all; project/worker views có reconciliation; worker photo retry dùng client operation ID + deterministic asset/path | Edge headless lỗi GPU nên PDF chưa visual QA; cần persisted allow/deny, lost-response và roll-call workflow trên staging |
| 4 — Warehouse | in progress | Tạo chứng từ header+dòng bằng command RPC nguyên tử/idempotent; save giữ liên kết shipment line; post/reverse/stocktake ép `can_operate`; posting shipment được khóa và kiểm tra over-receipt tại DB; migration đã áp | Cần concurrency/ledger/balance test bằng dữ liệu nghiệp vụ cô lập |
| 5 — Import/export | in progress | Tạo contract và shipment aggregate bằng command RPC nguyên tử/idempotent; shipment status/customs/lines cùng transaction; receipt chỉ đổi stock qua warehouse posting và DB khóa theo shipment | Cần persisted lifecycle, transition/audit và warehouse-boundary test trên staging |
| 6 — Shared operations | in progress | Approval detail/inbox, notification center và system notice có reconciliation; notification retry không nhân bản/không nuốt lỗi; reassign deterministic; workflow publish nguyên tử và serialize theo code; migration đã áp | Cần approval concurrency, RLS allow/deny và notification delivery test đa tài khoản |
| 7 — UI/UX toàn hệ thống | in progress | Shell/launcher/contextual sidebar/mobile drawer, table scroll/card breakpoints, form grids và offline indicator hiện hữu; static CSS/code audit xác nhận breakpoint 900/760/560/420 và container `min-width:0`/controlled overflow | Chưa thể kiểm tra mọi route authenticated tại 11 viewport/zoom với dữ liệu dài |
| 8 — Full verification | in progress | Migration order, typecheck, lint, local/remote production build 225/225 trang đạt; Supabase push và Vercel production deploy thành công; health live/ready đạt | Theo yêu cầu trực tiếp không chạy test suite; còn integration/concurrency/RLS, smoke authenticated và visual QA |

## Migration và thao tác ngoài repository

- Đã áp thành công bốn migration forward-only `202609150003_realtime_invalidation_bus.sql` đến `202609150006_shared_operations_hardening.sql` lên Supabase project đã link. Kiểm tra sau push xác nhận local/remote khớp đủ 21 migration.
- Đã deploy production Vercel deployment `dpl_H7Rd6dJ8wHhN5Fj3ZDYPf7pZGPkw`, trạng thái `READY`, alias `https://ct-noi-bo.vercel.app`.
- Smoke không cần đăng nhập: `/api/health/live` đạt; `/api/health/ready` đạt và database `healthy` tại thời điểm 2026-09-14 16:48 Asia/Ho_Chi_Minh.

## Defect/risk đang mở

1. Policy RLS mới đã được tạo trên remote nhưng chưa được chạy allow/deny bằng nhiều user JWT; Storage policies ngoài bus vẫn cần kiểm chứng.
2. Token bridge Realtime giữ access token trong memory và không trả refresh/service-role token; vẫn cần security review XSS/CSP trước production.
3. Không có credential/dataset test để chạy RLS, concurrency và end-to-end persisted; PDF local sinh được nhưng Edge headless lỗi GPU nên chưa có bằng chứng visual.
4. Local build từng fallback khi không đọc được `system_settings`; production readiness endpoint hiện xác nhận database healthy.
5. Production có biến `LOG_LEVEl` sai casing; ứng dụng đang dùng fallback `info`, không chặn vận hành nhưng nên chuẩn hóa thành `LOG_LEVEL` ở lần cấu hình kế tiếp.

## Validation gần nhất

| Lệnh | Kết quả |
| --- | --- |
| `npm run validate:migrations` | đạt, 21 migration đúng thứ tự |
| `npm run typecheck` | đạt |
| `npm run lint` | đạt |
| `npm test` | không chạy lại theo yêu cầu trực tiếp của chủ dự án; kết quả baseline gần nhất là 32 file/134 test đạt, lần chạy trước hardening là 37 file/145 test đạt |
| `npm run build` | đạt, compile/TypeScript và 225/225 trang; có log fallback `system_settings.read_failed` khi Supabase không phản hồi lúc prerender |
| Supabase `db push --linked` | đạt; áp migration `202609150003`–`202609150006`, remote đủ 21/21 |
| Vercel production build | đạt, 225/225 trang; deployment `READY` và alias thành công |
| Production health | live `alive`; ready `ready`; database `healthy` |

## Điểm tiếp tục chính xác

Thực hiện smoke authenticated bằng các vai trò đại diện, RLS allow/deny đa tài khoản, warehouse/approval concurrency và visual QA. Cần tài khoản kiểm tra/dataset không ảnh hưởng dữ liệu thật trước khi chạy các bước này.
