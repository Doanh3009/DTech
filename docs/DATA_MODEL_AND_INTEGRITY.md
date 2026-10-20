# Data Model and Integrity

## Core entity map

- Company/workspace: `organization` và `system_settings`; phase hiện tại vận hành một công ty. Nếu multi-company được duyệt sau này, mọi bảng nghiệp vụ phải thêm stable `company_id` và policy tương ứng trong một migration riêng.
- Identity: Supabase `auth.users` → `app_accounts` → `employees`; role thông qua `account_roles`, `roles`, `role_permissions`, `permissions`.
- Organization: departments, positions, employee contracts/history.
- Attendance: locations/geofences, shifts/schedules, attendance events, daily summaries, photo/file assets và client idempotency key.
- Leave: leave types/policies, balances/ledger, requests, immutable approval snapshot/steps, generated document.
- Projects: projects, worksites, assignments, roster, updates, issues và worker attendance sessions.
- Warehouse: warehouses/locations, items/SKU, UOM/categories, inventory documents/lines, immutable stock movements, derived/transactional balances và stock counts.
- Import/export: business partners, contracts/lines, shipments/lines/containers, schedule history, customs, documents và receiving resolutions.
- Shared: file assets, documents/versions/links, notifications/preferences, domain events, audit logs, system settings/version history.

## Nguyên tắc toàn vẹn

1. Primary key ổn định; số chứng từ là business identifier, không thay UUID.
2. Lưu timestamp dạng `timestamptz` UTC; hiển thị theo `Asia/Ho_Chi_Minh` qua utility tập trung.
3. Bản ghi quan trọng có created/updated actor, timestamp và row version khi có concurrent edit.
4. Chỉ soft-delete/archive khi phải giữ lịch sử; không dùng soft-delete mặc định cho mọi bảng.
5. Warehouse document đã post không sửa im lặng. Điều chỉnh/reverse tạo lịch sử và stock movement mới.
6. Stock ledger là bằng chứng; balance là read model được duy trì nguyên tử trong RPC/transaction.
7. Attendance/offline mutation mang client event ID duy nhất; retry không tạo lần chấm công mới.
8. Approval transition được kiểm tra ở service/RPC; client không tự ghi trạng thái cuối.
9. RLS là defense-in-depth. Table đã bật RLS nhưng chưa có policy sẽ mặc định deny browser access.
10. Audit được ghi từ server, không dựa vào browser.
11. Attachment có owner, visibility, MIME/size/signature validation và object path ổn định; download qua signed URL sau authorization.
12. Realtime không thay thế transaction hoặc persistent state.
13. Aggregate document/contract/shipment và phiên bản workflow được tạo qua command RPC nguyên tử; client không tự ghép header/dòng bằng nhiều mutation rời.
14. Receipt gắn shipment được serialize theo shipment và kiểm tra tolerance tại transition `posted`; service precheck chỉ là phản hồi sớm, không phải hàng rào toàn vẹn cuối.
15. Approval reassignment khóa bước pending và trả cùng durable reassignment ID khi retry cùng đích; notification delivery key lấy từ ID này.

## Index và constraint

Ưu tiên unique constraint cho delivery/idempotency key, composite index theo scope + status + time cho worklist, foreign key `restrict` với chứng từ lịch sử và `cascade` chỉ cho dữ liệu phụ không mang giá trị audit độc lập.

## Migration policy

Migration forward-only, có thứ tự timestamp, không sửa migration đã áp dụng. Phase này không thêm migration speculative. RLS policy cho từng module chỉ được thêm khi scope matrix đã chốt và có test bằng JWT role thực tế. Rollback thay đổi application foundation là revert code/asset; không có database rollback trong batch này.
