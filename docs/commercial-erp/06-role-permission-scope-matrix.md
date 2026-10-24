# Quyền và phạm vi dữ liệu

Nguồn kiểm tra: `src/lib/auth/permissions.ts`, `applicationAccess.ts`, `src/config/routeAccess.ts`, `src/services/authorization` và các domain service.

| Nhóm | UI/gate | Phạm vi phải bảo toàn |
| --- | --- | --- |
| Employee | personal attendance/leave/payslip | Self; không được HR chỉ vì có personal permission |
| HR | employee/contract/insurance/time administration | Sensitive/export tách quyền; field/team scope theo service |
| Supervisor | project/worker attendance | Assigned projects, không mở toàn bộ HR |
| Warehouse | document/item/count/ledger permissions | Kho được phân công; post/reverse tách action |
| Payroll | salary/payroll/payslip permissions | Salary riêng tư, publish/revoke có policy |
| Customer admin | system_admin + group-specific permission | Không mặc nhiên là operator được đọc mọi khách hàng |

Đợt P0 sửa area gate bị thiếu quyền chuyên biệt: `warehouse.stock_count.view`, `warehouse.adjustment.view`, `payroll.create`, `attendance.config.manage`. Domain authorization không bị bỏ qua.

Tồn đọng: XNK documents/customs/settings có thể yêu cầu các quyền bổ sung ở service. Cần test persona có đúng một quyền trước khi điều chỉnh; không nới tất cả thành `module.manage`.
