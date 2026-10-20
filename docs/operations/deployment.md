# Deployment và rollback

## Môi trường

| Environment | Dữ liệu | Secret | Mục đích |
|---|---|---|---|
| development | synthetic | local `.env.local` | phát triển |
| staging | masked/synthetic | secret manager riêng | migration rehearsal, UAT |
| production | dữ liệu thật | secret manager production | vận hành |

Không dùng chung Supabase project hoặc service-role key giữa staging và production. `RELEASE_ENVIRONMENT` và `RELEASE_SHA` bắt buộc phản ánh deployment.

## Quy trình

1. Freeze migration/feature; `npm ci`.
2. Chạy `npm run validate:migrations`, lint, typecheck, test, audit và build trong CI.
3. Tạo snapshot/backup đã kiểm chứng nếu migration có rủi ro dữ liệu.
4. Deploy migration lên staging, chạy rehearsal và reconciliation.
5. Deploy ứng dụng staging, chạy `SMOKE_BASE_URL=... npm run smoke`.
6. Sau phê duyệt, chạy migration production một lần, deploy đúng release SHA, smoke và ghi evidence.

## Rollback

- Lỗi ứng dụng nhưng schema tương thích: rollback artifact về release trước.
- Migration expand/contract: rollback code trước, giữ cột mới; không drop dữ liệu trong cùng release.
- Có transaction mới: snapshot/export delta trước mọi thay đổi; rollback code không đồng nghĩa rollback dữ liệu.
- Dừng và phục hồi nếu login toàn công ty lỗi, phát hiện lỗ hổng critical, mất dữ liệu, stock ledger sai diện rộng hoặc DB corruption.
