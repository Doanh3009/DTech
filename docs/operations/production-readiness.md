# Production readiness

Ngày rà soát: 2026-09-14. Trạng thái kỹ thuật hiện tại: **NOT READY**.

## Đã có trong mã nguồn

- Supabase Auth bằng password provider; access/refresh token chỉ nằm trong cookie HttpOnly, SameSite=Lax, Secure ở production.
- Mapping `auth.users` → `app_accounts`; trạng thái tài khoản và quyền được đọc lại phía server cho mỗi request.
- Session registry, revoke/logout, login throttling theo tên tài khoản + IP hash; mật khẩu do Supabase Auth quản lý.
- Origin check cho request ghi, CSP/security headers, schema whitelist, kiểm tra quyền phía server.
- File upload kiểm tra size/MIME/extension/magic bytes; tên object do hệ thống sinh; signed URL sau authorization.
- Structured logs, request/error ID, error boundary, liveness/readiness và trang `/system-admin/operations`.
- Migration có thứ tự, validator migration, CI quality gate và script smoke test.

## Điều kiện chưa có bằng chứng

| Hạng mục | Trạng thái | Bằng chứng cần có |
|---|---|---|
| Production/staging deployment | NOT READY | URL, release SHA, cấu hình env đã duyệt |
| Backup DB/object storage | NOT READY | Policy thực tế từ provider, retention, access review |
| Restore drill | NOT READY | Log restore staging + reconciliation + file sample |
| Dữ liệu migration | NOT READY | Source checksum, dry-run, error report, sign-off |
| UAT/pilot | NOT READY | Chữ ký business owner theo module |
| GPS/camera/offline thực địa | NOT READY | Thiết bị/site pilot evidence |
| Permission review người thật | NOT READY | Danh sách admin/export/post/approver được duyệt |
| Support/hypercare owner | NOT READY | Tên người/on-call/channel đã xác nhận |

Không được đổi trạng thái thành READY chỉ vì build/test code thành công. Quyết định business GO thuộc cuộc họp GO/NO-GO.
