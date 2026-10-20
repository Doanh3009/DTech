# Integration Platform

## Ranh giới API

Ứng dụng nội bộ tiếp tục dùng session tại `/api/v1`. Máy và hệ thống bên ngoài chỉ dùng hợp đồng riêng tại `/api/external/v1`, xác thực bằng API key gắn với service account, scope, IP allowlist và rate limit. External API không cung cấp quyền truy cập database hay tái sử dụng session nhân viên.

Các endpoint danh sách dùng phân trang có giới hạn và whitelist bộ lọc. Endpoint ghi sự kiện máy chấm công yêu cầu `Idempotency-Key`; mọi phản hồi lỗi có `request_id`. CORS không mở wildcard.

## Secret

- API key chỉ hiện một lần; database chỉ lưu HMAC-SHA-256 hash với `API_KEY_PEPPER`.
- Webhook secret chỉ hiện khi tạo/rotate và được mã hóa AES-256-GCM bằng `INTEGRATION_ENCRYPTION_KEY`.
- Secret không nằm trong integration config, response danh sách hoặc log.
- `INTEGRATION_WORKER_SECRET` bảo vệ worker endpoint.

Ba giá trị trên phải là secret ngẫu nhiên tối thiểu 32 ký tự và chỉ tồn tại ở môi trường server.

## Outbound webhook

Payload chuẩn có `id`, `event`, `version`, `occurred_at` và `data`. Chỉ event/version có trong `event_schema_registry` mới được đăng ký và gửi. Chuỗi ký là:

```text
canonical = timestamp + "." + raw_body
signature = HMAC-SHA256(secret, canonical)
X-ChauTuan-Signature: v1=<hex>
```

Receiver nên từ chối timestamp lệch quá 300 giây và deduplicate theo `X-ChauTuan-Delivery-Id`. Sender chỉ gọi HTTPS, kiểm tra DNS/IP công khai, chặn localhost, private, link-local và metadata IP, đồng thời không theo redirect.

Retry áp dụng cho timeout/network, `429` và `5xx` theo nhịp 1 phút, 5 phút, 30 phút, 2 giờ, 12 giờ, có giới hạn attempt và dead letter. `400/401/403/404` là lỗi vĩnh viễn. Manual retry giữ nguyên delivery/event và nối thêm attempt log.

## Inbound webhook

Endpoint inbound dùng HMAC timestamp, giới hạn 1 MB và deduplicate `provider_event_id`. Controller xác thực rồi chuyển qua business service. Máy chấm công chỉ tạo raw attendance event; không ghi trực tiếp Daily Timesheet. Event chưa map nhân viên được giữ trong unmatched queue.

## Registry, sync và import

Registry khai báo connector, capability, hướng sync, source of truth, conflict policy và health. MISA, Power BI, Zalo, Email và attendance adapter hiện là hợp đồng nền; chưa có provider thật nên không báo connected và không giả lập request thành công.

Sync job có idempotency key, cursor/checkpoint và khóa tránh hai job cùng loại chạy đồng thời. External ID nằm ở bảng mapping dùng chung. Conflict manual-review và mọi quyết định đều có audit.

Import CSV/XLSX chạy dry-run trước, giới hạn 10 MB/10.000 dòng, chỉ nhận type và upsert policy đã khai báo, lưu file private và có báo cáo lỗi theo dòng. `EMPLOYEE_MASTER` mới dừng ở dry-run; `ATTENDANCE_DEVICE_MAPPING` là type duy nhất hiện có bước execute.

## Vận hành

Scheduler gọi `POST /api/v1/integrations/worker` với `Authorization: Bearer <INTEGRATION_WORKER_SECRET>`. Trang quản trị API docs cung cấp OpenAPI 3.1 từ `/api/v1/integrations/openapi` sau kiểm tra quyền `api_docs.view`.

## Giới hạn hiện tại

- Chưa có credential và tài liệu provider thật cho MISA, Power BI, Zalo hoặc Email, nên adapter chỉ trả `NOT_CONFIGURED` và không thực hiện I/O.
- Sync job có model, idempotency/checkpoint và hàng đợi; provider worker cụ thể chỉ được thêm khi có hợp đồng API thật.
- SSRF sender xác minh DNS trước khi gửi và chặn redirect; triển khai cần kết hợp egress firewall/proxy để chống DNS rebinding ở tầng hạ tầng.
- Malware scanning cho file import là hook tương lai; parser không chạy macro và chỉ nhận CSV/XLSX.
