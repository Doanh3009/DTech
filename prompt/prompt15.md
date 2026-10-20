# PROMPT 15 — HARDENING TOÀN HỆ THỐNG: SECURITY, BACKUP/RESTORE, MONITORING, LOGGING, ERROR TRACKING, DATABASE MAINTENANCE VÀ PRODUCTION READINESS

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã triển khai hoặc xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- Nhân sự
- User Account / RBAC
- Admin Console
- chấm công cá nhân
- Project / Worksite
- điểm danh công nhân
- nghỉ phép / approval / phép năm / PDF
- bảng công / khóa kỳ / Excel
- cập nhật dự án / issue / dashboard
- Kho
- Xuất nhập khẩu
- Approval Center
- Notification Center
- Document Center
- Audit Log
- Business Configuration Center
- API / Webhook / Integration Platform
- Dashboard / Global Search / Command Center

Prompt này **không bổ sung thêm một module nghiệp vụ mới**.

Prompt này tập trung vào việc đưa toàn bộ hệ thống từ trạng thái:

```text
"Chạy được"
```

thành:

```text
"Đủ an toàn, đủ quan sát, đủ khả năng phục hồi và đủ tiêu chuẩn để vận hành production nội bộ"
```

Đây là bước hardening bắt buộc trước khi coi hệ thống là hoàn chỉnh.

---

# 1. MỤC TIÊU

Rà soát và hoàn thiện toàn bộ hệ thống theo các nhóm:

1. Security hardening.
2. Authentication/session security.
3. Authorization review.
4. Sensitive data protection.
5. Secret management.
6. Secure file handling.
7. Backup strategy.
8. Restore strategy.
9. Restore drill.
10. Database resilience.
11. Database maintenance.
12. Monitoring.
13. Application health checks.
14. Error tracking.
15. Structured logging.
16. Correlation/request tracing.
17. Performance monitoring.
18. Storage monitoring.
19. Background jobs monitoring.
20. Queue/retry visibility.
21. Scheduled task safety.
22. Dependency failure handling.
23. Graceful degradation.
24. Production environment configuration.
25. Staging environment.
26. Migration/deployment safety.
27. Rollback strategy.
28. Data retention.
29. Disaster recovery foundation.
30. Operational runbook.
31. Security/operations Admin Console pages.
32. Final production-readiness checklist.

---

# 2. NGUYÊN TẮC

Không tối ưu theo hướng:

```text
"deploy được là xong"
```

Phải đảm bảo hệ thống có câu trả lời cho:

```text
Nếu database lỗi thì sao?
Nếu storage lỗi thì sao?
Nếu deployment lỗi thì rollback thế nào?
Nếu background job chạy trùng thì sao?
Nếu webhook fail liên tục thì ai biết?
Nếu dung lượng ảnh chấm công tăng mạnh thì sao?
Nếu user report dữ liệu sai thì trace bằng gì?
Nếu restore backup thì đã từng test chưa?
Nếu một API chậm thì tìm ở đâu?
Nếu secret bị lộ thì rotate thế nào?
```

---

# 3. SECURITY REVIEW TOÀN HỆ THỐNG

Rà soát tất cả module.

Không chỉ auth/login.

Bao gồm:

```text
Authentication
Authorization
Input validation
Output filtering
File upload
Storage access
API
Webhooks
Admin Console
Exports
PDF
Search
Background jobs
Logs
Secrets
Database
```

---

# 4. AUTHENTICATION HARDENING

Rà soát:

- password policy phù hợp
- secure password hashing
- login throttling
- brute-force protection
- session expiration
- secure logout
- account disabled behavior
- password reset nếu có
- session revocation
- suspicious login handling foundation

Không tự tạo custom crypto.

Dùng framework/auth provider chuẩn.

---

# 5. PASSWORD POLICY

Không ép policy vô lý kiểu:

```text
1 hoa + 1 thường + 1 số + 1 ký tự + đổi mỗi 30 ngày
```

nếu không có lý do.

Ưu tiên:

- minimum reasonable length
- block extremely weak passwords nếu framework/provider support
- secure hash
- rate limiting

Nếu hệ thống dùng external auth provider, follow provider best practices.

---

# 6. LOGIN RATE LIMIT

Protect:

```text
/login
/password-reset
/OTP nếu có
```

Rate limit theo:

- account/email
- IP
- combined heuristics

Không lock account vĩnh viễn chỉ do attacker spam.

---

# 7. SESSION SECURITY

Nếu cookie session:

```text
HttpOnly
Secure
SameSite phù hợp
```

Session invalid khi:

- account disabled
- critical password/security change nếu policy
- user logs out

Không để disabled account giữ session dùng mãi.

---

# 8. SESSION DEVICE MANAGEMENT — FOUNDATION

Có thể chuẩn bị:

```text
Active sessions
Last activity
Device/browser summary
```

Admin hoặc user có:

```text
Đăng xuất khỏi phiên khác
```

Nếu stack support tốt.

Không fingerprint quá mức.

---

# 9. AUTHORIZATION REVIEW

Thực hiện systematic review tất cả route/API.

Phải xác nhận:

```text
UI hide
+
Server check
```

Không có route nào chỉ dựa vào frontend.

Đặc biệt rà soát:

- employee sensitive data
- attendance photos
- worker attendance
- leave balance
- timesheet adjust
- warehouse posting
- warehouse scope
- shipment documents
- API keys
- integration secrets
- audit logs
- settings
- exports

---

# 10. IDOR REVIEW

Kiểm tra direct object reference.

Ví dụ user đổi URL:

```text
/employees/OTHER_ID
/documents/OTHER_ID
/shipments/OTHER_ID
/attendance/photos/OTHER_ID
```

Server phải deny nếu scope không hợp lệ.

Test automated.

---

# 11. MASS ASSIGNMENT

Backend DTO/schema phải whitelist field.

Không nhận entire client object rồi:

```text
update(record, req.body)
```

nếu có thể user inject:

```text
role
status
permission
posted
approved
```

---

# 12. FIELD-LEVEL SECURITY

Sensitive field phải lọc server-side.

Ví dụ:

```text
employee.basic DTO
employee.sensitive DTO
```

Không gửi CCCD/ngân hàng rồi CSS hide.

---

# 13. CSRF

Nếu auth dựa session/cookie:

- CSRF protections bật cho state-changing actions
- SameSite appropriate
- origin checks nếu framework support

Không disable CSRF toàn app cho tiện.

---

# 14. CORS

Production:

