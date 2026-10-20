# Permission catalog

Generated từ `src/lib/auth/permissions.ts`; cập nhật bằng `node scripts/generate-permission-doc.mjs`. Quyền luôn được kiểm tra phía server; UI hide không phải security boundary.

| Permission key | Ý nghĩa |
|---|---|
| `dashboard.view` | Xem dữ liệu — dashboard |
| `employee.view` | Xem dữ liệu — employee |
| `employee.view_sensitive` | Thao tác nghiệp vụ — employee |
| `employee.create` | Tạo mới — employee |
| `employee.edit` | Chỉnh sửa — employee |
| `employee.edit_sensitive` | Thao tác nghiệp vụ — employee |
| `employee.archive` | Lưu trữ — employee |
| `employee.offboard` | Thao tác nghiệp vụ — employee |
| `employee.export_basic` | Thao tác nghiệp vụ — employee |
| `employee.export_sensitive` | Thao tác nghiệp vụ — employee |
| `account.view` | Xem dữ liệu — account |
| `account.create` | Tạo mới — account |
| `account.disable` | Vô hiệu hóa — account |
| `account.enable` | Kích hoạt — account |
| `account.assign_role` | Thao tác nghiệp vụ — account |
| `account.revoke_sessions` | Thao tác nghiệp vụ — account |
| `attendance.view` | Xem dữ liệu — attendance |
| `attendance.self.view` | Xem dữ liệu — attendance / self |
| `attendance.self.create` | Tạo mới — attendance / self |
| `attendance.view_team` | Thao tác nghiệp vụ — attendance |
| `attendance.view_all` | Thao tác nghiệp vụ — attendance |
| `attendance.view_photo` | Thao tác nghiệp vụ — attendance |
| `attendance.review` | Thao tác nghiệp vụ — attendance |
| `attendance.adjust` | Điều chỉnh — attendance |
| `attendance.config.view` | Xem dữ liệu — attendance / config |
| `attendance.config.manage` | Quản lý cấu hình/dữ liệu — attendance / config |
| `timesheet.view` | Xem dữ liệu — timesheet |
| `shift.view` | Xem dữ liệu — shift |
| `shift.manage` | Quản lý cấu hình/dữ liệu — shift |
| `timesheet.self.view` | Xem dữ liệu — timesheet / self |
| `timesheet.view_team` | Thao tác nghiệp vụ — timesheet |
| `timesheet.view_all` | Thao tác nghiệp vụ — timesheet |
| `timesheet.adjust` | Điều chỉnh — timesheet |
| `timesheet.lock` | Thao tác nghiệp vụ — timesheet |
| `timesheet.unlock` | Thao tác nghiệp vụ — timesheet |
| `timesheet.export` | Xuất dữ liệu — timesheet |
| `timesheet.export_detail` | Thao tác nghiệp vụ — timesheet |
| `attendance.raw.view` | Xem dữ liệu — attendance / raw |
| `attendance.photo.view` | Xem dữ liệu — attendance / photo |
| `export_template.view` | Xem dữ liệu — export_template |
| `export_template.manage` | Quản lý cấu hình/dữ liệu — export_template |
| `report.employee_basic` | Thao tác nghiệp vụ — report |
| `report.employee_sensitive` | Thao tác nghiệp vụ — report |
| `leave.export` | Xuất dữ liệu — leave |
| `leave.view` | Xem dữ liệu — leave |
| `leave.self.view` | Xem dữ liệu — leave / self |
| `leave.self.create` | Tạo mới — leave / self |
| `leave.self.withdraw` | Thao tác nghiệp vụ — leave / self |
| `leave.approve` | Phê duyệt — leave |
| `leave.approve_all` | Thao tác nghiệp vụ — leave |
| `leave.view_team` | Thao tác nghiệp vụ — leave |
| `leave.view_all` | Thao tác nghiệp vụ — leave |
| `leave.balance.view_self` | Thao tác nghiệp vụ — leave / balance |
| `leave.balance.view_all` | Thao tác nghiệp vụ — leave / balance |
| `leave.balance.adjust` | Điều chỉnh — leave / balance |
| `leave.type.manage` | Quản lý cấu hình/dữ liệu — leave / type |
| `leave.workflow.manage` | Quản lý cấu hình/dữ liệu — leave / workflow |
| `leave.policy.manage` | Quản lý cấu hình/dữ liệu — leave / policy |
| `leave.pdf.export_self` | Thao tác nghiệp vụ — leave / pdf |
| `leave.pdf.export_all` | Thao tác nghiệp vụ — leave / pdf |
| `project.view` | Xem dữ liệu — project |
| `project.create` | Tạo mới — project |
| `project.edit` | Chỉnh sửa — project |
| `project.manage_team` | Thao tác nghiệp vụ — project |
| `project.manage_schedule` | Thao tác nghiệp vụ — project |
| `project_update.create` | Tạo mới — project_update |
| `project_update.view_project` | Thao tác nghiệp vụ — project_update |
| `project_update.view_all` | Thao tác nghiệp vụ — project_update |
| `project_update.edit_own` | Thao tác nghiệp vụ — project_update |
| `project_update.edit_all` | Thao tác nghiệp vụ — project_update |
| `project_update.archive` | Lưu trữ — project_update |
| `project_update.pin` | Thao tác nghiệp vụ — project_update |
| `project_health.update` | Thao tác nghiệp vụ — project_health |
| `project_issue.view` | Xem dữ liệu — project_issue |
| `project_issue.manage` | Quản lý cấu hình/dữ liệu — project_issue |
| `project_issue.resolve` | Thao tác nghiệp vụ — project_issue |
| `project_monitoring.view` | Xem dữ liệu — project_monitoring |
| `project_monitoring.view_all` | Thao tác nghiệp vụ — project_monitoring |
| `worker_attendance.view` | Xem dữ liệu — worker_attendance |
| `worker_attendance.self_scope` | Thao tác nghiệp vụ — worker_attendance |
| `worker_attendance.create` | Tạo mới — worker_attendance |
| `worker_attendance.view_project` | Thao tác nghiệp vụ — worker_attendance |
| `worker_attendance.view_all` | Thao tác nghiệp vụ — worker_attendance |
| `worker_attendance.view_photo` | Thao tác nghiệp vụ — worker_attendance |
| `worker_attendance.adjust` | Điều chỉnh — worker_attendance |
| `worker_attendance.lock` | Thao tác nghiệp vụ — worker_attendance |
| `worksite.view` | Xem dữ liệu — worksite |
| `worksite.manage` | Quản lý cấu hình/dữ liệu — worksite |
| `warehouse.view` | Xem dữ liệu — warehouse |
| `warehouse.view_all` | Thao tác nghiệp vụ — warehouse |
| `warehouse.item.view` | Xem dữ liệu — warehouse / item |
| `warehouse.item.manage` | Quản lý cấu hình/dữ liệu — warehouse / item |
| `warehouse.master.manage` | Quản lý cấu hình/dữ liệu — warehouse / master |
| `warehouse.receipt.view` | Xem dữ liệu — warehouse / receipt |
| `warehouse.receipt.create` | Tạo mới — warehouse / receipt |
| `warehouse.receipt.post` | Ghi sổ — warehouse / receipt |
| `warehouse.receipt.reverse` | Đảo giao dịch — warehouse / receipt |
| `warehouse.issue.view` | Xem dữ liệu — warehouse / issue |
| `warehouse.issue.create` | Tạo mới — warehouse / issue |
| `warehouse.issue.post` | Ghi sổ — warehouse / issue |
| `warehouse.issue.reverse` | Đảo giao dịch — warehouse / issue |
| `warehouse.transfer.view` | Xem dữ liệu — warehouse / transfer |
| `warehouse.transfer.create` | Tạo mới — warehouse / transfer |
| `warehouse.transfer.post` | Ghi sổ — warehouse / transfer |
| `warehouse.adjustment.view` | Xem dữ liệu — warehouse / adjustment |
| `warehouse.adjustment.create` | Tạo mới — warehouse / adjustment |
| `warehouse.adjustment.post` | Ghi sổ — warehouse / adjustment |
| `warehouse.stock_count.view` | Xem dữ liệu — warehouse / stock_count |
| `warehouse.stock_count.create` | Tạo mới — warehouse / stock_count |
| `warehouse.stock_count.post` | Ghi sổ — warehouse / stock_count |
| `warehouse.ledger.view` | Xem dữ liệu — warehouse / ledger |
| `warehouse.report.export` | Xuất dữ liệu — warehouse / report |
| `import_export.view` | Xem dữ liệu — import_export |
| `import_export.view_all` | Thao tác nghiệp vụ — import_export |
| `import_contract.view` | Xem dữ liệu — import_contract |
| `import_contract.create` | Tạo mới — import_contract |
| `import_contract.edit` | Chỉnh sửa — import_contract |
| `import_contract.close` | Thao tác nghiệp vụ — import_contract |
| `shipment.view` | Xem dữ liệu — shipment |
| `shipment.create` | Tạo mới — shipment |
| `shipment.edit` | Chỉnh sửa — shipment |
| `shipment.update_schedule` | Thao tác nghiệp vụ — shipment |
| `shipment.close` | Thao tác nghiệp vụ — shipment |
| `shipment.cancel` | Thao tác nghiệp vụ — shipment |
| `shipment_document.view` | Xem dữ liệu — shipment_document |
| `shipment_document.upload` | Tải tệp — shipment_document |
| `shipment_document.replace` | Thay tệp — shipment_document |
| `customs.view` | Xem dữ liệu — customs |
| `customs.manage` | Quản lý cấu hình/dữ liệu — customs |
| `shipment_receiving.view` | Xem dữ liệu — shipment_receiving |
| `shipment_receiving.create_receipt` | Thao tác nghiệp vụ — shipment_receiving |
| `partner.view` | Xem dữ liệu — partner |
| `partner.manage` | Quản lý cấu hình/dữ liệu — partner |
| `import_export.report.export` | Xuất dữ liệu — import_export / report |
| `approval.view` | Xem dữ liệu — approval |
| `approval.inbox.view` | Xem dữ liệu — approval / inbox |
| `approval.view_assigned` | Thao tác nghiệp vụ — approval |
| `approval.view_all` | Thao tác nghiệp vụ — approval |
| `approval.act` | Thao tác nghiệp vụ — approval |
| `approval.reassign` | Thao tác nghiệp vụ — approval |
| `approval.workflow.manage` | Quản lý cấu hình/dữ liệu — approval / workflow |
| `approval.delegation.manage` | Quản lý cấu hình/dữ liệu — approval / delegation |
| `report.view` | Xem dữ liệu — report |
| `notification.view` | Xem dữ liệu — notification |
| `notification.self.view` | Xem dữ liệu — notification / self |
| `notification.preference.manage` | Quản lý cấu hình/dữ liệu — notification / preference |
| `notification.system_notice.manage` | Quản lý cấu hình/dữ liệu — notification / system_notice |
| `document.view` | Xem dữ liệu — document |
| `document.upload` | Tải tệp — document |
| `document.replace` | Thay tệp — document |
| `document.archive` | Lưu trữ — document |
| `document.company_manage` | Thao tác nghiệp vụ — document |
| `profile.view` | Xem dữ liệu — profile |
| `user.view` | Xem dữ liệu — user |
| `role.view` | Xem dữ liệu — role |
| `role.manage` | Quản lý cấu hình/dữ liệu — role |
| `permission.view` | Xem dữ liệu — permission |
| `settings.view` | Xem dữ liệu — settings |
| `system_admin.access` | Truy cập — system_admin |
| `branding.view` | Xem dữ liệu — branding |
| `branding.manage` | Quản lý cấu hình/dữ liệu — branding |
| `appearance.view` | Xem dữ liệu — appearance |
| `appearance.manage` | Quản lý cấu hình/dữ liệu — appearance |
| `navigation.manage` | Quản lý cấu hình/dữ liệu — navigation |
| `module.manage` | Quản lý cấu hình/dữ liệu — module |
| `organization_settings.view` | Xem dữ liệu — organization_settings |
| `organization_settings.manage` | Quản lý cấu hình/dữ liệu — organization_settings |
| `localization.manage` | Quản lý cấu hình/dữ liệu — localization |
| `config_history.view` | Xem dữ liệu — config_history |
| `config_history.restore` | Thao tác nghiệp vụ — config_history |
| `department.manage` | Quản lý cấu hình/dữ liệu — department |
| `position.manage` | Quản lý cấu hình/dữ liệu — position |
| `audit.view` | Xem dữ liệu — audit |
| `audit.view_sensitive` | Thao tác nghiệp vụ — audit |
| `settings.manage` | Quản lý cấu hình/dữ liệu — settings |
| `integration.view` | Xem dữ liệu — integration |
| `integration.manage` | Quản lý cấu hình/dữ liệu — integration |
| `api_key.view` | Xem dữ liệu — api_key |
| `api_key.create` | Tạo mới — api_key |
| `api_key.revoke` | Thu hồi — api_key |
| `service_account.manage` | Quản lý cấu hình/dữ liệu — service_account |
| `webhook.view` | Xem dữ liệu — webhook |
| `webhook.manage` | Quản lý cấu hình/dữ liệu — webhook |
| `webhook.retry` | Thử lại — webhook |
| `integration_log.view` | Xem dữ liệu — integration_log |
| `integration_conflict.view` | Xem dữ liệu — integration_conflict |
| `integration_conflict.resolve` | Thao tác nghiệp vụ — integration_conflict |
| `import.create` | Tạo mới — import |
| `import.execute` | Thao tác nghiệp vụ — import |
| `api_docs.view` | Xem dữ liệu — api_docs |
| `file.read` | Thao tác nghiệp vụ — file |
| `webhook.publish` | Thao tác nghiệp vụ — webhook |
| `operations.view` | Xem dữ liệu — operations |
| `operations.run` | Chạy tác vụ — operations |
| `jobs.retry` | Thử lại — jobs |

Các quyền nhạy cảm cần explicit review trước go-live: `employee.view_sensitive`, `employee.export_sensitive`, `timesheet.unlock`, `warehouse.*.post`, `warehouse.*.reverse`, `import_export.view_all`, `api_key.*`, `service_account.manage`, `audit.view_sensitive`, `settings.manage`, `operations.run`.
