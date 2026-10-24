# Bảo mật và cách ly

Hiện có: Supabase Auth + HttpOnly sessions, session registry/revoke/throttle, RBAC/service scope, private buckets/signed URLs, upload checks, origin/security headers, audit/redaction. Xem `docs/operations/security-runbook.md`.

`getRequestUser` kiểm tra activation API và thu hẹp permission; `ProtectedAreaLayout` và domain services là boundary phía server. Service-role bypass RLS: không được dựa riêng vào RLS.

Rủi ro cần gate: rehearsal Auth thật và Storage ownership, query errors bị nuốt, multi-role IDOR/export/search, disabled capability trên mọi route alias, permissions của cron/integrations, private file download và retention dữ liệu phục hồi.

Profile/offboarding command kiểm tra lại active actor và quyền edit/offboard, CAS, dữ liệu ngày sau merge; lưu profile, disable account, revoke app sessions, history và audit trong cùng transaction. Status/role/account lifecycle dùng chung advisory lock để bảo vệ final admin và tránh cấp/kích hoạt tài khoản sau nghỉ việc. Helper nội bộ bị thu hồi EXECUTE kể cả service role; public commands chỉ service role execute, search_path rỗng.

Migration account recovery `202610220002` và sensitive/archive `202610220003` đã áp dụng trên DTech development. Provisioning ghi reservation trước Auth, kiểm tra reserved UUID/email/operation marker rồi hoàn tất account/roles/history/audit nguyên tử; không tự xóa Auth khi timeout hoặc mất response. Deletion dùng `account.delete`, thu hồi access và ghi tombstone/cleanup trước khi gọi Auth DELETE. Tạo login với role khác `employee` còn cần `account.assign_role`; SQL kiểm tra lại quyền ở prepare, complete, cancel và recovery. Thông tin nhạy cảm và archive có CAS/version chung; history/audit nhạy cảm chỉ chứa tên trường và version. [Hướng dẫn account](account-lifecycle-recovery-guide.md), [hướng dẫn nhân sự](employee-auxiliary-command-guide.md).

Auth INSERT có marker DTech phải khớp reservation còn prepared; Auth DELETE bị chặn khi còn link account; app session INSERT chỉ được tạo cho account active, chưa tombstone. Chúng dùng cùng giao thức lock trên một instance PostgreSQL với isolation `READ COMMITTED`. Trigger Auth có phạm vi cụ thể và có thể chặn luồng Auth nếu không tương thích; chưa chứng minh mọi workflow GoTrue. Native lifecycle có 165 checks với Auth stub, không chạy full Supabase stack hay tạo/xóa Auth thật để nghiệm thu. Direct writers và managed Auth/schema changes vẫn cần review riêng.

Generated password và credential fingerprint dùng HMAC với `SESSION_HASH_PEPPER`; plaintext không lưu DB/localStorage. Mật khẩu tự sinh chỉ có thể được trả cho creator trong 15 phút từ prepare, không reset password Auth hiện có. Rotation secret cần kiểm kê pending operation và hủy/cleanup rồi tạo lại yêu cầu không còn khớp key; không ghi đè fingerprint để tiếp tục. Payload/receipt/tombstone giữ login identifiers, role, actor và fingerprint; lý do tự do có thể chứa PII. Chưa có purge/erasure tự động.

Recovery có ở `/settings/users` và inline trong tab Tài khoản nhân sự. Quyền mở tab hiện hữu vẫn áp dụng; người có `account.create`/`account.delete` không cần `user.view` chỉ để phục hồi yêu cầu của nhân sự đó. Pending list và action được kiểm tra đúng loại thao tác/quyền hiện tại phía SQL. Cleanup và cancellation vẫn dùng được khi module HR tắt; tạo mới hoặc resume provisioning prepared yêu cầu HR bật.

Đợt P1 thay fallback activation bằng strict reader: `readSystemSettings`/`readSettingsGroup` chỉ nhận bản đọc Supabase thành công có group `modules` hợp lệ. Cache đã xác minh có hiệu lực tối đa 30 giây; hết hạn phải chờ đọc lại. Timeout 2 giây, query lỗi, thiếu/sai group module hoặc thiếu credentials trong production trả `NETWORK_ERROR` (503); không dùng default bật toàn bộ module. Các request đồng thời dùng chung lượt đọc, lỗi được giãn retry 1 giây. Publish một group giao diện không gia hạn cache module; response cũ không ghi đè publish mới.

`readPresentationSettings` chỉ dùng trong root layout/metadata và trang login. Khi strict reader lỗi, hàm giữ thương hiệu gần nhất (hoặc default trung lập khi cold start), tắt mọi flag theo registry và không thay đổi cache đã xác minh. API, authorization và nghiệp vụ tiếp tục dùng strict reader. Login ẩn danh vẫn render; phiên đã đăng nhập cần cấu hình hợp lệ để được chuyển vào ứng dụng. Unit tests có cold start, timeout, corruption, hết hạn, phục hồi và race publish/refresh. Đây chưa phải bằng chứng outage test trên hạ tầng nhiều instance.

Tương thích: ba flag cũ tùy chọn `accounting`/`operations`/`messaging` vẫn giữ quy tắc mặc định bật khi group hợp lệ thiếu flag; các bản cài mới phải tạo đủ flag. Cấu hình activation không phải entitlement hợp đồng. Thay đổi từ process khác có độ trễ tối đa 30 giây; chưa có invalidation liên process. Cần tiếp tục rà soát đường cron/external API, route alias và dependency module.

P0 bổ sung production guard cho `/ui-preview/*`; gallery Design DNA được giữ ở route quản trị có quyền. `/testing` và `__ui` đã có guard riêng.

Activation P2 dùng RPC service-role only nhưng kiểm tra lại active actor, system_admin và quyền từng group. Receipt RLS/ACL cấm đọc/execute từ anon/authenticated; service role cũng không ghi trực tiếp receipt. UI/API/CLI kiểm tra snapshot đầy đủ và CAS; settings/history/audit/receipt rollback cùng transaction. Có 56 native PostgreSQL checks và DTech development publish/retry/conflict evidence. Metadata before/after, request/version chỉ nằm trong DB được phân quyền; báo cáo public không chứa snapshot hoặc tài khoản.

Bản nháp wizard có thể chứa thông tin liên hệ doanh nghiệp trên localStorage. Scope account/app/Supabase origin ngăn khôi phục nhầm trong UI, không phải cơ chế mã hóa hoặc cách ly khỏi người có quyền truy cập trình duyệt. Lưu bản nháp là hành động rõ ràng; xóa bằng Bỏ bản nháp. Retention trên thiết bị dùng chung và full cross-role security pilot vẫn thuộc release review.

Hai deployment dùng hạ tầng riêng là quyết định kiến trúc; **chưa có bằng chứng adversarial isolation test hai instance**. Không quảng bá shared-db multi-tenant.

Không đưa credentials, cookies, token hoặc PII thật vào inventory/SBOM/báo cáo công khai. Retention, legal privacy và dữ liệu kết thúc hợp đồng cần owner review theo địa bàn khách hàng.
