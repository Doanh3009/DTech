# Security runbook

## Secret rotation

1. Tạo secret mới trong provider/secret manager; không gửi qua chat hoặc commit.
2. Cập nhật staging, smoke; sau đó production trong change window.
3. Thu hồi secret cũ sau khi xác nhận traffic dùng secret mới.
4. Với API/webhook key, dùng rotate/revoke và theo dõi failed delivery.
5. Với `SESSION_HASH_PEPPER`, việc rotate làm các session/rate-limit hash cũ không còn hợp lệ; lên kế hoạch force logout.
6. Ghi audit/change ticket, owner và thời điểm; không ghi giá trị secret.

## Suspicious login / compromised account

- Disable/lock `app_accounts`, revoke `app_sessions`, reset Supabase credential theo provider.
- Kiểm tra audit log, API keys, sensitive exports và thay đổi role kể từ thời điểm nghi ngờ.
- Không log password/token/cookie; support không bao giờ yêu cầu password.

## First admin

Sau khi chạy migrations: đặt mật khẩu mạnh trong biến tiến trình `BOOTSTRAP_ADMIN_PASSWORD`, rồi chạy `npm run bootstrap:admin -- --username=<username> --name=<name>`. Với admin hiện hữu, dùng `npm run bootstrap:admin -- --existing-email=<email>` để giữ username và tên hiển thị. Script tạo/cập nhật tài khoản active, gán role admin và không gửi email. Không có password mặc định.

## File/malware

Repo mới có type/signature validation, chưa có malware scanner. Nếu hạ tầng có scanner, upload phải đi qua quarantine → scan → available. Cho đến khi tích hợp, đây là known risk cần business/IT chấp thuận.
