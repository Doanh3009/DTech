# Permission Matrix

Permission key hiện hữu là contract đã lưu trong database; không đổi tên hàng loạt. Role template chỉ là tập permission khởi tạo, không thay thế permission độc lập.

| Module | Resource/action | Scope chính | Permission tiêu biểu | Role gợi ý | Enforcement |
|---|---|---|---|---|---|
| HR | xem/tạo/sửa nhân viên | basic/sensitive/all | `employee.view`, `employee.create`, `employee.edit_sensitive` | HR, Admin | area layout + API/service |
| Attendance | chấm công/xem/duyệt | self/team/all | `attendance.self.create`, `attendance.view_team`, `attendance.review` | Employee, Manager, HR | area layout + API/service + DB constraint |
| Timesheet | xem/điều chỉnh/khóa | self/team/all | `timesheet.self.view`, `timesheet.adjust`, `timesheet.lock` | Employee, HR | area layout + API/service |
| Leave | tạo/xem/duyệt | self/team/all | `leave.self.create`, `leave.view_team`, `leave.approve_all` | Employee, Manager, HR | area layout + workflow service |
| Projects | xem/cập nhật/quản lý | assigned/project/all | `project.view`, `project_update.create`, `project.manage_team` | Engineer, PM | area layout + repository scope |
| Worker attendance | tạo/xem/chốt | self/project/all | `worker_attendance.create`, `worker_attendance.view_project`, `worker_attendance.lock` | Engineer, PM | area layout + API/service |
| Warehouse | item/document/post | warehouse/all | `warehouse.item.view`, `warehouse.receipt.create`, `warehouse.receipt.post` | Warehouse Staff | area layout + service + atomic RPC |
| Import/export | shipment/contract/customs | assigned/all | `shipment.view`, `import_contract.create`, `customs.manage` | Import–Export Staff | area layout + repository scope |
| Approvals | inbox/act/reassign | assigned/all | `approval.inbox.view`, `approval.act`, `approval.reassign` | Manager, Executive | area layout + workflow service |
| Documents | view/upload/archive | owner/project/company | `document.view`, `document.upload`, `document.archive` | theo module | area layout + signed route |
| Reports | view/export | basic/sensitive | `report.view`, `report.employee_sensitive` | HR, Executive | area layout + export service |
| Admin | user/role/settings/audit | company | `user.view`, `role.manage`, `system_admin.access`, `audit.view_sensitive` | System Administrator | admin layout + page + API |

## Role templates đề xuất

- Employee: profile, attendance self, leave self, timesheet self, notification self.
- Engineer/Site Staff: Employee + project assigned, project update, worker attendance self/project.
- HR Staff: employee, attendance/timesheet/leave operational permissions.
- Project Manager: project team/schedule, issue, worker attendance project, approval assigned.
- Warehouse Staff: warehouse item/document permissions theo warehouse scope.
- Import–Export Staff: partner, contract, shipment, customs và document permissions.
- Department Manager: team view + approval act.
- Executive: cross-module read/attention/report; không mặc định có mutation.
- System Administrator: system app và cấu hình; không mặc định thay thế quyền nghiệp vụ nhạy cảm.

## Quy tắc enforcement

UI chỉ ẩn action để cải thiện UX. `ProtectedAreaLayout` chặn direct route theo nhóm permission. API/service kiểm tra action và resource scope. RLS mặc định deny khi không có policy; policy mới phải dùng `auth.uid()` map sang `app_accounts` và không được rộng hơn service rule.
