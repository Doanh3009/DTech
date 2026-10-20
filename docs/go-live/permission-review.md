# Permission review template

Environment/date/reviewer: ___

Xuất từ DB theo `app_accounts → account_roles → roles → role_permissions`; không đưa email/PII vào repo. Business owner duyệt các nhóm:

| Review set | Permission/filter | Owner | Count | Evidence | Status |
|---|---|---|---:|---|---|
| Active admins | role `admin`, status active | Management | — | — | NOT RUN |
| Sensitive employee view/export | `employee.view_sensitive`, `employee.export_sensitive` | HR | — | — | NOT RUN |
| Timesheet unlock/detail export | `timesheet.unlock`, `timesheet.export_detail` | HR/Finance | — | — | NOT RUN |
| Warehouse post/reverse | `warehouse.*.post/reverse` | Warehouse | — | — | NOT RUN |
| All shipments | `import_export.view_all` | XNK | — | — | NOT RUN |
| API/integration admin | `api_key.*`, `service_account.manage`, `integration.manage` | IT | — | — | NOT RUN |
| Approver resolution | representative 10–20 employees | Department owners | — | — | NOT RUN |

Kiểm tra negative access bằng account thật đã mask/copy staging. Không cấp admin để “test cho tiện”.
