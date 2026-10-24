# QA và nghiệm thu

CRM riêng cho đội setup: `test:crm:integration`, `smoke:crm`, `evidence/operator-crm-integration.json`, `evidence/operator-crm-rollout.json` và `evidence/qa-operator-crm.json`. Bao gồm chuyển lead duy nhất, actor/quyền, CAS/rollback, manual intake, preset và download manifest. Ghi nghiệp vụ trong browser được intercept; chưa thay cho pilot team hoặc rehearsal cấp cloud/Auth thật. Customer-feature-off được kiểm tra HTTP riêng.

| Gate | Bằng chứng/nguồn | Điều kiện |
| --- | --- | --- |
| Unit | `npm test`; raw log từng đợt trong `progress.md` | Không bỏ RBAC assertions; bằng chứng ghi riêng theo đợt |
| Lint/types | `npm run lint`, `npm run typecheck` | Không có lỗi |
| Build | `BUILD_VARIANT=review npm run build:wasm` | Output `.next-review`, không đè dev server |
| Migration source | `npm run validate:migrations` | Không bao gồm SQL DRAFT |
| Employee transaction | `npm run test:employee:integration` | PostgreSQL cô lập; CAS, rollback, last-admin, actor/ACL và concurrency |
| Employee browser | `npm run smoke:employee` | Profile/edit 1440/390; lỗi mô phỏng bị chặn trong browser, không PATCH hồ sơ thật |
| Lifecycle transaction | `npm run test:lifecycle:integration` | PostgreSQL cô lập; reservation/recovery/cancel, elevated roles, Auth/session guards, sensitive/archive CAS, rollback và concurrency |
| Lifecycle browser | `npm run smoke:lifecycle` | 1440/768/390; recovery retry/cancel/cleanup, secret clearing, sensitive/archive 409/503; mọi ghi nghiệp vụ được intercept |
| Product/trial | `npm run test:trial:integration`, `npm run smoke:marketing` | Intake idempotency/quota/ACL, review CAS/audit rollback; public/private boundaries, responsive screens và module navigation; synthetic writes intercept trước backend |
| Development rollout | `evidence/lifecycle-rollout.json` | Target/hash/dry-run, ACL/RLS/triggers và counts trước/sau; không thay cho live Auth rehearsal |
| Browser | `node scripts/erp-site-audit.mjs` | Route độc lập; 1440/390, h1/errors/API/overflow/screenshots |
| Role/module disabled | Unit/route guard + staging personas | Cần E2E nhiều role và file/export/search |
| Business/concurrency | Domain unit/RPC + staging | Có retry/double-post/rollback/ledger reconciliation |
| UAT/operations | Business owner + restore/pilot records | Không thay bằng HTTP 200/build |

Inventory P0 có 142 route tĩnh để duyệt bằng browser và 46 template động. Inventory nguồn mới nhất nằm ở `evidence/source-inventory.json`; số trang không đại diện phạm vi browser QA của mỗi đợt. DB mới không có chứng từ nghiệp vụ; các detail/workflow động chưa được coi đã kiểm chứng chỉ vì source có route. Cần dữ liệu staging có nhãn hoặc UAT thật.

Baseline đầu đợt: 1036 pass, 18 fail, 37 skipped; phần fail gồm assertion/mock giao diện cũ. Kết quả cuối cập nhật ở `progress.md`. Audit dev đầu bị nhiễu bởi streaming redirect/HMR; không tính các lần navigation interrupted là lỗi nghiệp vụ đã xác nhận.

Kết quả cuối P0: 1067 unit pass, 37 skipped; 142 route tĩnh đã được duyệt, hai trang thiếu h1 được sửa/tái kiểm tra. Evidence tổng hợp tại `evidence/qa-summary.json`; public preview/testing production guard và logout/anonymous configuration API cũng đã được kiểm tra.

Đợt lifecycle ngày 22/10/2026 có 165 native checks trên PostgreSQL 17.10 cùng Auth stub. Native fixture/role giới hạn và HTTP mocks không chứng minh tương thích đầy đủ với GoTrue đang chạy: live Auth create/delete, nhiều persona, hai instance cô lập và restore/UAT vẫn là gate riêng. Kết quả và phạm vi browser hiện tại ghi tại `evidence/qa-p3b-lifecycle.json`; không cộng route P0 vào đợt này.
