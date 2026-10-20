# Migration mapping

## Quy tắc chung

- Chuẩn hóa Unicode/trim, giữ source key và checksum; date dùng ISO `YYYY-MM-DD`, timestamp có timezone.
- Không merge employee chỉ theo tên; unresolved duplicate → error queue + business resolution.
- Foreign key được resolve bằng natural key đã duyệt; thiếu reference không tự tạo im lặng.
- Status/enum mapping phải whitelist. Giá trị ngoài mapping → invalid row.
- Leave opening nhập bằng ledger grant/adjustment có audit; stock opening bằng chứng từ opening đã post, không update balance.
- Historical event chỉ import nếu source có evidence; không tạo fake history.

| Source | Target | Rule |
|---|---|---|
| employee_code | employees.employee_code | required, unique, immutable migration key |
| department_code | employees.department_id | lookup departments.code |
| position_code | employees.position_id | lookup positions.code |
| email | app_accounts.primary_email | lowercase; invite auth sau review |
| item_code | inventory_items.item_code | required, unique |
| warehouse_code + item_code + qty | inventory document line | qty > 0, post through ledger function |
| project_code + employee_code | project_assignments | employee active or flagged exception |

Field chứa CCCD/ngân hàng/address phải ở protected target và không xuất trong validation summary.
