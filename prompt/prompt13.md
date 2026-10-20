# PROMPT 13 — API, WEBHOOK, API KEY, TÍCH HỢP BÊN NGOÀI, BẢO MẬT VÀ NỀN TẢNG KẾT NỐI MISA / POWER BI / ZALO / MÁY CHẤM CÔNG

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã xác lập hoặc triển khai:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- Nhân sự
- tài khoản / RBAC
- Admin Console
- chấm công cá nhân
- Project / Worksite
- điểm danh công nhân
- nghỉ phép / approval / PDF
- bảng công / khóa kỳ / Excel
- cập nhật dự án / dashboard
- quản lý Kho
- quản lý Xuất nhập khẩu
- Approval Center
- Notification Center
- Document Center
- Audit Log
- Business Configuration Center
- API-first architecture
- private storage
- configuration over hard-code

Prompt này triển khai **Integration Platform** để hệ thống có thể kết nối với các nền tảng khác mà không phải sửa kiến trúc cốt lõi.

Mục tiêu tương lai gồm:

```text
MISA
Power BI
Zalo
Email
Google Workspace
Máy chấm công
Ứng dụng mobile
ERP khác
Dịch vụ vận chuyển / forwarder
Các hệ thống nội bộ khác
```

Không tích hợp giả với dịch vụ bên ngoài nếu chưa có credential/provider thật.

Prompt này xây **nền tảng kết nối an toàn**, và chỉ implement adapter cụ thể khi đã có dữ liệu/cấu hình phù hợp.

---

# 1. MỤC TIÊU

Xây nền tảng có khả năng:

1. API versioning.
2. API authentication.
3. API Key.
4. Service Account.
5. API scopes.
6. Rate limit.
7. Request logging.
8. Idempotency.
9. Webhooks outbound.
10. Webhooks inbound.
11. Webhook signatures.
12. Retry queue.
13. Dead-letter handling.
14. Integration registry.
15. Integration credentials.
16. Secret storage.
17. Connector health.
18. Integration logs.
19. Manual retry.
20. Disable integration.
21. Data mapping.
22. Event registry.
23. Sync jobs.
24. Import jobs.
25. Export jobs.
26. CSV/Excel/API ingestion foundation.
27. Future MISA adapter.
28. Future Power BI adapter.
29. Future Zalo adapter.
30. Future attendance machine adapter.

Không cho external system truy cập trực tiếp database.

---

# 2. KIẾN TRÚC BẮT BUỘC

External system:

```text
External System
↓
Châu Tuấn Integration/API Layer
↓
Authentication
↓
Authorization / Scope
↓
Validation
↓
Business Service
↓
Audit
↓
Database
```

Không:

```text
External System
↓
Database trực tiếp
```

---

# 3. API VERSIONING

Chuẩn hóa:

```text
/api/v1/...
```

Ví dụ:

```text
/api/v1/employees
/api/v1/attendance
/api/v1/leave-requests
/api/v1/projects
/api/v1/warehouse
/api/v1/shipments
```

Không để external integration phụ thuộc route nội bộ frontend.

---

# 4. INTERNAL API VS EXTERNAL API

Phân biệt:

```text
Internal App API
External Integration API
```

Có thể dùng cùng business services nhưng security contract khác.

Không expose toàn bộ internal endpoint ra external chỉ vì tiện.

---

# 5. EXTERNAL API PREFIX

Có thể dùng:

```text
/api/v1/integrations/...
```

hoặc:

```text
/api/external/v1/...
```

Nếu framework hiện tại có convention tốt hơn thì giữ nhất quán.

Mục tiêu:

- rõ external contract
- dễ rate limit
- dễ audit
- dễ version

---

# 6. API AUTHENTICATION

Hỗ trợ:

```text
API Key
Service Account Token
OAuth2 future
Signed Webhook
```

Không dùng employee session cookie cho machine-to-machine integration.

---

# 7. API KEY

Admin route:

```text
/settings/integrations/api-keys
```

Cho phép:

```text
Tạo API Key
Tên
Mô tả
Scopes
Expiration
Allowed IPs optional
Status
Last used
```

---

# 8. API KEY SECRET

