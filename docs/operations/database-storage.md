# Database và storage operations

- Dùng Supabase HTTP client/service-role phía server; không mở raw Postgres connection từ mỗi function.
- Theo dõi provider connection/pool, slow query và storage growth. Chỉ chạy VACUUM/ANALYZE theo hướng dẫn/provider, không tự chạy maintenance production.
- Index hot paths được version-control trong migrations; query nặng phải có `EXPLAIN (ANALYZE, BUFFERS)` trên staging có data volume tương đương và lưu evidence ngoài repo nếu chứa dữ liệu.
- Business record/audit không dùng retention của technical log. Integration log/webhook attempt có thể archive sớm hơn sau khi business/legal phê duyệt.
- Generated exports và orphan candidates: detect/report → grace/quarantine → phê duyệt cleanup. Không auto-delete business documents.
- Private buckets gồm attendance/worker photos, employee/leave/project/warehouse/shipment/company docs và imports. `brand-assets` là public theo thiết kế branding; không lưu PII ở bucket này.

Scheduler gọi `POST /api/v1/operations/daily-maintenance` bằng `OPERATIONS_CRON_SECRET` tối đa một lần/ngày business timezone. Job có idempotency/unique running lock, chỉ xóa session/login window/API idempotency đã hết hạn và báo queue lỗi; không xóa business record/file.
