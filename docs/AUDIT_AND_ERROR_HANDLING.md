# Audit and Error Handling

## Audit event contract

Event nhạy cảm gồm actor, action, module/resource, entity ID/reference, UTC timestamp, source, correlation/request ID, severity, before/after đã lọc, reason và metadata tối thiểu. Không ghi password, access/refresh token, secret, raw file, full location/photo hoặc personal data không cần thiết.

`recordAuditLog` chạy ở server, sanitize payload, ghi `audit_logs` và structured log. Audit persistence failure được log riêng; mutation quan trọng cần quyết định fail-closed theo nghiệp vụ thay vì mặc định bỏ qua.

Action naming: `<module>.<resource>.<verb>`; ví dụ `warehouse.receipt.posted`, `auth.session.revoked`, `system_settings.publish`.

## Error boundary

- Validation: Zod tại API boundary, thông báo tiếng Việt theo field khi an toàn.
- Authentication/authorization: 401 và 403 tách biệt; UI có login/permission-denied state riêng.
- Conflict/idempotency: 409, hướng dẫn reload hoặc trả record hiện hữu.
- Network: giữ dữ liệu local khi có queue; retry có giới hạn.
- Server/database: không trả raw error, stack hoặc SQL; response có request ID.
- Logging: structured event + request ID + safe metadata; không dùng `console.log` cho dữ liệu nhạy cảm.

## Recoverability

GET/read có retry/refetch rõ. Mutation chặn double submit, dùng pending state và chỉ xác nhận sau durable response. Warehouse posting, attendance/offline và integration delivery dùng idempotency key. Realtime error chuyển về API refetch/poll fallback.