- allow only trusted frontend origins
- external machine API có policy riêng
- không wildcard credentials

Không:

```text
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

---

# 15. XSS

Rà soát:

- project updates
- leave reason
- notes
- comments
- notification templates
- system notices
- document metadata
- warehouse notes
- shipment notes

Nếu rich text:

- sanitize
- whitelist tags

Không render user HTML raw.

---

# 16. SQL/QUERY INJECTION

Dùng ORM/query parameterization.

Global Search/filter/export template:

- whitelist field
- no raw SQL from admin/user

Không xây arbitrary query builder.

---

# 17. SSRF

Đã có webhook/integration.

Rà soát lại:

- webhook URLs
- import URL nếu có
- remote file fetch nếu có

Block private/meta endpoints trừ allowlist.

---

# 18. FILE UPLOAD HARDENING

Tất cả module reuse centralized FileService.

Validate:

```text
size
MIME
extension
signature/magic bytes nếu khả dụng
allowed dimensions
```

Không tin filename.

---

# 19. FILE TYPES

Tách policy theo use case:

Attendance:

```text
JPEG
PNG
WebP
```

Documents:

```text
PDF
DOCX
XLSX
images
```

Không cho executable.

SVG mặc định không dùng cho user uploads.

---

# 20. FILE NAME

Storage key system-generated.

Original filename chỉ metadata sanitized.

Không path traversal.

---

# 21. PRIVATE STORAGE

Xác nhận:

```text
Attendance photos
CCCD
Contracts
Shipment docs
Employee docs
Project private docs
Warehouse docs
```

đều private.

Không accidental public bucket.

---

# 22. SIGNED URL

Signed URL:

- short TTL
- generate after authorization
- không persist như business URL
- không log full URL nếu có secret query params

Stable internal route vẫn là canonical link.

---

# 23. FILE DOWNLOAD HEADERS

Set:

```text
Content-Type
Content-Disposition
X-Content-Type-Options
```

phù hợp.

Không allow browser execute unknown HTML upload.

Nếu file HTML không được phép thì reject.

---

# 24. MALWARE SCANNING — HOOK

Nếu infrastructure support:

```text
upload
↓
quarantine
↓
scan
↓
available
```

V1 có thể chỉ prepare hook nếu không có scanner.

Không claim malware scanning nếu chưa implement.

---

# 25. SECRET MANAGEMENT

Rà soát:

```text
DB URL
service-role key
API secrets
webhook secrets
email credentials
Zalo/MISA secrets
storage keys
```

Không nằm trong repo.

---

# 26. ENVIRONMENT VARIABLES

Tạo:

```text
.env.example
```

chỉ gồm key names + safe explanation.

Không có secret thật.

Production secrets qua platform secret manager/env config.

---

# 27. CLIENT BUNDLE SECRET CHECK

Rà build output để chắc:

- service role key không vào client
- DB credential không vào client
- private integration secret không vào client

Chỉ public client-safe env được expose.

---

# 28. SECRET ROTATION RUNBOOK

Document cách rotate:

- database credential
- API key
- webhook secret
- storage secret
- integration credential

Không cần auto rotate tất cả V1.

Nhưng phải biết quy trình.

---

# 29. BACKUP — DATABASE

Thiết kế backup rõ.

Ít nhất:

```text
Automated daily backup
Retention
Encrypted storage
Access restricted
```

Nếu provider đã có backup/PITR:

- kiểm tra thật cấu hình
- document
- không assume "Supabase chắc có"

---

# 30. BACKUP FREQUENCY

Chọn theo mức chấp nhận mất dữ liệu.

Ví dụ foundation:

```text
Daily full backup
+
PITR nếu plan/provider hỗ trợ
```

Không hard-code recommendation nếu infra hiện tại khác.

Codex phải inspect deployment target/config và ghi rõ actual capability.

---

# 31. BACKUP STORAGE

Backup không nên chỉ nằm cùng failure domain nếu có thể.

Ví dụ:

```text
DB provider backup
+
periodic independent export
```

nếu phù hợp.

Không commit database dump vào Git.

---

# 32. BACKUP FILE STORAGE

Database backup không đủ vì hệ thống có:

- attendance photos
- employee docs
- shipment docs
- project files

Phải có backup/replication strategy cho object storage.

---

# 33. FILE METADATA + BINARY CONSISTENCY

Backup phải đảm bảo có thể restore:

```text
DB file metadata
+
actual object binary
```

Không restore DB rồi tất cả file 404.

---

# 34. BACKUP ENCRYPTION

Backup nhạy cảm:

- encrypted at rest
- access controlled

Không upload dump chứa CCCD lên public drive.

---

# 35. BACKUP RETENTION

Document retention tiers.

Ví dụ:

```text
Daily: N days
Weekly: N weeks
Monthly: N months
```

Không cần dùng đúng số này nếu provider khác.

Phải configurable/documented.

---

# 36. RESTORE — BẮT BUỘC

Có backup mà chưa test restore = chưa đủ.

Tạo runbook:

```text
Restore database
Restore object storage
Verify migrations
Verify file links
Verify auth
Verify critical modules
```

---

# 37. RESTORE DRILL

Thực hiện trên staging/test environment nếu khả thi.

Test:

```text
Employee count
Latest attendance
Leave request
Warehouse balance
Shipment
Sample private file
```

Không restore production overwrite.

---

# 38. RPO / RTO

Document:

```text
RPO — mức dữ liệu tối đa có thể mất
RTO — thời gian mục tiêu phục hồi
```

Không cần enterprise SLA giả.

Ghi theo khả năng hạ tầng thật.

---

# 39. DISASTER RECOVERY

Runbook cho ít nhất:

```text
DB unavailable
Storage unavailable
Deployment broken
Credential compromised
Background queue stuck
```

---

# 40. DATABASE CONNECTION MANAGEMENT

Rà:

- connection pooling
- max connections
- serverless connection strategy nếu dùng
- idle connections

Không để production Vercel/serverless mở connection mới vô hạn.

---

# 41. DATABASE INDEX REVIEW

Dựa trên module đã xây, review query hot paths:

```text
employees
attendance events
timesheet by employee/date
project assignments
worker attendance sessions
leave approvals
warehouse ledger
inventory balances
shipments ETA/status
notifications
audit logs
search
```

Thêm index dựa trên query thực tế.

Không index mọi column.

---

# 42. QUERY PLAN REVIEW

Với query nặng:

- EXPLAIN / query plan nếu DB hỗ trợ
- identify sequential scan không cần thiết
- verify composite index order

Không tối ưu cảm tính.

---

# 43. N+1 REVIEW

Rà các màn:

```text
employee list
project detail
worker attendance
timesheet
warehouse ledger
shipment list
approval inbox
document center
dashboard
```

Không query mỗi row một request/query.

---

# 44. DATABASE CONSTRAINT REVIEW

Đảm bảo DB constraint tồn tại cho business invariant quan trọng:

```text
unique employee code
unique item code
unique document number where applicable
idempotency keys
foreign keys
positive quantities where required
valid status
```

Không chỉ frontend validation.

---

# 45. MIGRATION SAFETY

Migrations:

- ordered
- version-controlled
- repeatable deployment process
- no destructive migration without backup
- no manual schema changes production undocumented

---

# 46. DESTRUCTIVE MIGRATION

Nếu cần:

```text
drop column
rename
change type
```

dùng expand/contract migration nếu production data có.

Ví dụ:

```text
add new column
backfill
switch code
verify
drop old later
```

Không drop ngay trong same deploy nếu risk.

---

# 47. MIGRATION BACKUP

Trước high-risk migration:

- backup/snapshot
- verify rollback plan

Không "run and hope".

---

# 48. DATABASE MAINTENANCE

Theo DB provider, chuẩn bị:

- vacuum/analyze nếu relevant
- index health
- storage growth
- slow query monitoring

Không chạy maintenance command không phù hợp provider.

---

# 49. DATA ARCHIVAL

Các bảng tăng nhanh:

```text
audit logs
notifications
webhook deliveries
integration logs
raw attendance events
photo metadata
```

Cần retention/archive strategy.

Không auto delete business-critical history.

---

# 50. AUDIT RETENTION

Audit security/business critical có retention dài.

Integration technical logs có thể ngắn hơn.

Phân biệt:

```text
Business Record
Audit Record
Operational Log
```

---

# 51. MONITORING — MỤC TIÊU

Cần biết hệ thống:

```text
Up?
Slow?
Error?
Database okay?
Storage okay?
Jobs okay?
Integrations okay?
```

---

# 52. HEALTH CHECK

Endpoint internal/public-safe:

```text
/health
```

trả basic:

```text
status = ok
```

Không leak:

- DB credentials
- version secrets
- internal hostnames

---

# 53. READINESS CHECK

Có thể tách:

```text
/health/live
/health/ready
```

Liveness:

```text
process alive
```

Readiness:

```text
DB reachable
critical dependency reachable
```

Không bắt storage/provider external tất cả phải healthy để app process sống nếu có graceful mode.

---

# 54. HEALTH ADMIN PAGE

Admin route:

```text
/system-admin/system-health
```

Hiển thị:

```text
Application
Database
Storage
Background jobs
Webhook queue
Integrations
Last backup
```

Không show secrets.

---

# 55. STATUS

```text
Healthy
Degraded
Unavailable
Unknown
```

Không chỉ xanh/đỏ.

---

# 56. STRUCTURED LOGGING

Log dạng structured JSON/server logs.

Fields:

```text
timestamp
level
message
request_id
correlation_id
user_id hashed/internal id if appropriate
route
method
duration
status_code
service
error_code
```

Không log password/token/body nhạy cảm.

---

# 57. LOG LEVEL

```text
DEBUG
INFO
WARN
ERROR
```

Production không bật debug verbose mặc định.

---

# 58. REQUEST LOGGING

Log:

```text
request start/end
method
route template
status
duration
request id
```

Không log raw query nếu có sensitive values.

---

# 59. ERROR TRACKING

Tích hợp error tracking provider nếu available, hoặc abstraction.

Capture:

- uncaught frontend errors
- backend exceptions
- background job failures

Không capture sensitive request payload nguyên văn.

---

# 60. ERROR FINGERPRINT

Group lỗi giống nhau.

Không tạo hàng nghìn error item cùng stack.

---

# 61. USER-FACING ERROR ID

Khi lỗi server:

```text
Đã xảy ra lỗi.
Mã tham chiếu: REQ-xxxx
```

Support có thể tra request_id.

Không show stack trace.

---

# 62. FRONTEND ERROR BOUNDARY

Có:

```text
App-level error boundary
Route-level error boundary
Widget-level error boundary
```

Một widget lỗi không crash toàn app.

---

# 63. ERROR PAGE

404:

```text
Không tìm thấy trang.
```

403:

```text
Bạn không có quyền truy cập.
```

500:

```text
Hệ thống gặp sự cố.
```

Có action phù hợp:

```text
Thử lại
Về trang chủ
```

Không raw framework screen production.

---

# 64. PERFORMANCE MONITORING

Theo dõi:

```text
API latency
DB query latency
page load
export duration
image upload duration
background job duration
```

Không cần enterprise APM nếu chưa có.

Nhưng có metrics/log đủ để debug.

---

# 65. SLOW REQUEST

Define threshold.

Ví dụ:

```text
> 1s warning
> 3s high
```

tùy route.

Không dùng một threshold cho export job dài.

---

# 66. FRONTEND PERFORMANCE

Rà:

- bundle size
- route code splitting
- image lazy loading
- table virtualization khi cần
- no huge JSON payload
- no duplicate fetch

Đặc biệt:

```text
timesheet
audit log
warehouse ledger
document center
project updates
```

---

# 67. IMAGE PERFORMANCE

Attendance/project photos:

- thumbnail
- lazy load
- compressed upload
- full-size on demand

Không dùng original image cho list.

---

# 68. STORAGE MONITORING

Theo dõi:

```text
Total storage
Attendance photos
Employee docs
Project files
Shipment docs
Exports
Backups if same platform
```

Có warning threshold.

---

# 69. STORAGE LIFECYCLE

Temporary generated files:

```text
Excel exports
PDF previews
temporary uploads
```

có retention.

Business documents không tự xóa theo cùng policy.

---

# 70. ORPHAN FILE CLEANUP

Có scheduled job:

```text
file exists but no metadata/reference
```

và ngược lại.

Không auto delete ngay.

Flow:

```text
detect
report
quarantine/grace period
cleanup
```

---

# 71. BACKGROUND JOBS

Các job gồm:

```text
webhook retry
notifications
exports
imports
integration sync
document expiry
project stale check
shipment attention
file cleanup
backup verification hooks
```

Phải có visibility.

---

# 72. JOB STATUS

Admin:

```text
/system-admin/jobs
```

Hiển thị:

```text
Job type
Status
Started
Duration
Attempts
Last error
Next run
```

Không cần queue management enterprise UI.

---

# 73. JOB STATE

```text
QUEUED
RUNNING
SUCCEEDED
FAILED
RETRYING
CANCELLED
```

---

# 74. JOB IDEMPOTENCY

Scheduled/async jobs phải safe khi chạy lại.

Ví dụ:

- không gửi duplicate notification
- không export duplicate business mutation
- không post ledger twice
- không create repeated leave grant

---

# 75. JOB LOCKING

Không chạy cùng một singleton job đồng thời nếu nguy hiểm.

Ví dụ:

```text
monthly leave grant
period recompute
integration full sync
orphan cleanup
```

Dùng lock/job uniqueness.

---

# 76. FAILED JOB

Không discard.

Có:

```text
retry
error summary
correlation id
```

Nếu permanent failure:

```text
Needs attention
```

---

# 77. QUEUE DEPTH

Monitor:

```text
queued count
oldest queued age
failed count
```

Nếu backlog lớn, admin health page cảnh báo.

---

# 78. SCHEDULED TASK TIMEZONE

Jobs theo business date dùng organization timezone.

Ví dụ:

```text
daily leave expiry
project stale check
```

Không UTC midnight nếu business expects Vietnam date.

---

# 79. EXTERNAL DEPENDENCY FAILURE

Nếu email/Zalo/MISA fail:

Core business transaction vẫn phải xử lý theo consistency design.

Ví dụ:

```text
Leave approved
↓
DB commit
↓
notification provider fail
```

Không rollback leave approval chỉ vì Zalo fail.

Retry notification riêng.

---

# 80. STORAGE FAILURE DURING ATTENDANCE

Reuse Prompt 05 principles.

Attendance event không mất chỉ vì photo storage transient fail.

Health/monitoring phải thấy photo backlog.

---

# 81. DATABASE FAILURE

UI:

```text
Hệ thống tạm thời không thể truy cập dữ liệu.
Vui lòng thử lại sau.
```

Không display stack.

Offline-capable attendance vẫn local-save nếu phù hợp.

---

# 82. GRACEFUL DEGRADATION

Ví dụ:

```text
Global Search unavailable
```

không làm:

```text
Attendance unavailable
```

nếu core APIs vẫn hoạt động.

Tách dependency.

---

# 83. FEATURE DEGRADATION

Nếu integration provider down:

```text
MISA: Cần chú ý
```

nhưng hệ thống nội bộ vẫn dùng bình thường.

---

# 84. PRODUCTION ENVIRONMENT

Phân biệt rõ:

```text
development
staging
production
```

Không production dùng dev config.

---

# 85. STAGING

Staging nên:

- schema giống production
- fake/sanitized data
- integrations disabled/test
- private test storage
- separate secrets

Không copy production PII nguyên bản vào staging.

---

# 86. DATA SANITIZATION

Nếu cần clone production data để test:

- mask name if necessary
- remove CCCD
- remove bank
- remove private docs
- rotate external credentials

Không copy raw sensitive data.

---

# 87. ENVIRONMENT BADGE

Staging UI có badge:

```text
STAGING
```

để không nhầm production.

Production không cần badge lớn.

---

# 88. DEPLOYMENT PIPELINE

Trước deploy:

```text
install
lint
typecheck
unit tests
integration tests
build
migration check
```

Không deploy nếu quality gate fail.

---

# 89. CI QUALITY GATE

Minimum:

```text
lint
typecheck
test
build
```

Có thể thêm:

```text
security dependency scan
migration validation
```

---

# 90. DEPENDENCY SECURITY

Run dependency vulnerability scan theo ecosystem.

Không auto upgrade major dependency production không test.

Review critical/high vulnerabilities.

---

# 91. LOCKFILE

Commit lockfile.

Build deterministic.

Không deploy dependency versions trôi.

---

# 92. DEPLOY MIGRATIONS

Migration sequencing rõ:

```text
backup/snapshot if needed
run compatible migration
deploy app
verify
```

Nếu breaking change, expand-contract.

---

# 93. ZERO-DOWNTIME FOUNDATION

Không cần enterprise zero-downtime tuyệt đối.

Nhưng migration/app versions nên backward-compatible trong deploy window khi có thể.

---

# 94. POST-DEPLOY SMOKE TEST

Sau deploy:

Test:

```text
login
dashboard
employee list
attendance API
leave
project
warehouse inventory
shipment list
file viewer
```

Không cần manual toàn bộ nếu automation được.

---

# 95. ROLLBACK

Document:

```text
rollback app version
database migration rollback/forward-fix strategy
config rollback
```

Không assume DB migration luôn reversible.

---

# 96. FEATURE FLAGS

Feature mới/risk cao có thể:

```text
disabled by default
enable selectively
```

Không xây full feature flag SaaS.

Có simple typed flag system nếu cần.

---

# 97. MAINTENANCE MODE

Admin/system config có:

```text
Maintenance Mode
```

Behavior:

- block mutating operations nếu needed
- allow admin
- show message

Không dùng maintenance mode để che lỗi lâu dài.

---

# 98. READ-ONLY MODE — OPTIONAL FOUNDATION

Khi critical migration/incident:

```text
read-only
```

có thể hữu ích.

Không bắt buộc implement nếu stack quá lớn.

Nhưng architecture nên phân biệt mutating endpoints.

---

# 99. BACKUP STATUS UI

System Health:

```text
Backup gần nhất
09/09/2026 02:00
Thành công
```

Nếu provider API không expose:

- ghi manual/config status rõ
- không fake.

---

# 100. RESTORE STATUS

Không cần restore button trong Admin Console production.

Restore là high-risk operational process.

Chỉ document/runbook.

Không cho một admin click "Restore DB" tùy tiện.

---

# 101. AUDIT SECURITY ACTIONS

Audit:

```text
role changed
permission changed
API key created/revoked
integration secret updated
maintenance mode enabled
config changed
period unlocked
warehouse reversal
backup config changed nếu app manages
```

---

# 102. SECURITY HEADERS

Rà production headers:

```text
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
Frame protections
HSTS if HTTPS production
```

Set phù hợp app.

Không copy CSP cứng khiến camera/file features hỏng.

---

# 103. CSP

Nếu dùng camera/blob/image:

CSP phải allow đúng:

- self
- blob nếu cần
- storage signed domain nếu needed

Không `script-src * 'unsafe-eval'` production nếu tránh được.

---

# 104. CLICKJACKING

Admin/internal app không cần iframe public.

Set:

```text
frame-ancestors 'none'
```

hoặc allowed domain nếu có legitimate embedding.

---

# 105. CACHE CONTROL

Sensitive pages/API/files:

```text
private
no-store
```

khi appropriate.

Static assets:

```text
long cache + hash
```

Không cache employee private API public CDN.

---

# 106. PII IN URL

Không đưa:

```text
CCCD
phone
reason leave
```

vào URL/query nếu không cần.

Entity IDs okay.

---

# 107. PII IN LOG

Redact:

```text
CCCD
bank
tax
insurance
full document content
authorization headers
API keys
password
```

Phone/email có thể mask trong logs nếu không cần full.

---

# 108. PRIVACY RETENTION

Define retention placeholder cho:

- attendance selfies
- expired documents
- export files
- notification history
- integration payload logs

Không tự đặt legal retention nếu business chưa xác nhận.

Admin config/runbook phải ghi "cần xác nhận policy" nếu chưa chốt.

---

# 109. DATA DELETION

Employee leaving:

- disable account
- retain business records theo policy
- không cascade delete attendance/timesheet/project history

Nếu có legal deletion request future, cần specialized process.

Không implement "Delete employee and everything".

---

# 110. SECURITY TESTS

Bắt buộc test:

- unauthorized employee detail
- unauthorized photo
- unauthorized document
- warehouse scope
- shipment scope
- approval scope
- audit scope
- API key scope
- revoked API key
- CSRF if applicable
- XSS payload sanitized
- malicious upload rejected
- SSRF webhook blocked
- sensitive DTO filtered

---

# 111. AUTH TESTS

- disabled account cannot use session
- session expiry
- logout invalidation
- brute-force/rate limit
- admin lockout protection from Prompt 03 remains valid

---

# 112. FILE TESTS

- valid photo
- oversized photo
- spoofed MIME
- executable rename as PDF
- unauthorized signed route
- expired signed URL
- private thumbnail access
- orphan detection

---

# 113. BACKUP/RESTORE TESTS

Document and, where possible, execute:

- backup exists
- restore DB in non-production
- file restore/sample access
- application boots
- key business records verified

---

# 114. DATABASE TESTS

- critical unique constraints
- foreign keys
- posting transaction rollback
- race negative stock
- timesheet lock
- idempotency
- query performance for realistic data

---

# 115. LOAD/PERFORMANCE TESTS

Không cần huge enterprise benchmark.

Test realistic:

```text
employees: hundreds/thousands
attendance events: large monthly volume
photos metadata: high volume
warehouse ledger: tens/hundreds thousands
audit logs: high volume
```

Measure:

- list load
- filter
- export job
- dashboard
- search

---

# 116. MOBILE NETWORK TESTS

Re-test:

- attendance offline
- worker attendance offline
- project update draft
- reconnect
- app refresh
- failed photo upload

Hardening không được phá offline behavior.

---

# 117. OBSERVABILITY TESTS

Simulate:

```text
API 500
DB unavailable
storage fail
webhook fail
background job fail
```

Verify:

- logs
- error tracking
- admin health
- user-facing message
- retry where appropriate

---

# 118. SYSTEM HEALTH ROUTE

Routes:

```text
/system-admin/system-health
/system-admin/jobs
/system-admin/integration-health
```

Nếu Prompt 12/13 đã có route tương tự, reuse.

Không duplicate.

---

# 119. SYSTEM HEALTH UI

Sections:

```text
Ứng dụng
Database
Storage
Background Jobs
Integrations
Backups
```

Ví dụ:

```text
Database
Healthy
Latency: 48 ms
Checked: 16:20
```

Không show credential/host secret.

---

# 120. INCIDENT NOTICE

Admin có thể dùng System Notice Prompt 12.

Nếu hệ thống degraded:

```text
Một số chức năng tải ảnh đang chậm.
```

Không tự show technical message.

---

# 121. OPERATIONAL RUNBOOK

Tạo file docs:

```text
docs/operations/production-runbook.md
```

Bao gồm:

```text
Deploy
Rollback
Migration
Backup
Restore
Secret rotation
Incident handling
Job retry
Integration troubleshooting
Storage cleanup
User/account emergency disable
```

---

# 122. SECURITY RUNBOOK

Tạo:

```text
docs/operations/security-runbook.md
```

Bao gồm:

```text
API key leaked
User account compromised
Integration secret leaked
Unexpected data exposure
Unauthorized export
```

Không viết chung chung.

Ghi step theo actual stack.

---

# 123. BACKUP RUNBOOK

Tạo:

```text
docs/operations/backup-restore.md
```

Bao gồm:

```text
What is backed up
Where
Frequency
Retention
How to verify
How to restore staging
How to restore production
RPO
RTO
Last restore drill
```

Nếu một mục chưa có provider capability, ghi rõ.

---

# 124. DEPLOYMENT RUNBOOK

Tạo:

```text
docs/operations/deployment.md
```

Bao gồm:

```text
Pre-deploy
Migration
Deploy
Smoke tests
Rollback
Post-deploy monitoring
```

---

# 125. ENVIRONMENT DOCUMENTATION

Tạo:

```text
docs/operations/environments.md
```

Ghi:

- local
- staging
- production
- required env vars
- no real secrets

---

# 126. ERROR CATALOG

Có thể tạo:

```text
docs/operations/error-codes.md
```

Cho business/system error codes.

Ví dụ:

```text
ATTENDANCE_OUTSIDE_GEOFENCE
WAREHOUSE_INSUFFICIENT_STOCK
APPROVAL_ALREADY_PROCESSED
INTEGRATION_AUTH_FAILED
```

Không expose internal exception class.

---

# 127. DATABASE RUNBOOK

Tạo:

```text
docs/operations/database.md
```

Ghi:

- connection strategy
- migration
- indexing
- backups
- restore
- maintenance
- reconciliation jobs

---

# 128. STORAGE RUNBOOK

Tạo:

```text
docs/operations/storage.md
```

Ghi:

- private buckets/containers
- file categories
- signed access
- retention
- cleanup
- restore

---

# 129. FEATURE READINESS MATRIX

Tạo checklist status cho module:

```text
HR
Attendance
Worker Attendance
Leave
Timesheet
Project
Warehouse
XNK
Approval
Documents
Integrations
```

Columns:

```text
Build
Tests
Permissions
Audit
Monitoring
Backup impact
Mobile
Production-ready
```

Không giả pass nếu chưa test.

---

# 130. SECURITY CHECKLIST

Tạo checklist:

```text
Auth
RBAC
IDOR
Sensitive DTO
CSRF
CORS
XSS
Uploads
Storage
Secrets
API keys
Webhook SSRF
Logs
Exports
```

Mỗi item:

```text
PASS
FAIL
NOT_APPLICABLE
NEEDS_ACTION
```

---

# 131. PRODUCTION READINESS CHECKLIST

Trước go-live:

```text
Production env configured
DB backup verified
Storage private
Admin account protected
SMTP/provider optional configured
Domain/HTTPS
Migrations applied
Seed data reviewed
Demo data removed
Permissions reviewed
Error tracking active
Health checks active
Logs active
Smoke tests passed
Restore runbook exists
```

---

# 132. DEMO DATA

Không để production có:

```text
John Doe
Test User
Fake Project
Fake Warehouse
```

trừ dữ liệu test clearly isolated.

Seed chỉ:

- default config
- roles/permissions
- required system reference data

---

# 133. SUPER ADMIN SAFETY

Review Prompt 03 safeguards:

- không xóa last admin
- không revoke all admin permissions accidentally
- audit admin changes

Có break-glass recovery process documented.

---

# 134. BREAK-GLASS ADMIN

Nếu all admin accounts locked:

Có documented recovery path through secure server/provider procedure.

Không tạo hidden universal password.

---

# 135. CONFIG BACKUP

Ngoài DB backup, config/history đã trong DB.

Nếu deployment config/env critical:

- document separately
- secrets backup securely through provider/process

Không store secrets in Git.

---

# 136. DOMAIN RECONCILIATION JOBS

Có health/reconciliation cho critical derived data:

```text
Warehouse ledger ↔ balance
Leave ledger ↔ balance
Timesheet locked snapshot consistency
Shipment received summary ↔ warehouse receipts
File metadata ↔ storage object
```

Không silently auto-correct everything.

---

# 137. RECONCILIATION UI

Admin:

```text
System Health > Data Integrity
```

Show:

```text
Warehouse balances: OK
Leave balances: OK
Shipment receiving: 2 warnings
Files: 3 orphan candidates
```

Manual inspect.

---

# 138. REPAIR ACTIONS

Nếu có repair:

- permission cao
- dry-run
- reason
- audit
- no hidden fix

Không expose raw SQL console.

---

# 139. LOCKED BUSINESS RECORD INTEGRITY

Review:

```text
Posted warehouse docs
Locked timesheets
Approved leave
Completed shipment
Submitted worker attendance
```

Không normal API edit.

---

# 140. CLOCK/TIME CONSISTENCY

Review all timestamps:

```text
created_at UTC
business timezone display
effective date
client capture time
server receive time
```

Không mix timezone naive.

---

# 141. SERVER CLOCK

Server/provider clock source assumed trusted.

Do not use client for authoritative server operations.

Offline captured_at remains separate.

---

# 142. UUID/ID STRATEGY

Review:

- internal primary IDs
- human codes
- client-generated idempotency IDs

Không expose sequential IDs if security-by-obscurity expected—but authorization remains primary.

---

# 143. ERROR HANDLING CONSISTENCY

Central error mapping.

Examples:

```text
VALIDATION_ERROR
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
TEMPORARY_UNAVAILABLE
```

Frontend maps to Vietnamese message.

---

# 144. RETRY CONSISTENCY

Không retry blindly:

```text
validation errors
403
business conflicts
```

Retry:

```text
network
timeout
5xx transient
429
```

---

# 145. USER FEEDBACK FOR DEGRADED STATE

Examples:

```text
Ảnh đang chờ đồng bộ.
```

```text
Không thể tải tài liệu lúc này.
```

```text
Tích hợp MISA đang tạm gián đoạn. Dữ liệu nội bộ vẫn được lưu.
```

Không raw technical error.

---

# 146. MAINTENANCE WINDOW

Nếu deploy/migration cần downtime:

- system notice
- scheduled window
- prevent writes
- verify jobs stopped safely
- deploy
- verify
- resume

Document.

---

# 147. JOB DRAINING

Trước risky deploy:

- wait/stop workers appropriately
- ensure no half-finished stock posting/import
- job retry safe

Không kill transaction mid-flight.

---

# 148. FILE EXPORT CLEANUP

Generated Excel/PDF exports:

- retain N days configurable
- stable report metadata remains
- user can regenerate if source locked/stable

Không giữ unlimited large files.

---

# 149. BACKUP OF EXPORTS

Không cần backup generated exports nếu reproducible.

Business source + template/version mới là quan trọng.

Nếu signed official artifact cần retention future, policy riêng.

---

# 150. FRONTEND SOURCE MAP

Production source map:

- upload privately to error tracker if needed
- không expose public source map nếu security concern

Theo framework/build setup.

---

# 151. CSP REPORTING — OPTIONAL

Nếu CSP provider/report endpoint có:

- monitor violations
- avoid noisy false positives

Không bắt buộc.

---

# 152. DEPENDENCY FAILURE UI

Nếu third-party font/CDN fail:

App vẫn usable.

Ưu tiên local/system font hoặc robust loading.

Không để external UI CDN là single point of failure.

---

# 153. STATIC ASSET HOSTING

Versioned hashed assets.

Do not cache HTML indefinitely if deployment needs fresh bundle references.

---

# 154. DATABASE POOL HEALTH

Health page có thể show:

```text
connection status
latency
```

Không show password/connection string.

---

# 155. STORAGE HEALTH

Health check nên test lightweight:

- provider reachable
- optional list/head known object

Không upload file mỗi few seconds.

---

# 156. BACKGROUND QUEUE HEALTH

Show:

```text
Oldest queued job
Failed last 24h
Retrying
```

---

# 157. WEBHOOK HEALTH

Reuse Prompt 13 delivery data.

Show:

```text
Failed deliveries
Consecutive failures
Disabled endpoints
```

---

# 158. INTEGRATION HEALTH

Reuse Integration Registry.

Không duplicate new health DB.

---

# 159. ALERTING — FOUNDATION

Nếu provider supports:

Alert critical:

```text
app down
DB unavailable
backup failed
queue stuck
error spike
storage near limit
```

Destination:

- email/Slack/Zalo future

Không implement provider giả.

---

# 160. ALERT FATIGUE

Không alert mỗi 500.

Aggregate/rate limit.

Severity thresholds.

---

# 161. ERROR SPIKE

Detect:

```text
same error count increased
5xx rate threshold
```

Nếu no monitoring provider, at least structured metrics/log queries.

---

# 162. PERFORMANCE BUDGET

Set reasonable targets, not absolute unrealistic SLA.

Examples:

```text
common list API under ~500ms typical
interactive navigation feels fast
photo upload background
large Excel async
```

Measure with actual environment.

---

# 163. DATABASE VOLUME ESTIMATE

Document approximate growth drivers:

```text
Employees
Attendance events/day
Photos/day
Worker attendance photos/day
Audit events/day
Warehouse transactions/month
Shipment docs/month
```

Use this to estimate storage.

Không invent company volume; derive from config/test assumptions and state assumptions clearly.

---

# 164. CAPACITY WARNING

Health/config can show storage/db near provider quota if provider API exposes.

Không fake quota if unavailable.

---

# 165. SECURITY REVIEW OF EXPORTS

Excel/PDF:

- formula injection protection for user text beginning `=`, `+`, `-`, `@`
- sanitize filenames
- permission before generation/download
- private generated file
- retention

Đây là bắt buộc.

---

# 166. EXCEL FORMULA INJECTION

Nếu user-entered reason/note:

```text
=HYPERLINK(...)
```

không được trở thành executable formula trong export.

Escape/store as text.

Hyperlinks system-generated only.

---

# 167. CSV INJECTION

Nếu CSV export future:

protect formula-leading cells.

---

# 168. PDF SECURITY

PDF generator:

- no external URL fetch uncontrolled
- no arbitrary HTML/script
- private download
- correct fonts
- no secret metadata

---

# 169. SEARCH HARDENING

Search query:

- max length
- rate limit if needed
- parameterized
- permission
- no regex DoS if regex unsupported

---

# 170. AUDIT LOG HARDENING

Audit before/after:

- cap payload size
- redact secrets
- structured field diff
- append-only

Không store uploaded file binary/base64.

---

# 171. NOTIFICATION HARDENING

Notification content from user data must be escaped.

No raw HTML injection.

Deep link whitelist/internal route.

---

# 172. SYSTEM NOTICE HARDENING

No arbitrary HTML/JS.

Plain text/rich text sanitized.

---

# 173. ADMIN CONSOLE HARDENING

Critical actions require:

- confirm
- re-auth optional for highly sensitive if architecture supports
- reason where appropriate
- audit

Examples:

```text
revoke API key
disable module
unlock timesheet
reverse warehouse doc
change security config
```

---

# 174. DANGEROUS CONFIG WARNING

If admin disables:

```text
attendance
warehouse
integration
```

show impact.

Do not delete data.

---

# 175. DB ROW-LEVEL SECURITY

If using Supabase/RLS or similar:

Review all tables.

Do not assume app-layer authorization alone if frontend can directly call DB APIs.

If using server-only DB access, document that architecture.

If Supabase client direct access exists, RLS is mandatory and must be tested.

---

# 176. SUPABASE-SPECIFIC REVIEW IF APPLICABLE

If project actually uses Supabase:

- RLS policies
- anon key safe usage
- service role server-only
- storage policies
- signed URLs
- connection pooling
- backups/PITR plan
- auth sessions

Do not force Supabase-specific code if current stack changed.

---

# 177. VERCEL-SPECIFIC REVIEW IF APPLICABLE

If deployed on Vercel:

Review:

- function timeout
- serverless concurrency
- cron limits
- file system ephemeral
- environment variables
- region relative DB
- background job strategy
- large export strategy

Do not write files assuming persistent local disk.

---

# 178. LOCAL FILE SYSTEM

Production serverless:

Do not use local filesystem as durable storage.

Temporary files only.

Business files → object storage.

---

# 179. EXPORT JOB SERVERLESS

Large Excel:

- background worker/provider suitable
- or bounded generation

Do not rely on request beyond platform timeout.

---

# 180. CRON SAFETY

If platform cron:

- authenticated cron endpoint
- idempotent
- lock
- logs

No public unauthenticated maintenance route.

---

# 181. HEALTH ENDPOINT SECURITY

Basic health can be public-safe.

Detailed health:

```text
/system-admin/system-health
```

permission-protected.

---

# 182. DIAGNOSTIC ENDPOINTS

No production endpoint exposing:

```text
env
db tables
stack
memory dump
```

---

# 183. DEBUG TOOLS

Disable debug/admin dev tools production.

No Prisma Studio/database console public.

---

# 184. SOURCE CONTROL

Ensure:

```text
.env
dumps
secrets
private certificates
```

in `.gitignore`.

Run secret scan if available.

---

# 185. COMMIT HISTORY SECRET

If secret previously committed, removing current file is insufficient.

Runbook must state:

```text
rotate leaked secret
```

Git history cleanup optional separately.

---

# 186. FINAL E2E CRITICAL FLOWS

Test end-to-end:

```text
HR creates employee
↓
account provisioned
↓
employee login
↓
self attendance
↓
leave request
↓
approval
↓
timesheet
↓
lock
↓
Excel export
```

---

# 187. E2E WORKER FLOW

```text
Create project/worksite
↓
assign workers/supervisor
↓
supervisor attendance offline
↓
sync
↓
timesheet
```

---

# 188. E2E WAREHOUSE/XNK FLOW

```text
Create item
↓
import contract
↓
shipment
↓
partial warehouse receipt
↓
post
↓
inventory increases
↓
second receipt
↓
shipment received
```

---

# 189. E2E PROJECT FLOW

```text
Project
↓
attendance
↓
project update
↓
issue
↓
management dashboard
↓
resolve issue
```

---

# 190. E2E SECURITY FLOW

```text
User without permission
↓
direct URL
↓
403
```

Test for all critical domains.

---

# 191. PRODUCTION SMOKE TEST SCRIPT

Tạo automated or documented smoke suite.

Không mutate dangerous production data nếu automation runs post-deploy.

Use read-only checks + isolated test entity if needed.

---

# 192. TEST DATA FACTORY

Tests dùng factories/fixtures.

Không phụ thuộc production-like hard-coded IDs.

---

# 193. MIGRATION TEST DATABASE

CI should apply migrations from clean DB.

Nếu possible:

```text
empty DB
↓
all migrations
↓
seed
↓
tests
```

Catches broken migration order.

---

# 194. RESTORE COMPATIBILITY

Restored DB schema/version phải compatible with app version.

Runbook must map backup timestamp to deploy/migration version if needed.

---

# 195. DEPLOY RELEASE IDENTIFIER

Expose internally:

```text
release version / git commit
```

trong health/admin page.

Không cần public.

Giúp trace bug.

---

# 196. CHANGELOG

Maintain internal release notes:

```text
Added
Changed
Fixed
Migration notes
Operational notes
```

Không cần public marketing changelog.

---

# 197. RELEASE CHECKLIST

Mỗi release:

```text
Tests pass
Migration reviewed
Backup checked
Secrets unchanged/updated
Config impact
Smoke test
Monitoring after deploy
```

---

# 198. INCIDENT LOG — FOUNDATION

Tạo simple internal doc/process:

```text
Incident
Start
Impact
Root cause
Resolution
Preventive action
```

Không cần build incident management module.

---

# 199. POSTMORTEM

For major outage/data issue:

- timeline
- root cause
- what prevented detection
- corrective actions

No blame-oriented language.

---

# 200. ACCEPTANCE CRITERIA

## Security

- [ ] Authentication hardened.
- [ ] Session security reviewed.
- [ ] Server-side authorization on all critical routes.
- [ ] IDOR tests pass.
- [ ] Field-level sensitive filtering.
- [ ] CSRF/CORS reviewed.
- [ ] XSS sanitization.
- [ ] File upload hardened.
- [ ] Private storage verified.
- [ ] Secrets server-only.
- [ ] Webhook SSRF protections retained.
- [ ] Export formula injection protected.
- [ ] No production debug exposure.

## Backup / Restore

- [ ] DB backup strategy documented.
- [ ] File/object backup strategy documented.
- [ ] Retention defined.
- [ ] Encryption/access control.
- [ ] Restore runbook.
- [ ] Restore test/drill completed where technically possible.
- [ ] RPO/RTO documented based on real capability.

## Database

- [ ] Connection pooling reviewed.
- [ ] Critical indexes reviewed.
- [ ] Constraints reviewed.
- [ ] Migrations safe.
- [ ] Reconciliation jobs for critical derived data.
- [ ] No direct durable local filesystem reliance.

## Monitoring

- [ ] Health endpoint.
- [ ] Detailed Admin System Health.
- [ ] Structured logs.
- [ ] Request/correlation IDs.
- [ ] Error tracking.
- [ ] Job monitoring.
- [ ] Integration health.
- [ ] Storage monitoring foundation.
- [ ] Alerting hooks.

## Production

- [ ] Dev/staging/prod separated.
- [ ] CI quality gates.
- [ ] Deployment runbook.
- [ ] Rollback strategy.
- [ ] Post-deploy smoke tests.
- [ ] Demo data removed.
- [ ] Environment secrets reviewed.
- [ ] Release identifier available.

## Operational Documentation

- [ ] production-runbook.md
- [ ] security-runbook.md
- [ ] backup-restore.md
- [ ] deployment.md
- [ ] environments.md
- [ ] database.md
- [ ] storage.md
- [ ] error-codes.md where useful
- [ ] production readiness matrix

## End-to-End

- [ ] HR → attendance → leave → timesheet → Excel.
- [ ] Project → worker attendance → timesheet.
- [ ] XNK → Warehouse → Inventory.
- [ ] Project update → management dashboard.
- [ ] Permission direct-URL tests.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Unit tests pass.
- [ ] Integration tests pass.
- [ ] E2E critical tests pass.
- [ ] Production build pass.
- [ ] Security review pass.
- [ ] Performance review pass.

---

# 201. THỨ TỰ TRIỂN KHAI

1. Inspect toàn bộ architecture/deployment hiện tại.
2. Liệt kê actual stack/provider trước khi hard-code giải pháp.
3. Security review auth/session.
4. Authorization/IDOR review.
5. Sensitive DTO review.
6. Upload/storage security review.
7. Secrets/env review.
8. Security headers/CORS/CSRF/XSS.
9. Database constraints/index/query review.
10. Connection pooling review.
11. Migration/deployment review.
12. Backup strategy.
13. Object storage backup strategy.
14. Restore runbook + staging restore drill.
15. Structured logging.
16. Request/correlation IDs.
17. Error tracking.
18. Health/readiness.
19. System Health Admin page.
20. Job/queue monitoring.
21. Reconciliation jobs.
22. Storage lifecycle/orphan checks.
23. Environment separation.
24. CI/CD quality gates.
25. Rollback/smoke tests.
26. Operational documentation.
27. Full E2E regression.
28. Security tests.
29. Performance tests.
30. Production readiness matrix.
31. Lint/typecheck/test/build.
32. Final report.

---

# 202. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo chính xác:

## Actual infrastructure

- frontend host
- backend runtime
- database
- auth
- object storage
- background jobs
- monitoring/error tracking
- backup capability

Không đoán.

## Security findings

Mỗi finding:

```text
Severity
Problem
Fix implemented
Remaining risk
```

## Backup / Restore

- DB backup
- storage backup
- retention
- last restore test
- RPO
- RTO

## Observability

- health
- logs
- errors
- jobs
- integrations
- alerts

## Database

- indexes added
- constraints added
- slow queries fixed
- reconciliation jobs

## Deployment

- CI checks
- migrations
- rollback
- smoke tests

## Documentation

Liệt kê các runbook đã tạo.

## Tests

- unit
- integration
- E2E
- security
- performance
- restore drill

## Remaining production blockers

Nếu còn blocker, ghi thẳng.

Không báo `Production Ready` nếu vẫn còn vấn đề critical/high chưa xử lý.

---

# 203. QUY TẮC CUỐI

Không tuyên bố production-ready chỉ vì build pass.

Không assume provider đã backup nếu chưa kiểm tra.

Không coi backup thành công nếu chưa có restore procedure.

Không public file/tài liệu nhạy cảm.

Không log secret/PII nhạy cảm.

Không expose debug stack production.

Không cho browser/client giữ service-role secret.

Không bypass server authorization.

Không sửa dữ liệu derived critical bằng tay khi có reconciliation/service.

Không làm production migration destructive không có plan.

Không cho cron/job chạy trùng gây duplicate business transaction.

Không để external dependency failure rollback core transaction không cần thiết.

Không tạo fake monitoring/backup status.

Không tạo nút restore database trong Admin Console thông thường.

Không tạo hidden backdoor admin.

**Dừng sau khi toàn hệ thống đã được harden, backup/restore và observability đã có quy trình rõ, các critical E2E/security tests pass, production-readiness matrix hoàn thành và báo cáo trung thực các blocker còn lại.**
