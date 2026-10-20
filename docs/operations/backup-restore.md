# Backup, restore và disaster recovery

Hiện chưa có deployment/provider được khai báo trong repo, vì vậy backup và restore drill là **NOT VERIFIED**.

## Mục tiêu đề xuất để business/infra phê duyệt

- RPO: 24 giờ khi chỉ có daily backup; mục tiêu thấp hơn chỉ khi PITR được bật và kiểm chứng.
- RTO: 8 giờ cho phục hồi có phối hợp DB + object storage. Đây là target, không phải SLA đã đo.
- DB: encrypted daily backup, 14 daily + 8 weekly + 12 monthly (phải điều chỉnh theo policy pháp lý/provider).
- Object storage: versioning/replication hoặc independent encrypted copy; metadata DB và binary phải cùng restore point.

## Restore drill trên staging

1. Ghi backup ID, thời điểm, checksum/export metadata; không tải dump vào repo/public drive.
2. Restore DB vào Supabase project staging cô lập.
3. Restore/copy các private bucket; kiểm tra access policy.
4. Áp dụng migration còn thiếu bằng quy trình chuẩn.
5. Kiểm tra auth mapping và tạo tài khoản test riêng, không dùng credential production.
6. Đối chiếu số lượng employee, attendance mới nhất, leave request/ledger, stock ledger/balance, shipment và audit.
7. Mở mẫu private file qua canonical signed route; không dùng URL đã lưu cũ.
8. Chạy smoke/regression, ghi actual RPO/RTO, lỗi và người xác nhận.

`BACKUP_LAST_VERIFIED_AT` chỉ được đặt sau drill thành công có evidence. Không đặt giá trị giả để health page xanh.

## Sự cố

- DB unavailable: giữ liveness, readiness 503, ngừng request ghi; kiểm tra provider rồi failover/restore theo phê duyệt.
- Storage unavailable: không rollback giao dịch DB đã commit; đánh dấu upload/job lỗi để retry.
- Credential compromised: thu hồi/rotate provider credential, deploy secret mới, revoke session/API key liên quan, audit phạm vi.
- Queue stuck: dừng worker, đo oldest queued/failed, xử lý nguyên nhân, retry theo idempotency key.
