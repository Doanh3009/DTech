# Mức hoàn thiện module

`Đã triển khai` mô tả code; `Đã kiểm chứng` cần bằng chứng tương ứng. Không có module nào được gọi production-complete chỉ từ số trang/test.

| Module | Code/workflow hiện có | Unit/source evidence | UAT | Trạng thái thương mại | Quyết định/gap |
| --- | --- | --- | --- | --- | --- |
| Identity/config | Auth, RBAC, session, strict reads, atomic settings; durable account reservation/recovery, deletion tombstone, session INSERT guard | Unit/API/browser +56 settings, 88 employee và 165 lifecycle native PG checks; migration 002/003 applied DTech development | Chưa owner/cross-role/GoTrue pilot | PARTIAL | Auth trong native là stub; live create/delete, retention và external/cron gates |
| HR/time/leave | Hồ sơ/offboarding/sensitive/archive/history/audit nguyên tử, CAS chung; policy, attendance, approvals, ledger, timesheet | Domain/API/form +native lifecycle rollback/concurrency; browser mutation mô phỏng | Chưa kiểm chứng trên chính sách khách | PARTIAL | Identity-file/storage workflow, rehire và UAT còn thiếu |
| Payroll | Salary/payroll/payslip publish/revoke | Accounting tests, PDF/XLSX artifacts | Cần kế toán nghiệm thu | PARTIAL | Reuse; không phải GL |
| Warehouse | Chứng từ/post/reverse/count/ledger | Warehouse tests, migrations | Cần concurrency/reconciliation | PARTIAL | Reuse; transactional configuration |
| XNK | Contract/shipment/docs/partial receive | XNK source/tests + warehouse references | Chưa có receiving UAT | PARTIAL | Reuse; landed cost/AP missing |
| Projects | Team/site/progress/issues/attendance | Project source/tests | Chưa cost/billing UAT | PARTIAL | Refactor generic terms; cost integration missing |
| Shared ops | Approval/document/notification/search/messages | Shared feature tests | Chưa cross-role pilot | PARTIAL | Reuse; query-error and scope review |
| Setup/installer | Manifest v1/shared registry, wizard/browser draft, reviewed activation plan +atomic RPC, scripts target/admin riêng | Unit/API/browser +PG concurrency/rollback +development rollout | Chưa hai instance | PARTIAL | Server checkpoint, full-stack rehearsal/upgrade/restore |
| Product marketing/trial intake | Landing, construction scenario có nhãn minh họa, form public, private admin queue, manual qualification | Unit/API/UI +32 native PostgreSQL checks; development migration 004 | Chưa case study khách hàng được duyệt/publication pilot | IMPLEMENTED SLICE | Retention/ingress protection, contact operations và bàn giao tài khoản do operator thực hiện; không thay sales/CRM |
| CRM/Sales | Chưa có domain | Không có E2E slice | Không có | NOT IMPLEMENTED | P5 new |
| CRM triển khai DTech (team setup) | Portal riêng, tiếp nhận/qualification, hồ sơ khảo sát, chọn gói ngành/module, target riêng, manifest cho CLI, chăm sóc và lịch sử | Unit/API, native PG CAS/ACL/conversion/rollback, browser synthetic ở 3 kích thước; migration 005 development | Chưa pilot đội setup/khách thật | IMPLEMENTED SLICE | Operator control plane; không phải Sales CRM của ERP khách hàng; cấp cloud/Auth và bàn giao có operator xác nhận |
| Procurement | Chưa có PR/PO domain | Không có E2E slice | Không có | NOT IMPLEMENTED | P4 new, reuse warehouse |
| Finance/GL | Chưa có accounting engine | Không có balanced posting/period-close suite | Không có | NOT IMPLEMENTED | P6 new |
| Manufacturing/garment | Chỉ preset capability | Không có BOM/work-order domain | Không có | NOT IMPLEMENTED | Thiết kế sau core workflows |

Route/API/table/permission liên quan xem các inventory và ma trận 01/05/06. Không bật fake module để lấp các dòng chưa triển khai.

Account recovery có tại `/settings/users` và inline trong tab Tài khoản của hồ sơ nhân sự. Người đã được mở hồ sơ/tab và có `account.create` hoặc `account.delete` dùng được panel theo nhân sự mà không cần thêm `user.view`. Đây là đường phục hồi theo quyền, không mở toàn bộ quản trị người dùng. Xem [account lifecycle](account-lifecycle-recovery-guide.md) và [rollout development](evidence/lifecycle-rollout.json).

Các migration đã áp dụng không đồng nghĩa nghiệm thu Auth create/delete thật hoặc hoàn thành ERP thương mại. Native lifecycle dùng Auth stub; full Supabase rehearsal, backup/restore, hai bản cài và business UAT vẫn là gate phát hành.
