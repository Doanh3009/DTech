# Migration runbook

1. Nhận source qua kênh kiểm soát truy cập; record owner/version/SHA-256; không commit.
2. Copy sang staging secure workspace, scan malware, đưa source vào read-only/freeze.
3. Chạy `npm run migration:dry-run -- <file> --type=<entity>` cho inventory foundation; sửa mapping/script bằng review, không sửa source âm thầm.
4. Import theo dependency: org master → employee → account invite → projects → leave opening → warehouses/items → opening stock → shipments.
5. Mỗi batch ghi `data_migration_batches`, checksum/mode/count; lỗi vào `data_migration_errors`. Rerun dùng checksum + entity + mode để tránh trùng.
6. Reconcile counts/sums/references trên staging; business owner ký. Chạy rehearsal ít nhất một lần nữa với final source/delta.
7. Production chỉ sau backup verified và GO; giữ log/batch ID, archive source encrypted theo retention.

Script generic hiện chỉ dry-run schema/key/duplicate cho departments, positions, employees, projects, warehouses và inventory_items; executor theo domain phải gọi business service/RPC thật. Vì chưa có source/schema đã duyệt, production execute cố ý không được cung cấp để tránh import sai.

Rollback: batch chưa có business transaction có thể reverse bằng domain-specific compensating operation; đã post leave/stock phải dùng ledger reversal/adjustment, không delete hoặc edit balance. Snapshot và delta phải được giữ.