Secret chỉ hiển thị **một lần khi tạo**.

Sau đó chỉ lưu hash hoặc secure representation.

Không hiển thị lại full secret.

UI:

```text
API key created

ct_live_xxxxxxxxx

Hãy sao chép ngay.
Bạn sẽ không thể xem lại khóa này.
```

---

# 9. API KEY PREFIX

Có thể dùng prefix:

```text
ct_live_
ct_test_
```

để dễ nhận biết.

Không encode sensitive information trong prefix.

---

# 10. API KEY REVOCATION

Admin có action:

```text
Thu hồi
```

Sau revoke:

- request mới bị reject
- audit
- không hard delete record
- giữ usage history

---

# 11. API KEY ROTATION

Hỗ trợ:

```text
Rotate key
```

Có thể cho grace period nếu cần.

Không overwrite key hiện tại mà không trace.

---

# 12. API SCOPES

Không dùng một API key full access mặc định.

Scope ví dụ:

```text
employees.read
employees.write

attendance.read
attendance.write

timesheets.read

projects.read

warehouse.read
warehouse.write

shipments.read
shipments.write

reports.read
```

Không reuse UI permission key mù quáng nếu external API contract cần scope riêng.

Có thể map permission semantics.

---

# 13. SCOPE PRINCIPLE

API key chỉ được phép:

```text
explicitly granted scopes
```

Default deny.

Không:

```text
all access unless denied
```

---

# 14. SERVICE ACCOUNT

Cho phép tạo Service Account:

```text
MISA Integration
Power BI
Attendance Machine Gateway
```

Service account:

- không phải employee
- không xuất hiện danh sách nhân sự
- có own identity
- có scopes
- có audit identity

Không tạo fake employee để integration login.

---

# 15. SERVICE ACCOUNT LIFECYCLE

Status:

```text
ACTIVE
DISABLED
REVOKED
```

Có:

```text
created_at
last_used_at
created_by
```

Không login interactive qua employee login.

---

# 16. IP RESTRICTION

Optional:

```text
allowed IPs
```

Cho integration cố định.

Không bắt buộc nếu provider thay IP động.

UI phải warning khi cấu hình sai.

---

# 17. RATE LIMIT

External API phải có rate limit.

Theo:

```text
API key
Service account
Endpoint category
IP
```

Ví dụ conceptual:

```text
100 requests/minute
```

Không hard-code cùng một limit cho mọi integration nếu có config.

---

# 18. RATE LIMIT RESPONSE

Return chuẩn:

```text
429 Too Many Requests
```

Có:

```text
Retry-After
```

Không trả raw internal detail.

---

# 19. REQUEST ID

Mọi external request có:

```text
request_id
correlation_id
```

Nếu client gửi:

```text
X-Request-ID
```

có thể reuse nếu valid.

Không trust arbitrary huge value.

---

# 20. IDEMPOTENCY

POST quan trọng phải support:

```text
Idempotency-Key
```

Ví dụ:

```text
attendance event ingestion
warehouse receipt creation
shipment update
```

Retry cùng key không tạo duplicate.

---

# 21. API ERROR CONTRACT

Chuẩn response lỗi:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Dữ liệu không hợp lệ.",
    "request_id": "..."
  }
}
```

Không expose stack trace.

---

# 22. PAGINATION

External list API phải có:

```text
page/limit
```

hoặc cursor.

Không cho fetch toàn bộ employee/ledger history không giới hạn.

---

# 23. FILTERING

Chỉ whitelist filter.

Ví dụ:

```text
updated_since
status
department_id
project_id
date_from
date_to
```

Không cho arbitrary SQL filter syntax.

---

# 24. SORTING

Whitelist fields.

Không nhận raw:

```text
ORDER BY ${client_input}
```

---

# 25. DATA MINIMIZATION

External API chỉ trả field cần thiết.

Không trả CCCD/ngân hàng mặc định.

Sensitive field cần:

- dedicated scope
- explicit endpoint/field selection
- audit

---

# 26. FIELD-LEVEL SECURITY

Ví dụ:

```text
employees.read
```

không đồng nghĩa:

```text
employee_sensitive.read
```

Sensitive scope riêng.

---

# 27. WEBHOOK OUTBOUND

Hệ thống có thể gửi webhook khi event xảy ra.

Ví dụ:

```text
employee.created
employee.updated

