# Payslip delivery SQL review — 16/10/2026

## Migration under review

- File: `supabase/migrations/202610160002_payslip_delivery_outbox.sql`.
- SHA-256: `99c74bdb47f032978ad90506445ec8f3cfa41e262cdad21bbef5bbe3c3800cf8`.
- The SQL claim limit was changed from 200 to **40**, matching the bounded application worker.
- This review did **not** persist the migration.

## Real PostgreSQL verification

The guarded script `.tmp/verify-payslip-delivery-outbox-20261016.mjs` verified the owned TEST project `lgmlkagcytfjazulgfbz`, its active provider state, bootstrap owner, project manifest, unapplied migration and unchanged production CLI link before running a single transaction ending in `ROLLBACK`.

**35 assertions passed**, including:

- Existing published snapshots do not create delivery jobs during migration.
- The real payroll calculate, review and lock functions prepare the fixture. Bulk publication with a disabled recipient rolls back new snapshots, delivery jobs and payroll status/version.
- A trigger injects an error on the chat delivery row. Publication rolls back the snapshot and both channel jobs.
- A valid publication creates notification and chat jobs together. Explicit retry can enqueue an old published snapshot; repeating enqueue does not duplicate jobs.
- Disabled actors, missing/revoked snapshots and null claim tokens are rejected.
- Employee-scoped claims set leases, attempts and claim tokens. Unexpired leases are excluded; failed and expired jobs can be retried.
- A 44-job fixture claims 40 then 4 jobs; expired-lease recovery remains bounded to 40.
- Revocation cancels pending, processing and failed jobs while preserving completed delivery receipts.
- Duplicate direct-conversation keys and duplicate message delivery metadata produce real unique violations. Ordinary messages remain unrestricted by the partial delivery index.
- Catalog privileges and an actual `authenticated` role query confirm that delivery rows cannot be read directly by user accounts.

## Rollback proof

Report: `.tmp/payslip-outbox-sql-report-20261016.json`.

Before and after the transaction, TEST retained **51 migrations**, with no `payslip_deliveries` table or delivery metadata index. Employee/account/timesheet/salary/payroll/payslip/message/conversation/notification/audit counts matched. Payroll period and payslip row digests matched. Existing messages contained no `payslipDeliveryId` metadata before migration. The production CLI project link remained unchanged.

## Verification boundary

The claim function's real PostgreSQL execution and definition include `FOR UPDATE ... SKIP LOCKED`; sequential lease and retry exclusions were exercised. Simultaneous lock contention across two sessions was not exercised, because the new outbox table existed only inside the uncommitted rollback transaction. Application delivery side effects and receipt handling are verified separately by application tests and release checks.
