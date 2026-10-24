# Kiểm kê mã nguồn

Nguồn máy đọc: [source-inventory.json](evidence/source-inventory.json). Tạo lại bằng `node scripts/commercial/inventory.mjs`; script chỉ đọc mã nguồn/migration/package metadata và ghi bằng chứng local.

Snapshot đầu P0: 198 page files, 286 API route files, 55 migration, 179 tên bảng được khai báo, 117 tên RPC được khai báo. Đây là kiểm kê source, không chứng minh mọi command đã chạy thành công trên DB.

| Domain | Page files | API files | Service files | Source test files |
| --- | ---: | ---: | ---: | ---: |
| HR | 11 | 15 | 9 | 11 |
| Attendance/leave/timesheet/personal | 49 | 56 | 17 | 34 |
| Project/field | 16 | 36 | 8 | 10 |
| Warehouse | 27 | 34 | 4 | 2 |
| Import/export | 20 | 25 | 2 | 5 |
| Payroll | 8 | 11 | 1 | 16 |
| Shared operations | 17 | 27 | 6 | 5 |
| Messaging | 2 | 7 | 1 | 1 |
| Integration/admin | 49 | 43 | 7 | 6 |

Nhóm route có thể giao nhau; không cộng các hàng thành tổng. Inventory chứa đường dẫn cụ thể, tên bảng/RPC được service tham chiếu và test files để đối chiếu.

## Khác với giả định trong master prompt

`appConfig`, default system settings và logo fallback đã được trung lập hóa ở working tree trước P0. ModulesPage đã có 9 capability và 5 preset ngành. Chưa có entitlement hợp đồng/license độc lập với activation. Provisioning scripts vẫn chọn manifest DTech cố định; chưa phải installer đa khách hàng.

Dấu vết thương hiệu còn lại được phân loại trong `brandingFindings`: fixture/preview; asset tương thích khách cũ; khóa IndexedDB phải giữ để không mất hàng đợi offline; runtime cần xử lý. Không search-replace toàn bộ dữ liệu lịch sử.