attendance.checked_in
attendance.checked_out

leave.approved

project.issue.created

warehouse.receipt.posted
warehouse.issue.posted

shipment.eta.changed
shipment.received
```

---

# 28. WEBHOOK CONFIG

Admin route:

```text
/settings/integrations/webhooks
```

Mỗi webhook:

```text
Name
Endpoint URL
Subscribed events
Secret
Status
Timeout
Retry policy
Created by
Last delivery
```

---

# 29. WEBHOOK URL VALIDATION

Không cho:

- javascript URL
- file URL
- localhost/internal metadata endpoints nếu SSRF risk
- invalid scheme

Chỉ allow:

```text
https
```

HTTP chỉ dev/local nếu explicit environment.

---

# 30. SSRF PROTECTION

Outbound webhook sender phải chống SSRF.

Không gọi:

- 127.0.0.1
- localhost
- link-local
- cloud metadata IP
- private ranges nếu policy không cho

Nếu internal webhook thật sự cần private network, cấu hình allowlist riêng.

---

# 31. WEBHOOK SIGNATURE

Mỗi delivery có signature.

Ví dụ:

```text
X-ChauTuan-Signature
X-ChauTuan-Timestamp
X-ChauTuan-Event
X-ChauTuan-Delivery-Id
```

Dùng HMAC SHA-256 hoặc tương đương an toàn.

Không gửi secret trong header.

---

# 32. REPLAY PROTECTION

Receiver có thể verify timestamp.

Documentation phải nêu:

- canonical payload
- signature algorithm
- timestamp tolerance

Không dùng static signature không timestamp.

---

# 33. WEBHOOK PAYLOAD

Payload có version:

```json
{
  "id": "...",
  "event": "shipment.eta.changed",
  "version": "1",
  "occurred_at": "...",
  "data": {}
}
```

Không gửi raw DB row nếu có field nhạy cảm.

---

# 34. EVENT SCHEMA

Mỗi event có schema typed/versioned.

Không:

```text
data = arbitrary object
```

không validation.

---

# 35. WEBHOOK RETRY

Nếu receiver trả:

```text
5xx
timeout
429
```

retry với backoff.

Ví dụ:

```text
1m
5m
30m
2h
12h
```

Không retry vô hạn.

---

# 36. KHÔNG RETRY MỘT SỐ 4XX

Ví dụ:

```text
400
401
403
404
```

có thể mark failure cần admin xử lý.

429 có retry theo Retry-After.

---

# 37. DELIVERY LOG

Mỗi webhook delivery:

```text
delivery_id
webhook_id
event_id
attempt
request_time
response_status
response_time
error_category
next_retry_at
status
```

Không lưu full secret.

Có thể truncate response body.

---

# 38. MANUAL RETRY

Admin có:

```text
[Thử gửi lại]
```

Không tạo event mới.

Tạo delivery attempt mới cho event cũ.

Audit.

---

# 39. DEAD LETTER

Sau retry limit:

```text
FAILED
```

Admin thấy:

```text
Webhook thất bại 5 lần
```

Có:

```text
Retry
Disable webhook
View logs
```

---

# 40. INBOUND WEBHOOK

Một số external system có thể đẩy dữ liệu vào Châu Tuấn.

Ví dụ:

```text
forwarder ETA update
attendance machine event
Zalo callback
email provider delivery callback
```

Tạo inbound webhook registry.

---

# 41. INBOUND AUTH

Support:

```text
HMAC
Bearer secret
Provider-specific signature
```

Không accept unsigned public POST mặc định.

---

# 42. INBOUND REPLAY PROTECTION

Store:

```text
provider_event_id
```

hoặc:

```text
signature + timestamp + body hash
```

để chống duplicate/replay.

---

# 43. INBOUND VALIDATION

Flow:

```text
Verify signature
↓
Validate schema
↓
Deduplicate
↓
Map data
↓
Call business service
↓
Audit
```

Không update DB trực tiếp trong webhook controller.

---

# 44. INTEGRATION REGISTRY

Admin route:

```text
/settings/integrations
```

List:

```text
MISA
Power BI
Zalo
Email
Máy chấm công
Custom Webhook
Custom API Client
```

Chỉ hiển thị connector đã implement hoặc foundation entry rõ trạng thái.

Không giả "Connected" khi chưa có credentials.

---

# 45. INTEGRATION STATUS

```text
NOT_CONFIGURED
CONNECTED
DEGRADED
ERROR
DISABLED
```

Không chỉ boolean.

---

# 46. INTEGRATION DETAIL

Trang:

```text
/settings/integrations/:id
```

Hiển thị:

```text
Status
Last successful sync
Last error
Credentials status
Scopes
Sync direction
Mappings
Logs
```

Không show raw secret.

---

# 47. SECRET STORAGE

Credentials phải:

- server-side only
- encrypted at rest nếu infra hỗ trợ
- không gửi về frontend
- không log
- không serialize vào client config

Không lưu plain secret trong generic settings JSON.

---

# 48. SECRET UPDATE UI

UI:

```text
Client ID
********
Client Secret
********
```

Cho:

```text
Cập nhật secret
```

Không reveal secret cũ.

---

# 49. CONNECTION TEST

Có:

```text
[Kiểm tra kết nối]
```

Server test credential/endpoint.

Return:

```text
Kết nối thành công
```

hoặc error human-readable.

Không log secret.

---

# 50. INTEGRATION HEALTH

Track:

```text
last_success_at
last_failure_at
consecutive_failures
last_error_code
```

Dashboard admin có:

```text
2 tích hợp cần chú ý
```

---

# 51. SYNC JOB

Cho integrations cần đồng bộ định kỳ:

```text
Sync Job
```

Fields:

```text
integration_id
sync_type
direction
started_at
completed_at
status
records_read
records_written
records_failed
cursor
error_summary
```

---

# 52. SYNC DIRECTION

```text
PUSH
PULL
BIDIRECTIONAL
```

Không assume bidirectional cho mọi integration.

---

# 53. INCREMENTAL SYNC

Ưu tiên:

```text
updated_since
cursor
last_synced_at
```

Không full-sync toàn bộ mỗi giờ nếu không cần.

---

# 54. CHECKPOINT

Sync job phải có checkpoint/cursor.

Nếu fail giữa chừng:

- resume an toàn
- không duplicate
- không mất record

---

# 55. DATA MAPPING

External field mapping phải typed.

Ví dụ future MISA:

```text
ChauTuan employee_code
→ MISA employee_code
```

Không cho arbitrary JS transform ở Admin Console.

---

# 56. MAPPING UI

Nếu cần:

```text
Nguồn
Đích
Transformation preset
```

Preset:

```text
Direct
Trim
Uppercase
Date format
Enum mapping
```

Không raw code.

---

# 57. ENUM MAPPING

Ví dụ:

```text
ACTIVE → 1
INACTIVE → 0
```

Configurable.

Validate duplicate/unmapped value.

---

# 58. EXTERNAL ID MAPPING

Tạo mapping table:

```text
integration_id
entity_type
internal_id
external_id
```

Không lưu external ID lung tung trong mọi domain table nếu có nhiều systems.

---

# 59. SOURCE OF TRUTH

Mỗi integration phải định nghĩa:

```text
Source of Truth
```

Ví dụ:

```text
Employee master:
Châu Tuấn = source of truth

