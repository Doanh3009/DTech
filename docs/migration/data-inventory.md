# Data migration inventory

Không có source file thật trong workspace. Bảng dưới là inventory phải được business owner điền; không tự suy đoán merge bằng tên.

| Domain/entity | Source owner | Format/version | Natural key | Sensitive | Target | Status |
|---|---|---|---|---|---|---|
| Departments | HR | ___ | code | no | departments | MISSING SOURCE |
| Positions | HR | ___ | code | no | positions | MISSING SOURCE |
| Employees | HR | ___ | employee_code | yes | employees + profiles | MISSING SOURCE |
| Leave opening balance | HR | ___ | employee_code + leave_type + year | yes | leave_ledger transaction | MISSING SOURCE |
| Projects/assignments | Project owner | ___ | project code / employee code | yes | projects/assignments | MISSING SOURCE |
| Warehouses/items | Warehouse | ___ | code/item_code | yes | warehouses/items | MISSING SOURCE |
| Opening stock | Warehouse | ___ | warehouse + item + as-of | yes | posted opening document/ledger | MISSING SOURCE |
| Active shipments | XNK | ___ | shipment reference | yes | shipments/lines/docs metadata | MISSING SOURCE |

Passwords không được migrate. User được provision bằng Supabase invite. Binary documents cần inventory riêng gồm checksum, owner, classification và target private bucket.
