# Roadmap và PR có thể nghiệm thu

| Phase/PR | Thay đổi cụ thể | Acceptance | Dependency/risk |
| --- | --- | --- | --- |
| P0 audit + safe UI/brand | Inventory, ADR, bỏ filter/Dashboard tile, export defaults, restore tests | Source evidence, quality gates, explicit gaps | Không deploy/cloud mutate |
| P1 neutral shared UI | Industry terms/i18n dictionary, OpenAPI/preview brand, all representative screens | Generic customer UI; old customer settings unchanged | Inventory branding classification |
| P2 config/installer | Validated manifest + dynamic target, resumable wizard, config versions | Hai isolated instance từ cùng release, no source edits | Scope/secret/upgrade review |
| P3 domain integrity | Atomic offboarding/profile/sensitive/archive/history, durable account provisioning/deletion recovery, config transaction | Native rollback/concurrency/last-admin đã có; còn rehearsal Auth thật, storage và UAT | Forward migration, backup/staging; native Auth stub không thay GoTrue |
| P4 purchasing | PR → approval → PO → partial receipt → existing ledger | Full API/UI/RBAC/audit/E2E + ledger reconciliation | P2/P3, vendor/item/warehouse core |
| P5 sales | Customer/quote/order → fulfillment/delivery | Partial fulfillment, retry and stock rules tested | P3/P4 shared contracts |
| P6 finance | GL/period/journal/post/reverse/AR/AP | Balanced invariants + accountant UAT | Approved accounting scope; no invented compliance |
| P7 integration | Project actual cost, verified payroll, XNK landed cost/AP | Traceable source transactions/no double count | P4–P6 |
| P8 commercial release | Installer/upgrade, security/IP, backup/restore, UAT/support | Signed release gates and two pilot configurations | Operator/business evidence |

Nhánh hiện tại chưa có commit/PR publish. Không tạo liên kết PR giả. Tách review theo UI/brand, authorization và domain command; không gộp migrations chưa thử vào release chỉ để build xanh.

Đã có OpenAPI/product metadata trung lập, registry chung, strict reads, manifest/plan local và wizard/browser draft +atomic activation. Profile/offboarding, sensitive/archive có command nguyên tử và CAS; account lifecycle dùng reservation/UUID bất biến, explicit cleanup, tombstone trước Auth DELETE và guard phiên đăng nhập. Hai migration `202610220002`/`202610220003` đã áp dụng trên DTech development; [rollout](evidence/lifecycle-rollout.json) ghi 165 native PostgreSQL checks với Auth stub. Chưa nghiệm thu GoTrue create/delete thật hoặc full Supabase stack.

Recovery panel có ở quản trị người dùng và ngay tab Tài khoản nhân sự; người có quyền mở tab cùng `account.create`/`account.delete` không phải nhận thêm `user.view` chỉ để tiếp tục yêu cầu. P3 còn identity-file/storage, rehire, direct writers và rehearsal thật; P1 còn terminology theo ngành; P2 còn checkpoint server và hai instance. Phần nghiệp vụ mới tiếp theo là purchasing PR/PO liên kết sổ kho, đồng thời giữ các gate rehearsal/UAT chưa đóng. Xem `progress.md`; không coi ERP thương mại đã hoàn tất hoặc tự đóng gate kế toán, pháp lý, backup.
