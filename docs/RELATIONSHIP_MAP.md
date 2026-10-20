# Relationship Map

Cập nhật: 2026-09-19. Tên dưới đây là tên bảng thật trong migrations Supabase; mũi tên biểu diễn khóa ngoại hoặc liên kết định danh do service duy trì.

## Identity, employee và RBAC

```text
auth.users.id
  -> app_accounts.auth_user_id (0..1 account / auth user)
app_accounts.employee_id
  -> employees.id (nullable, unique: tài khoản có thể chưa gắn hồ sơ)
employees.department_id       -> departments.id
employees.position_id         -> positions.id
employees.employment_type_id  -> employment_types.id
employees.manager_employee_id -> employees.id
departments.manager_employee_id -> employees.id

app_accounts.id -> account_roles.account_id
roles.id        -> account_roles.role_id
roles.id        -> role_permissions.role_id
permissions.key -> role_permissions.permission_key
```

Employee là thực thể nghiệp vụ trung tâm, không đồng nhất với tài khoản đăng nhập. Một employee có thể không có account; một active account chưa gắn employee là trạng thái Case A cần UI quản trị liên kết, không được suy đoán tự động.

```text
employees.id
  +-> employee_sensitive_profiles.employee_id
  +-> employee_emergency_contacts.employee_id
  +-> employee_contracts.employee_id
  +-> employee_documents.employee_id -> file_assets.id
  +-> employee_history_events.employee_id
  +-> employee_insurance_profiles.employee_id
  +-> employee_insurance_events.employee_id
  +-> employee_salary_history.employee_id
  +-> attendance_events.employee_id
  +-> leave_requests.employee_id
  +-> leave_ledger.employee_id
  +-> shift_assignments.employee_id
  +-> daily_timesheets.employee_id
  +-> timesheet_period_summaries.employee_id
  +-> project_assignments.employee_id
  +-> worker_attendance_entries.worker_id
```

## Chấm công, nghỉ phép và bảng công

```text
attendance_locations.id -> employee_attendance_locations.location_id
employees.id             -> employee_attendance_locations.employee_id
attendance_events.id     -> attendance_photos.event_id
attendance_events.id     -> attendance_event_adjustments.event_id
employees.id             -> attendance_adjustment_requests.employee_id

leave_workflows.id -> leave_workflow_steps.workflow_id
leave_workflows.id -> leave_types.workflow_id
leave_requests.id  -> leave_request_approval_steps.request_id
leave_requests.id  -> leave_request_attachments.request_id -> file_assets.id
leave_requests.id  -> leave_attendance_conflicts.request_id
leave_requests.id  -> leave_ledger.reference_id (nghiệp vụ, theo reference_type)

timesheet_periods.id -> daily_timesheets.period_id
timesheet_periods.id -> timesheet_period_summaries.period_id
timesheet_periods.id -> timesheet_adjustments.period_id
timesheet_periods.id -> timesheet_exceptions.period_id
timesheet_periods.id -> timesheet_period_versions.period_id
report_templates.id  -> report_template_versions.template_id
report_templates.id  -> report_exports.template_id
```

Luồng tính công đọc attendance, worker attendance, leave và adjustment để tạo daily/summary. Khi khóa kỳ, report dùng snapshot/version; không được biến lỗi đọc nguồn thành file rỗng.

## Dự án và điểm danh công nhân

```text
projects.id
  +-> worksites.project_id
  +-> project_assignments.project_id -> employees.id
  +-> project_updates.project_id -> project_update_versions/update_attachments
  +-> project_issues.project_id -> project_issue_history
  +-> project_health_history.project_id
  +-> project_progress_nodes.project_id
  +-> worker_attendance_sessions.project_id

worksites.id -> project_assignments.worksite_id
worksites.id -> worker_attendance_sessions.worksite_id
worker_attendance_sessions.id
  +-> worker_attendance_entries.session_id -> employees.id
  +-> worker_attendance_photos.session_id -> file_assets.id
  +-> worker_attendance_adjustments.session_id
  +-> worker_attendance_checklist_items.session_id
```