Accounting:
MISA = source of truth for accounting data

Attendance:
Châu Tuấn = source of truth for web/mobile attendance
```

Không sync hai chiều cùng field mà không có ownership rule.

---

# 60. CONFLICT POLICY

Nếu bidirectional future:

```text
Internal wins
External wins
Manual review
Latest timestamp
```

Phải config theo entity/field.

Không dùng "latest wins" mặc định cho dữ liệu nhạy cảm.

---

# 61. MANUAL REVIEW QUEUE

Nếu sync conflict:

Route:

```text
/settings/integrations/conflicts
```

Hiển thị:

```text
Entity
Internal value
External value
Integration
Detected at
```

Actions:

```text
Giữ nội bộ
Dùng dữ liệu ngoài
Bỏ qua
```

Audit.

---

# 62. MISA — FOUNDATION

Không implement API thật nếu chưa có API docs/credentials.

Chuẩn bị adapter interface:

```text
MisaConnector
```

Potential capabilities:

```text
employee export
timesheet export
warehouse document export
accounting reference
```

Không assume endpoint/schema.

---

# 63. MISA DATA EXPORT

Future flow:

```text
Timesheet locked
↓
Generate export payload
↓
MISA adapter
↓
Push / File export
↓
Sync status
```

Không để MISA integration đọc DB trực tiếp.

---

# 64. POWER BI — FOUNDATION

Power BI cần read-oriented integration.

Có thể support:

```text
read-only API
scheduled export
database replica future
```

V1 ưu tiên:

```text
Read-only reporting API
```

hoặc secure export endpoint.

Không cung cấp production DB credential trực tiếp.

---

# 65. POWER BI DATASET

Potential datasets:

```text
employees summary
timesheet summary
project summary
warehouse balance
shipment status
```

Sensitive fields excluded by default.

---

# 66. ZALO — FOUNDATION

Zalo có thể dùng cho notification.

Không implement nếu chưa có Zalo OA/API credentials.

Adapter:

```text
ZaloNotificationProvider
```

Notification system từ Prompt 12 gọi provider abstraction.

---

# 67. EMAIL — FOUNDATION

Tương tự:

```text
EmailProvider
```

Không hard-code provider.

Support:

```text
send transactional notification
```

Không build email marketing.

---

# 68. ATTENDANCE MACHINE — FOUNDATION

Máy chấm công có thể gửi:

```text
employee code
timestamp
device id
event type
```

Adapter phải map:

```text
external employee code
→ internal employee_id
```

Không ghi trực tiếp daily timesheet.

Phải tạo:

```text
Raw Attendance Event
source = ATTENDANCE_DEVICE
```

rồi Timesheet service xử lý.

---

# 69. DEVICE REGISTRY

Admin route future/current:

```text
/settings/integrations/attendance-devices
```

Fields:

```text
Device code
Name
Location
Provider/model
Status
Last heartbeat
Mapping
Secret/API key
```

Không yêu cầu nếu chưa có thiết bị.

---

# 70. DEVICE EVENT IDEMPOTENCY

Attendance machine thường retry.

Use unique:

```text
device_id + external_event_id
```

hoặc deterministic event fingerprint.

Không tạo double attendance.

---

# 71. DEVICE TIMEZONE

Phải config:

```text
device timezone
```

Không assume device trả UTC.

Normalize về system time.

---

# 72. DEVICE EMPLOYEE MAPPING

Có:

```text
external_user_code
internal_employee_id
```

Nếu không map được:

```text
Unmatched Event Queue
```

Không discard.

---

# 73. UNMATCHED QUEUE

Admin/HR có page:

```text
Sự kiện chưa ghép nhân viên
```

Actions:

```text
Ghép nhân viên
Bỏ qua
```

Sau mapping có thể reprocess.

Audit.

---

# 74. IMPORT FOUNDATION

Ngoài API, hệ thống có thể nhận:

```text
CSV
Excel
```

cho migration/bulk data.

Prompt này chỉ tạo generic controlled import framework nếu chưa có.

Flow:

```text
Upload
↓
Parse
↓
Map columns
↓
Validate
↓
Preview
↓
Import
↓
Result
```

Không import trực tiếp vào DB table.

---

# 75. IMPORT JOB

Fields:

```text
type
file_id
status
rows_total
rows_valid
rows_invalid
rows_imported
requested_by
started_at
completed_at
```

---

# 76. DRY RUN

Import phải có preview/dry-run.

Ví dụ:

```text
1,000 dòng
980 hợp lệ
20 lỗi
```

Không commit trước khi user xác nhận nếu workflow cần.

---

# 77. ROW ERROR REPORT

Cho download:

```text
row number
field
error
```

Không chỉ "Import failed".

---

# 78. BULK UPSERT POLICY

Mỗi import type phải explicit:

```text
CREATE_ONLY
UPDATE_BY_KEY
UPSERT
```

Không generic upsert tự động.

---

# 79. API DOCUMENTATION

Tạo docs cho external API.

Có thể dùng:

```text
OpenAPI
```

Route internal admin/dev:

```text
/settings/integrations/api-docs
```

hoặc docs generated.

Không expose private docs public nếu không cần.

---

# 80. OPENAPI

Document:

- endpoint
- auth
- scopes
- request
- response
- error codes
- rate limit
- idempotency
- pagination

Không để docs lệch implementation.

---

# 81. WEBHOOK DOCUMENTATION

Document:

- event names
- payload schema
- signature verification
- retry behavior
- delivery IDs
- test webhook

---

# 82. TEST WEBHOOK

Admin có:

```text
[Gửi webhook thử]
```

Payload:

```text
test.event
```

Không dùng production business event giả.

---

# 83. WEBHOOK SECRET ROTATION

Support rotate secret.

Có thể grace verify old+new trong window.

Không reveal old secret.

---

# 84. LOG RETENTION

Integration logs có retention config.

Không giữ full payload nhạy cảm vô hạn.

Có thể redact sensitive fields.

---

# 85. PAYLOAD REDACTION

Log:

```text
authorization: [REDACTED]
api_key: [REDACTED]
cccd: [REDACTED]
bank_account: [REDACTED]
```

Không log secrets.

---

# 86. AUDIT

Audit:

```text
API key created
API key revoked
scope changed
webhook created
webhook disabled
secret rotated
integration enabled
integration credential changed
manual retry
conflict resolved
mapping changed
```

---

# 87. INTEGRATION LOG VS AUDIT LOG

Phân biệt:

```text
Integration Log
= request/sync/delivery technical result

