# Domain và quyền sở hữu dữ liệu

| Owner | Aggregate/bảng hiện có | Tác động liên domain |
| --- | --- | --- |
| Identity | app_accounts, roles, role_permissions, app_sessions | Employee link, authorization |
| HR | employees, contracts, sensitive profiles/history | Attendance, salary, account lifecycle |
| Leave/time | leave_requests, leave_ledger, timesheet_periods | Payroll inputs, approvals |
| Warehouse | inventory_documents/lines, inventory_ledger/balances, stock counts | Shipment receiving, project issue |
| XNK | import contracts, shipments/lines/containers/documents | Warehouse receipt linkage |
| Payroll | salary history, payroll periods/lines, payslips | Timesheets, published private files |
| Shared platform | approval cases/steps, documents/versions, notifications | Source domain references |

Tên đầy đủ và RPC tham chiếu: `evidence/source-inventory.json`. Bảng số dư không phải API chỉnh tồn tùy ý; phải đi qua chứng từ post/reverse. Không thêm sổ kho thứ hai cho purchasing/sales tương lai.

Phân biệt deployment/customer organization, legal entity, department, warehouse/worksite/project, account và employee. Instance hiện có cấu hình công ty, chưa có mô hình nhiều pháp nhân với scope đầy đủ.

## Rủi ro được xác nhận từ source

- `employeeMutationService.patchEmployee`: offboarding và account disable/history chưa nguyên tử. Bản đề xuất RPC ở `docs/erp/proposals`; chưa kích hoạt hoặc đưa vào migrations triển khai.
- `provisionAccount`: lỗi/timeout RPC có thể dẫn tới cleanup Auth sai nếu command đã commit. Cần recovery/idempotency integration test trước khi sửa lifecycle.
- Warehouse threshold writes và approval lookup errors cần audit transactional/error propagation sâu hơn. Chưa đánh dấu đã sửa chỉ từ quan sát source.