Roster phải xuất phát từ `project_assignments`; session lưu snapshot tên project/worksite/ca/người giám sát để bảo toàn lịch sử.

## Kho và bridge XNK

```text
item_categories.id -> inventory_items.category_id
units_of_measure.id -> inventory_items.base_uom_id
warehouses.id       -> warehouse_user_scopes.warehouse_id
app_accounts.id     -> warehouse_user_scopes.account_id
inventory_items.id + warehouses.id -> inventory_balances
inventory_items.id + warehouses.id -> item_warehouse_settings

inventory_documents.id -> inventory_document_lines.document_id -> inventory_items.id
inventory_documents.source_warehouse_id -> warehouses.id
inventory_documents.target_warehouse_id -> warehouses.id
inventory_documents.reversal_document_id/reverses_document_id -> inventory_documents.id
inventory_documents.id -> stock_ledger.document_id
stock_counts.id         -> stock_count_lines.stock_count_id -> inventory_items.id
```

Nhập, xuất, chuyển và điều chỉnh dùng chung `inventory_documents.type`. Chỉ thao tác post/reverse được phép sinh `stock_ledger` và cập nhật `inventory_balances`; draft/submitted không làm thay đổi tồn.

```text
business_partners.id -> import_contracts.partner_id
import_contracts.id   -> import_contract_lines.contract_id
import_contracts.id   -> shipments.contract_id
shipments.id
  +-> shipment_lines.shipment_id
  +-> shipment_containers.shipment_id
  +-> shipment_documents.shipment_id -> file_assets.id
  +-> shipment_customs.shipment_id
  +-> shipment_delivery_info.shipment_id
  +-> shipment_schedule_history.shipment_id
  +-> shipment_status_history.shipment_id
shipment_lines.id + shipment_containers.id
  -> shipment_line_container_allocations
shipment_lines.id -> shipment_receiving_resolutions.shipment_line_id
shipments.id      -> inventory_documents.shipment_id
shipment_lines.id -> inventory_document_lines.shipment_line_id
```

Receipt XNK phải giữ shipment/line nguồn để nhận từng phần, đối soát và chống nhận trùng.

## Shared platforms và audit

```text
approval_workflows.id -> approval_workflow_versions.workflow_id
approval_workflows.id -> approval_workflow_steps.workflow_id
approval_cases.id     -> approval_steps.case_id
approval_cases.id     -> approval_reassignments.case_id
app_accounts.id       -> approval_delegations.from_account_id/to_account_id

documents.id -> document_versions.document_id -> file_assets.id
documents.id -> document_links.document_id -> (entity_type, entity_id)
app_accounts.id -> notifications.account_id
notification_templates.id -> notifications.template_id
app_accounts.id -> notification_preferences.account_id

app_accounts.id -> audit_logs.actor_account_id
file_assets.(owner_entity_type, owner_entity_id) -> entity nghiệp vụ
domain_events / *_domain_events / realtime_invalidations -> aggregate nghiệp vụ
```

`audit_logs`, versions, status history và ledger là lịch sử bất biến theo thiết kế. Realtime invalidation chỉ yêu cầu client tải lại dữ liệu có scope; nó không thay thế transaction hoặc source of truth trong database.

## Messaging và integration

```text
conversations.id -> conversation_members.conversation_id -> app_accounts.id
conversations.id -> messages.conversation_id -> app_accounts.id (sender)
messages.id      -> message_reads.message_id -> app_accounts.id
messages.id      -> message_attachments.message_id -> file_assets.id

service_accounts.id -> api_keys.service_account_id
api_keys.id          -> external_api_requests.api_key_id
webhook_endpoints.id -> webhook_deliveries.webhook_endpoint_id
webhook_deliveries.id -> webhook_delivery_attempts.delivery_id
integration_configs.id -> integration_sync_jobs.integration_id
import_jobs.id          -> import_job_errors.import_job_id
attendance_devices.id   -> attendance_device_mappings.device_id
attendance_devices.id   -> attendance_device_raw_events.device_id
external_id_mappings -> (system, entity_type, external_id, internal_id)
```

External callers đi qua API key, rate limit, idempotency và audit; không truy cập trực tiếp các bảng nghiệp vụ.