Audit Log
= user/admin action
```

Không trộn.

---

# 88. ADMIN ROUTING

Routes:

```text
/settings/integrations

/settings/integrations/api-keys
/settings/integrations/service-accounts
/settings/integrations/webhooks
/settings/integrations/webhook-deliveries
/settings/integrations/conflicts
/settings/integrations/imports
/settings/integrations/api-docs

/settings/integrations/:integrationId
/settings/integrations/:integrationId/logs
/settings/integrations/:integrationId/mappings
```

Không giant settings page.

---

# 89. INTEGRATION DASHBOARD

Hiển thị:

```text
Integrations connected
Errors today
Failed webhooks
Last sync
API requests
```

Không quá nhiều chart.

---

# 90. HEALTH BADGE

```text
Đã kết nối
Cần chú ý
Lỗi
Đã tắt
Chưa cấu hình
```

Không chỉ màu.

---

# 91. PERMISSIONS

Gợi ý:

```text
integration.view
integration.manage

api_key.view
api_key.create
api_key.revoke

service_account.manage

webhook.view
webhook.manage
webhook.retry

integration_log.view

integration_conflict.view
integration_conflict.resolve

import.create
import.execute

api_docs.view
```

Không hard-code admin role.

---

# 92. SECURITY — ADMIN UI

Secret input:

- autocomplete off hợp lý
- không đưa vào URL
- không đưa vào client logs
- không cache local
- không prefill secret cũ

---

# 93. SECURITY — CSRF / CORS

External API:

- CORS restrictive
- machine-to-machine không cần wildcard browser access

Admin UI:
- giữ CSRF/session protections framework hiện tại

Không set:

```text
Access-Control-Allow-Origin: *
```

cho sensitive API không lý do.

---

# 94. TLS

Production external API/webhooks bắt buộc HTTPS.

Không transmit API keys qua HTTP.

---

# 95. REQUEST BODY LIMIT

Set limit phù hợp.

Không cho JSON payload hàng trăm MB.

File upload dùng upload endpoint riêng.

---

# 96. FILE IMPORT SECURITY

Validate:

- file type
- size
- malware scanning hook future
- no macro execution
- parser safe

Không execute Excel macros.

---

# 97. DATA EXPORT SECURITY

Nếu external API export nhạy cảm:

- permission/scope
- audit
- rate limit
- pagination
- no public file URL

---

# 98. API DEPRECATION

Nếu sau này v2:

```text
v1
v2
```

Không break v1 ngay.

Có deprecation headers/docs.

Không cần implement v2 bây giờ.

---

# 99. FEATURE FLAGS

Integration adapter chưa hoàn thiện:

```text
disabled
```

Không expose button "Connect" nếu backend chưa support.

---

# 100. BACKGROUND WORKER

Cần queue/background worker cho:

- webhook retry
- sync jobs
- imports
- large exports
- provider callbacks
- reconciliation

Không xử lý heavy sync trong web request nếu lâu.

---

# 101. JOB LOCKING

Scheduled sync không chạy duplicate cùng integration.

Dùng lock/advisory lock/job uniqueness.

---

# 102. RETRY POLICY

Phân loại error:

```text
TRANSIENT
AUTH
VALIDATION
RATE_LIMIT
PERMANENT
```

Retry chỉ transient/rate limit phù hợp.

Không retry auth failure vô hạn.

---

# 103. CIRCUIT BREAKER — OPTIONAL

Nếu provider fail liên tục:

```text
DEGRADED
```

có thể pause sync tạm.

Không cần circuit breaker phức tạp nếu stack nhỏ, nhưng tránh spam provider.

---

# 104. RECONCILIATION JOB

Integration quan trọng nên có:

```text
reconcile()
```

Ví dụ:

```text
external IDs
sync status
counts
```

Không silently assume push luôn thành công.

---

# 105. MISA FUTURE CONTRACT

Tạo interface conceptual:

```text
AccountingIntegration
```

Capabilities:

```text
pushTimesheetSummary()
pushWarehouseDocument()
pushEmployeeMaster()
healthCheck()
```

Không implement endpoint giả.

---

# 106. POWER BI FUTURE CONTRACT

Interface:

```text
ReportingDataProvider
```

Read-only datasets.

Không cho Power BI write.

---

# 107. ZALO FUTURE CONTRACT

Interface:

```text
NotificationChannelProvider
```

Method:

```text
sendMessage()
healthCheck()
```

Không leak full internal context qua notification.

---

# 108. ATTENDANCE DEVICE FUTURE CONTRACT

Interface:

```text
AttendanceDeviceAdapter
```

Methods:

```text
ingestEvent()
mapUser()
healthCheck()
```

Raw event đi vào Attendance domain.

---

# 109. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
integration_configs
integration_secrets_ref

api_keys
service_accounts
service_account_scopes

webhooks
webhook_subscriptions
webhook_deliveries

integration_sync_jobs
integration_logs
integration_conflicts
external_id_mappings

import_jobs
import_job_errors

attendance_devices
attendance_device_mappings
unmatched_external_events
```

