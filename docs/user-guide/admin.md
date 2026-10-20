# Hướng dẫn Admin/IT — release 0.1.0

Provision bằng Supabase invite/first-admin script, không tạo password mặc định. Gán least privilege; review admin, sensitive export, warehouse post/reverse, API key và audit-sensitive trước go-live. Trang **Vận hành** kiểm tra DB/storage/backup status, integration và jobs. `Unknown` không được coi là healthy.

Secret chỉ ở platform secret manager. Rotate theo security runbook; revoke session/account khi nghi ngờ. Config critical cần reason/audit. Không chạy migration production trước staging rehearsal/backup/rollback approval.