Secrets không nằm plain trong config row.

---

# 110. API GỢI Ý — ADMIN

```text
GET/POST /api/v1/integrations/api-keys
POST /api/v1/integrations/api-keys/:id/revoke

GET/POST /api/v1/integrations/webhooks
POST /api/v1/integrations/webhooks/:id/test
POST /api/v1/integrations/webhook-deliveries/:id/retry

GET /api/v1/integrations
GET/PATCH /api/v1/integrations/:id
POST /api/v1/integrations/:id/test-connection

GET /api/v1/integrations/:id/logs
```

---

# 111. API GỢI Ý — EXTERNAL

Ví dụ read-only:

```text
GET /api/external/v1/employees
GET /api/external/v1/timesheets
GET /api/external/v1/projects
GET /api/external/v1/inventory
GET /api/external/v1/shipments
```

Write endpoint chỉ mở khi business cần.

Không mặc định external write toàn hệ thống.

---

# 112. TEST CASES — API KEY

- create key
- secret shown once
- hash stored
- valid request
- invalid key
- expired key
- revoked key
- scope denied
- rate limit
- last used updated

---

# 113. TEST CASES — WEBHOOK

- create webhook
- subscribe events
- sign payload
- receiver 200
- receiver 500
- retry
- 429 retry-after
- permanent 400
- dead-letter
- manual retry
- secret rotate
- SSRF URL blocked

---

# 114. TEST CASES — INBOUND

- valid signature
- invalid signature
- expired timestamp
- duplicate provider event
- invalid schema
- business validation
- no direct DB write

---

# 115. TEST CASES — SYNC

- incremental sync
- checkpoint
- network failure
- resume
- duplicate external record
- external ID mapping
- conflict queue
- disabled integration

---

# 116. TEST CASES — ATTENDANCE DEVICE

- mapped employee
- unmapped employee
- duplicate event
- timezone conversion
- source = ATTENDANCE_DEVICE
- event flows into raw attendance only

---

# 117. TEST CASES — IMPORT

- valid Excel/CSV
- invalid columns
- mixed valid/invalid rows
- preview
- confirm
- row error export
- no arbitrary DB upsert

---

# 118. ACCEPTANCE CRITERIA

## API Platform

- [ ] Versioned API.
- [ ] External API separated logically.
- [ ] API Key.
- [ ] Service Account.
- [ ] Scopes.
- [ ] Rate limit.
- [ ] Request IDs.
- [ ] Idempotency.
- [ ] Standard error contract.

## Webhooks

- [ ] Outbound webhooks.
- [ ] Event subscriptions.
- [ ] HMAC signature.
- [ ] Replay protection.
- [ ] Retry.
- [ ] Dead-letter.
- [ ] Manual retry.
- [ ] Delivery logs.
- [ ] SSRF protection.

## Integrations

- [ ] Integration registry.
- [ ] Secure credential handling.
- [ ] Health status.
- [ ] Test connection.
- [ ] Sync jobs.
- [ ] External ID mapping.
- [ ] Conflict handling.

## Future adapters

- [ ] MISA-ready interface.
- [ ] Power BI read-only foundation.
- [ ] Zalo notification provider foundation.
- [ ] Attendance-device adapter foundation.
- [ ] Không fake provider implementation.

## Security

- [ ] Secrets not exposed.
- [ ] No direct DB integration.
- [ ] Sensitive field scopes.
- [ ] CORS restrictive.
- [ ] HTTPS requirement.
- [ ] Payload/log redaction.
- [ ] Audit.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Webhook retry tests pass.
- [ ] Security tests pass.
- [ ] Production build pass.

---

# 119. THỨ TỰ TRIỂN KHAI

1. Inspect existing API/auth/event foundation.
2. Chuẩn hóa external API boundary.
3. Thiết kế API Key.
4. Thiết kế Service Account.
5. Scope model.
6. Rate limit/idempotency/request ID.
7. Thiết kế Webhook model.
8. Event schema registry.
9. Signature/retry/dead-letter.
10. Inbound webhook framework.
11. Integration registry.
12. Secret storage.
13. Sync Job framework.
14. External ID mapping.
15. Conflict queue.
16. Import framework.
17. Attendance device foundation.
18. Provider interfaces: MISA/Power BI/Zalo.
19. Admin Integration UI.
20. API/Webhook docs.
21. Audit/integration logs.
22. Tests.
23. Security review.
24. Lint/typecheck/build.
25. Báo cáo.

---

# 120. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## API Platform

- external/internal boundary
- authentication
- scopes
- rate limits
- idempotency

## Webhooks

- event schema
- signing
- retry
- delivery logs

## Integrations

- registry
- secret handling
- sync jobs
- mappings/conflicts

## Future adapters

- MISA
- Power BI
- Zalo
- attendance machine

## Admin UI

- routes
- key management
- webhook management
- logs

## Security

- secret protection
- SSRF
- CORS
- redaction

## Tests

- cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 121. QUY TẮC CUỐI

Không cho external system truy cập database trực tiếp.

Không lưu API secret plain text.

Không hiển thị lại secret sau khi tạo.

Không dùng một API key full access mặc định.

Không gửi webhook unsigned.

Không retry webhook vô hạn.

Không log Authorization/API key/secret.

Không cho webhook gây SSRF.

Không để inbound webhook update DB trực tiếp ngoài business service.

Không implement MISA/Zalo/Power BI giả nếu chưa có API docs/credential thật.

Không đưa máy chấm công trực tiếp vào Daily Timesheet; phải qua Raw Attendance Event.

Không xây generic sync engine không có ownership/source-of-truth rule.

**Dừng sau khi API Platform + Webhook Platform + Integration Registry + Secure Credentials + Sync/Import Foundation hoàn chỉnh, test/build pass và báo cáo kết quả.**
