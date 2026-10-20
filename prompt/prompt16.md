# PROMPT 16 — FINAL QA / UAT / GO-LIVE: KIỂM THỬ TOÀN BỘ NGHIỆP VỤ, MIGRATION DỮ LIỆU BAN ĐẦU, NGHIỆM THU VÀ ĐƯA HỆ THỐNG VÀO VẬN HÀNH THẬT

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã triển khai hoặc xác lập gần như toàn bộ nền tảng và nghiệp vụ:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- Nhân sự
- User Account / RBAC
- Admin Console / Branding
- chấm công cá nhân
- Project / Worksite
- phân công và điểm danh công nhân
- nghỉ phép / phê duyệt / phép năm / PDF
- ca làm / bảng công / khóa kỳ / Excel
- cập nhật dự án / issue / dashboard
- Kho
- Xuất nhập khẩu
- Approval Center
- Notification Center
- Document Center
- Audit Log
- Business Configuration
- API / Webhook / Integration Platform
- Dashboard / Search / Command Center
- Security / Backup / Monitoring / Production Readiness

Prompt này là **bước cuối trước khi đưa hệ thống vào vận hành thật**.

Mục tiêu không phải thêm tính năng mới.

Mục tiêu là:

```text
Kiểm thử đúng nghiệp vụ
↓
Kiểm thử đúng quyền
↓
Kiểm thử đúng dữ liệu
↓
Chuẩn bị dữ liệu thật
↓
Migration
↓
Đào tạo
↓
Pilot
↓
Nghiệm thu
↓
Go-live
↓
Theo dõi sau go-live
```

Không được coi hệ thống hoàn thành chỉ vì:

```text
build pass
```

hoặc:

```text
developer test thấy chạy
```

Phải có UAT theo từng nhóm người dùng thật.

---

# 1. MỤC TIÊU

Hoàn thiện toàn bộ quy trình go-live gồm:

1. Final QA.
2. Regression testing.
3. User Acceptance Testing.
4. Test theo role/permission.
5. Test desktop.
6. Test mobile.
7. Test offline.
8. Test dữ liệu lớn.
9. Test dữ liệu lịch sử.
10. Test business edge cases.
11. Chuẩn bị master data.
12. Migration nhân sự.
13. Migration phép năm.
14. Migration tồn kho.
15. Migration project đang chạy nếu cần.
16. Migration XNK đang theo dõi nếu cần.
17. Mapping dữ liệu cũ.
18. Validation dữ liệu migration.
19. Reconciliation sau migration.
20. Training tài khoản thử.
21. Tài liệu hướng dẫn sử dụng.
22. Pilot.
23. Parallel run nếu cần.
24. Go-live checklist.
25. Cutover plan.
26. Rollback plan.
27. Support sau go-live.
28. Nghiệm thu.
29. Final sign-off.
30. Backlog V2 sau go-live.

---

# 2. NGUYÊN TẮC

Không migration dữ liệu bằng cách:

```text
import Excel trực tiếp vào DB
```

mà không:

- mapping
- validation
- preview
- error report
- reconciliation

Không đưa toàn công ty vào hệ thống cùng lúc nếu pilot nhỏ có thể giảm rủi ro.

Không thay hệ thống/quy trình cũ ngay lập tức nếu chưa xác nhận dữ liệu mới chính xác.

Không dùng dữ liệu demo làm dữ liệu thật.

---

# 3. QA MATRIX

Tạo tài liệu:

```text
docs/qa/qa-matrix.md
```

Mỗi module có:

```text
Feature
Scenario
Role
Platform
Expected Result
Actual Result
Status
Evidence
Bug ID
```

Status:

```text
PASS
FAIL
BLOCKED
NOT_APPLICABLE
```

Không dùng:

```text
seems okay
```

---

# 4. TEST ROLE MATRIX

Bắt buộc test tối thiểu theo các nhóm:

```text
Nhân viên
Giám sát
HR
Trưởng bộ phận / Approver
Project Manager
Kho
Xuất nhập khẩu
Quản lý / Ban giám đốc
System Admin
User hạn chế quyền
```

Nếu actual role khác, map theo permission thực tế.

Không hard-code role name nếu system dùng khác.

---

# 5. PERMISSION TESTING

Mỗi role test:

```text
Có thể xem gì?
Có thể tạo gì?
Có thể sửa gì?
Có thể duyệt gì?
Có thể export gì?
Không được xem gì?
```

Đặc biệt test direct URL.

Ví dụ:

```text
User không có employee.sensitive
↓
direct URL hồ sơ nhạy cảm
↓
403
```

---

# 6. NEGATIVE TEST

Không chỉ test happy path.

Phải test:

```text
Thiếu quyền
Sai dữ liệu
Duplicate
Out of range
Network fail
Storage fail
Double click
Session expired
Concurrent update
Locked record
Inactive master data
```

---

# 7. DESKTOP QA

Test tối thiểu:

```text
1366×768
1440×900
1920×1080
```

Không cần pixel-perfect mọi màn hình, nhưng phải kiểm tra:

- table
- filters
- forms
- drawers
- modals
- sticky header
- overflow
- long Vietnamese text
- print/export actions

---

# 8. MOBILE QA

Test viewport:

```text
360px
390px
430px
```

Ưu tiên thiết bị thực nếu có.

Test:

- attendance camera
- GPS
- offline
- worker attendance
- leave
- approval
- project updates
- notification
- search

Không chỉ Chrome desktop responsive emulator.

---

# 9. BROWSER QA

Tối thiểu:

```text
Chrome latest
Edge latest
Safari iOS nếu nhân viên dùng iPhone
Chrome Android nếu nhân viên dùng Android
```

Không cần support browser cũ không còn dùng nếu không có yêu cầu.

Ghi browser support chính thức.

---

# 10. LOGIN QA

Test:

- correct credentials
- wrong password
- disabled account
- logout
- session expiry
- refresh
- direct route after login
- redirect back after authentication
- account permission changed while logged in

---

# 11. EMPLOYEE PROFILE UAT

Test:

```text
HR tạo nhân viên
↓
Mã nhân viên unique
↓
Cập nhật hồ sơ
↓
Hợp đồng
↓
Tài liệu
↓
Lịch sử công tác
↓
Cấp tài khoản
↓
Disable account
↓
History retained
```

---

# 12. SENSITIVE HR DATA

Test user không quyền:

- không thấy CCCD
- không thấy ngân hàng
- không thấy BHXH/MST nếu policy
- export basic không chứa sensitive
- API không trả field

Không chỉ check UI.

---

# 13. CHẤM CÔNG CÁ NHÂN UAT

Happy path:

```text
Login mobile
↓
Chấm vào
↓
Camera
↓
GPS
↓
Preview
↓
Submit
↓
Success
↓
HR thấy event + ảnh
```

---

# 14. CHẤM CÔNG OFFLINE UAT

Test thực tế:

```text
Bật airplane mode / mất Internet
↓
Chấm công
↓
Ảnh lưu local
↓
Pending sync
↓
Đóng browser
↓
Mở lại
↓
Kết nối mạng
↓
Sync
↓
Không duplicate
```

Đây là UAT bắt buộc.

---

# 15. ATTENDANCE EDGE CASES

Test:

- camera denied
- GPS denied
- GPS accuracy kém
- outside geofence
- double tap
- image upload fail
- session expired
- account switch with pending queue
- duplicate retry
- missing check-out

---

# 16. WORKER ATTENDANCE UAT

Flow:

```text
Project có 20 công nhân
↓
Giám sát mở roster
↓
Chọn tất cả có mặt
↓
Mark 2 vắng
↓
Thêm 1 worker phát sinh
↓
Chụp 3 ảnh
↓
Submit
↓
HR thấy 1 session + 21 entries + 3 photos
```

Không được tạo 63 file photo references trên 21 workers.

---

# 17. WORKER ATTENDANCE OFFLINE

Test:

- cached roster
- offline
- mark attendance
- capture photos
- refresh browser
- resume draft
- reconnect
- sync once

---

# 18. LEAVE UAT

Test:

```text
Employee tạo đơn
↓
Số ngày đúng
↓
Balance preview đúng
↓
Submit
↓
Manager approve
↓
HR approve nếu workflow
↓
Balance deduct đúng 1 lần
↓
PDF export đúng
↓
Timesheet nhận approved leave
```

---

# 19. LEAVE PDF UAT

Kiểm tra bằng mắt:

- A4
- logo
- tiếng Việt
- long reason
- status
- approval timeline
- print
- no cutoff
- historical snapshot

Không chỉ automated test.

---

# 20. LEAVE BALANCE RECONCILIATION

Sau test:

```text
Opening
+ Carryover
+ Adjustments
- Approved Usage
= Remaining
```

So với UI.

Không chấp nhận lệch 0.5 ngày.

---

# 21. TIMESHEET UAT

Test ít nhất một kỳ có:

- đúng giờ
- trễ
- về sớm
- thiếu check-in
- thiếu check-out
- leave
- half-day leave
- worker attendance
- manual adjustment
- conflict

---

# 22. TIMESHEET LOCK UAT

Flow:

```text
Review
↓
Lock
↓
Try edit
↓
Denied
↓
Unlock with reason
↓
Adjust
↓
Recompute
↓
Relock
↓
Version 2
```

Version 1 vẫn xem/trace được theo design.

---

# 23. EXCEL UAT

Mở file thực bằng Excel/LibreOffice nếu phù hợp để kiểm tra format.

Test:

- sheet names
- columns
- filter
- freeze
- Vietnamese
- dates
- numbers
- long notes
- hyperlinks
- permissions
- no formula injection

---

# 24. PHOTO LINK EXCEL UAT

Flow:

```text
HR đã login
↓
Mở Excel
↓
Click "Xem ảnh"
↓
Browser mở đúng ảnh
```

Không confirmation thừa.

Nếu session hết:

```text
Login
↓
redirect lại đúng ảnh
```

---

# 25. PROJECT UAT

Flow:

```text
Create project
↓
Create worksite
↓
Assign supervisor/workers
↓
Daily roster
↓
Attendance
↓
Project update
↓
Create issue
↓
Management dashboard
↓
Resolve issue
```

---

# 26. WAREHOUSE UAT

Flow:

```text
Create item
↓
Create warehouse
↓
Receipt 100
↓
Post
↓
Inventory = 100
↓
Issue 30
↓
Inventory = 70
↓
Transfer 20
↓
Source/destination correct
↓
Stock count
↓
Variance adjustment
```

---

# 27. WAREHOUSE CONCURRENCY UAT

Nếu có thể simulate:

```text
On hand 10

User A issue 8
User B issue 5
```

Một trong hai phải fail nếu negative inventory disabled.

Không để tồn = -3.

---

# 28. XNK UAT

Flow:

```text
Supplier
↓
Contract
↓
Shipment
↓
ETA changes
↓
Documents
↓
Customs
↓
Create warehouse receipt 60/100
↓
Post
↓
Shipment received = 60
↓
Second receipt 40
↓
Shipment received = 100
```

---

# 29. XNK REVERSE UAT

Reverse receipt đầu:

```text
100 received
↓
reverse 60 receipt
↓
received summary = 40
```

Nếu logic design khác hợp lệ, expected theo domain service.

Không cache sai.

---

# 30. APPROVAL CENTER UAT

Test:

- Leave xuất hiện.
- Adjustment xuất hiện.
- Approver đúng.
- User khác không thấy.
- Reassign.
- Delegation nếu enabled.
- Approved item chuyển Completed.
- Notification đúng.

---

# 31. DOCUMENT CENTER UAT

Test:

- private employee doc
- project doc
- shipment doc
- company-wide doc
- version replace
- direct URL permission
- stable link
- archive

---

# 32. AUDIT UAT

Chọn một business scenario:

```text
HR chỉnh hồ sơ
Manager approve leave
Warehouse post receipt
XNK đổi ETA
Admin đổi permission
```

Audit phải trả lời được:

```text
Ai
Khi nào
Cái gì
Trước/sau
Lý do
```

---

# 33. GLOBAL SEARCH UAT

Search:

```text
Employee code
Project
Item code
Receipt No
Shipment No
BL No
Document
```

Permission filter đúng.

Không trả CCCD.

---

# 34. DASHBOARD UAT

Mỗi user type login.

Verify:

- default landing
- My Work
- widgets đúng
- không widget trái quyền
- deep links đúng
- no fake data

---

# 35. INTEGRATION PLATFORM UAT

Không cần tích hợp thật provider chưa có.

Test foundation:

- API key
- scope
- webhook
- signature
- retry
- manual retry
- integration disabled
- log
- secret redaction

---

# 36. BACKUP/RESTORE UAT

Reuse Prompt 15.

Trước go-live phải có evidence:

```text
Backup configured
Restore procedure exists
Restore test completed where possible
```

Nếu chưa có restore test:

```text
GO-LIVE BLOCKER
```

trừ khi management explicitly accepts risk.

---

# 37. DATA MIGRATION — MỤC TIÊU

Dữ liệu đầu vào có thể đến từ:

```text
Excel
Google Sheets
Hệ thống cũ
CSV
Manual records
```

Không migration blind.

Mỗi loại data có migration plan riêng.

---

# 38. MIGRATION INVENTORY

Tạo:

```text
docs/migration/data-inventory.md
```

Liệt kê:

```text
Nguồn dữ liệu
File/system
Owner
Rows
Fields
Quality
Destination module
Required?
Migration method
```

---

# 39. MASTER DATA MIGRATION ORDER

Thứ tự gợi ý:

```text
Organization
Departments
Positions
Employee types
Shifts
Locations
Leave types
Warehouses
Item categories
UOM
Items
Partners
Projects/Worksites
```

Sau đó mới transaction/history.

Không import transaction trước master.

---

# 40. EMPLOYEE MIGRATION

Map:

```text
Mã NV
Tên
DOB
Phone
Email
Department
Position
Start date
Status
...
```

Sensitive fields chỉ nếu có nguồn đáng tin.

Không tự bịa thiếu dữ liệu.

---

# 41. EMPLOYEE DUPLICATE DETECTION

Detect:

```text
employee code
phone
email
CCCD nếu authorized migration process
```

Không auto merge chỉ theo name.

Xuất duplicate report.

---

# 42. ACCOUNT MIGRATION

Không migrate password plain text.

Nếu system cũ password hash incompatible:

- create accounts
- force password setup/reset

Không copy insecure password.

---

# 43. LEAVE BALANCE MIGRATION

Nếu hiện tại phép nằm Excel:

Không chỉ import:

```text
remaining = 8
```

Nếu không có full history, có thể tạo:

```text
Opening Balance Migration
```

ledger transaction với:

```text
amount
effective date
source = MIGRATION
source file/reference
```

Đây là acceptable migration baseline.

---

# 44. LEAVE HISTORY MIGRATION

Nếu có đầy đủ history:

- import approved leave
- import ledger history

Nếu chỉ có remaining balance:

- không fake history
- import opening balance
- ghi rõ source

---

# 45. WAREHOUSE OPENING BALANCE

Nếu hiện tại có tồn kho Excel:

Không tạo fake historical receipts.

Tạo:

```text
OPENING_BALANCE
```

inventory adjustment / migration document.

Fields:

```text
warehouse
item
quantity
effective date
migration batch
source file
```

Post qua Warehouse Posting Service.

Không insert trực tiếp `inventory_balances`.

---

# 46. WAREHOUSE MIGRATION RECONCILIATION

Sau import:

```text
Excel source total
vs
System inventory
```

Theo:

- warehouse
- item
- total quantity

Report mismatch.

---

# 47. PROJECT MIGRATION

Nếu đang có project active:

Import:

```text
project
worksite
manager
supervisor
active worker assignments
start/end
status
```

Không cần migrate project lịch sử đã đóng nếu business không cần.

Quyết định scope rõ.

---

# 48. XNK MIGRATION

Nếu có shipment đang chạy:

Import:

```text
supplier
contract
shipment
current status
ETD
current ETA
documents metadata/files
remaining receiving
```

ETA historical data chỉ import nếu source có.

Không invent.

---

# 49. TIMESHEET HISTORY MIGRATION

Không cần migrate toàn bộ raw attendance cũ nếu mục tiêu chỉ vận hành từ go-live.

Có thể chọn:

```text
Cutover date
```

Ví dụ:

```text
System mới bắt đầu source of truth từ 01/10/2026
```

Nếu cần lịch sử:

- migrate monthly summary
- mark source = LEGACY

Không giả raw event.

---

# 50. MIGRATION BATCH

Mỗi import có:

```text
migration_batch_id
source
file
started_at
completed_at
status
records_total
records_success
records_failed
checksum optional
executed_by
```

---

# 51. MIGRATION DRY RUN

Bắt buộc:

```text
parse
↓
validate
↓
preview
↓
error report
```

trước commit.

---

# 52. MIGRATION ERROR REPORT

Ví dụ:

```text
Row 23
Employee code missing

Row 91
Department "Thi Congg" không tồn tại

Row 120
Duplicate phone
```

Không silently skip.

---

# 53. MIGRATION MAPPING

Cho mapping legacy value:

```text
"NV chính thức"
→
OFFICIAL_EMPLOYEE
```

```text
"Kho CT"
→
Warehouse ID
```

Không hard-code mapping trong one-off script không document.

---

# 54. MIGRATION SCRIPT LOCATION

Tạo riêng:

```text
scripts/migration/
```

hoặc project convention.

Không nhét migration import logic vào frontend.

---

# 55. MIGRATION IDEMPOTENCY

Rerun same batch không tạo duplicate.

Có:

```text
source_key
migration_batch
```

hoặc unique external ref.

---

# 56. MIGRATION ROLLBACK

Migration phải có rollback strategy.

Nếu batch chưa go-live:

- delete/reverse imported batch safely

Đối với warehouse ledger:

- reversal, không direct delete nếu already posted per domain policy

Có thể reset staging DB trước production cutover.

---

# 57. MIGRATION AUDIT

Record:

```text
Who
When
Source file
Mapping
Counts
Errors
```

Không cần audit từng imported field nếu batch metadata đủ + domain records.

---

# 58. PRE-GO-LIVE DATA FREEZE

Nếu hệ thống cũ vẫn dùng trong cutover:

Có thời điểm:

```text
Data Freeze
```

Ví dụ:

```text
17:00 ngày trước go-live
```

Sau freeze:

- không update Excel cũ
- hoặc delta changes được ghi riêng

Không để hai nguồn cùng thay đổi mà không reconcile.

---

# 59. DELTA MIGRATION

Nếu migration rehearsal làm trước:

```text
Full migration
↓
Users continue old system
↓
Go-live
↓
Delta migration
```

Define delta keys:

```text
updated_at
new records
changed balances
```

Không rerun full blind.

---

# 60. CUTOVER PLAN

Tạo:

```text
docs/go-live/cutover-plan.md
```

Có timeline:

```text
T-7 days
T-3 days
T-1 day
Go-live morning
T+1
T+7
```

---

# 61. T-7 DAYS

Checklist:

- UAT critical pass
- users identified
- master data cleaned
- migration dry run
- training scheduled
- backup verified
- production env ready

---

# 62. T-3 DAYS

- final data mapping
- role/permission review
- device/browser check
- attendance locations verified
- worksite GPS verified
- shift/calendar verified
- warehouse opening balance prepared

---

# 63. T-1 DAY

- production backup/snapshot
- final deployment
- smoke test
- accounts created
- permissions checked
- support contacts ready
- cutover reminder

---

# 64. GO-LIVE DAY

Recommended:

```text
Early morning / before business operations
```

Checklist:

- login
- attendance
- worker attendance if scheduled
- leave
- dashboard
- warehouse if used that day
- XNK current shipments
- notifications
- monitoring

---

# 65. FIRST ATTENDANCE GO-LIVE

Đây là high-risk workflow.

Có support person theo dõi:

```text
first 1–2 giờ
```

Monitor:

- attendance event count
- pending sync
- photo upload failures
- GPS failures
- duplicate
- user complaints

Không đợi cuối ngày mới kiểm tra.

---

# 66. FIRST WORKER ATTENDANCE

Pilot vài công trường trước nếu có nhiều site.

Verify:

- roster đúng
- supervisor đúng
- offline works
- photos synced
- counts correct

---

# 67. PARALLEL RUN

Đối với bảng công/kho nếu rủi ro cao:

Có thể chạy:

```text
System mới
+
Excel cũ
```

trong một khoảng ngắn.

Không chạy song song vô thời hạn.

Mục tiêu là compare/reconcile.

---

# 68. TIMESHEET PARALLEL RUN

Ví dụ:

```text
1 kỳ công đầu
```

Compare:

- actual days
- leave
- late
- exceptions

Nếu mismatch:

- classify business rule vs bug vs source issue

---

# 69. WAREHOUSE PARALLEL RUN

Có thể:

- inventory opening count
- compare daily receipt/issue
- end-of-day reconciliation

Không nhập một giao dịch hai lần vào source truth.

Excel cũ chỉ là shadow tracking trong period pilot.

---

# 70. PILOT GROUP

Nên có pilot gồm:

```text
1 HR
1 approver
vài nhân viên văn phòng
1 giám sát
1 công trường
1 warehouse user
1 XNK user
```

Nếu company structure khác, chọn nhóm đại diện.

---

# 71. PILOT DURATION

Không hard-code.

Có thể:

```text
3–7 ngày
```

cho attendance/project workflows.

Một kỳ công cho timesheet validation.

Ghi actual plan.

---

# 72. UAT OWNERS

Mỗi module có business owner.

Ví dụ:

```text
HR → nhân sự/chấm công/phép
Kho → warehouse
XNK → shipment
Project → supervisor/project manager
BGĐ → management dashboard
```

Developer không tự sign-off nghiệp vụ thay business owner.

---

# 73. UAT SIGN-OFF

Tạo:

```text
docs/uat/uat-signoff.md
```

Mỗi module:

```text
Business Owner
Date
Critical scenarios tested
Open issues
Decision
```

Decision:

```text
ACCEPTED
ACCEPTED WITH KNOWN ISSUES
REJECTED / BLOCKED
```

---

# 74. BUG SEVERITY

Chuẩn:

```text
P0 — Data loss/security/business stop
P1 — Critical core flow broken
P2 — Major but workaround exists
P3 — Minor UX/visual
P4 — Enhancement
```

Không gọi mọi bug P0.

---

# 75. GO-LIVE BLOCKERS

Bắt buộc block nếu còn lỗi kiểu:

```text
Data loss
Attendance duplicated/lost
Wrong leave balance
Wrong timesheet
Wrong stock quantity
Unauthorized data exposure
Private file public
Broken backup/restore
Migration mismatch significant
Critical login failure
```

---

# 76. NON-BLOCKING ISSUES

Có thể go-live với:

- minor visual spacing
- non-critical label
- low-priority convenience
- optional report layout

Phải ghi known issues.

---

# 77. BUG TRACKER

Tạo structured backlog.

Mỗi bug:

```text
ID
Module
Severity
Environment
Steps
Expected
Actual
Evidence
Owner
Status
Fixed version
```

Không quản lý bug bằng chat rời.

---

# 78. REGRESSION

Sau fix P0/P1:

Không chỉ retest bug.

Run regression impacted modules.

Ví dụ fix Attendance service → retest Timesheet.

---

# 79. TEST EVIDENCE

Lưu:

- screenshots
- test logs
- exported sample
- migration reports

Không cần chụp mọi PASS nhỏ.

Critical flows có evidence.

---

# 80. TRAINING — MỤC TIÊU

Không đào tạo toàn hệ thống cho mọi người.

Mỗi nhóm chỉ học phần họ dùng.

---

# 81. EMPLOYEE TRAINING

Nội dung:

```text
Đăng nhập
Chấm công
Kiểm tra lịch sử
Tạo đơn nghỉ
Xem đơn
Xem bảng công
Thông báo
```

Không nói API, audit, admin config.

---

# 82. SUPERVISOR TRAINING

Nội dung:

```text
Mở công trường hôm nay
Điểm danh
Thêm worker phát sinh
Chụp ảnh
Offline
Chờ đồng bộ
Chốt ngày nếu dùng
Cập nhật dự án
Issue
```

---

# 83. HR TRAINING

Nội dung:

```text
Employee profile
Account provisioning
Leave
Approval
Timesheet
Exceptions
Adjustment
Lock period
Excel export
Sensitive permissions
```

---

# 84. WAREHOUSE TRAINING

Nội dung:

```text
Item
Inventory
Receipt
Issue
Transfer
Stock count
Post
Reverse
```

Nhấn mạnh:

```text
Posted document không sửa trực tiếp.
```

---

# 85. XNK TRAINING

Nội dung:

```text
Contract
Shipment
ETA history
Documents
Customs
Receiving
Warehouse receipt link
```

---

# 86. ADMIN TRAINING

Nội dung:

```text
Users
Roles
Permissions
Branding
Business settings
Approval workflows
Integrations
Audit
System health
```

Không cấp Admin cho người chỉ cần cấu hình một module nếu permission granular giải quyết được.

---

# 87. USER GUIDE

Tạo folder:

```text
docs/user-guide/
```

Các file:

```text
employee.md
supervisor.md
hr.md
warehouse.md
import-export.md
manager.md
admin.md
```

Ngắn, task-oriented.

---

# 88. QUICK GUIDE

Mỗi nhóm nên có 1 trang quick start:

```text
5 bước chấm công
5 bước điểm danh công nhân
4 bước duyệt đơn
```

Không cần manual 100 trang.

---

# 89. SCREENSHOTS

Nếu docs có screenshot:

- dùng UI current version
- không chứa PII thật
- không dùng screenshot outdated

Có thể cập nhật sau mỗi major release.

---

# 90. IN-APP HELP — FOUNDATION

Có thể thêm:

```text
?
Hướng dẫn
```

link tới docs/task guide.

Không build interactive tutorial engine nếu chưa cần.

---

# 91. SUPPORT CHANNEL

Go-live cần xác định:

```text
Ai nhận lỗi?
Qua đâu?
```

Ví dụ:

```text
IT nội bộ
Zalo group support / ticket list
```

Không bắt buộc build Helpdesk module.

---

# 92. SUPPORT INFO REQUIRED

Khi user report bug, yêu cầu:

```text
Thời gian
Tài khoản
Màn hình
Mã tham chiếu lỗi
Screenshot
```

Không yêu cầu password.

---

# 93. ERROR REFERENCE

Prompt 15 đã có request/error ID.

Training user:

```text
Nếu gặp lỗi, gửi mã tham chiếu cho IT.
```

---

# 94. GO-LIVE MONITORING

Trong 7 ngày đầu, theo dõi:

```text
5xx errors
attendance sync failures
photo upload failures
leave workflow failures
timesheet exceptions
warehouse reconciliation
shipment receiving discrepancies
background jobs
storage growth
```

---

# 95. DAILY GO-LIVE CHECK

Có checklist ngắn:

```text
Morning
- system health
- backup
- attendance queue

Midday
- errors/jobs

End of day
- attendance sync
- warehouse reconciliation
- critical issues
```

Không cần vĩnh viễn.

---

# 96. HYPERCARE

Giai đoạn:

```text
Go-live → 1–2 tuần
```

Ưu tiên fix:

```text
P0/P1
```

Không thay đổi lớn UI/business trong hypercare nếu không critical.

---

# 97. CHANGE FREEZE

Trong vài ngày đầu:

- hạn chế feature mới
- chỉ bug/security/critical business correction

Tránh vừa go-live vừa thêm module mới.

---

# 98. CONFIG CHANGE DURING HYPERCARE

Các config quan trọng:

```text
attendance radius
shift
leave policy
workflow
warehouse policy
```

phải có reason/audit.

Không thử config trực tiếp trên production vô kế hoạch.

---

# 99. GO-LIVE OWNER

Có một technical owner.

Có business owner theo module.

Không để trách nhiệm mơ hồ.

---

# 100. CUTOVER ROLLBACK CRITERIA

Define trước:

Rollback nếu:

```text
attendance data loss widespread
critical security issue
major DB corruption
warehouse quantities unreliable
login unavailable company-wide
```

Không rollback chỉ vì minor UI bug.

---

# 101. ROLLBACK DATA HANDLING

Nếu đã có new production transactions:

Không rollback app rồi bỏ mất dữ liệu.

Plan phải ghi:

- preserve new records
- export/snapshot
- migrate forward if needed

Rollback app version ≠ rollback business data blindly.

---

# 102. SYSTEM OF RECORD SWITCH

Xác định ngày:

```text
From [cutover timestamp]
Châu Tuấn System = source of truth
```

cho từng domain.

Có thể khác:

```text
Attendance: 01/10
Warehouse: 15/10
XNK: 15/10
```

Không nhất thiết big-bang.

---

# 103. PHASED GO-LIVE

Khuyến nghị theo module nếu công ty muốn giảm rủi ro:

```text
Phase 1
HR + Attendance + Leave

Phase 2
Timesheet

Phase 3
Project / Worker Attendance

Phase 4
Warehouse

Phase 5
XNK

Phase 6
Integrations
```

Nếu user/business muốn go-live cùng lúc, vẫn hỗ trợ nhưng ghi risk.

---

# 104. MODULE DEPENDENCY

Không go-live Timesheet trước khi:

- attendance
- leave
- shift/calendar

ổn định.

Không go-live XNK receiving trước Warehouse.

---

# 105. MASTER DATA OWNER

Assign owner:

```text
Departments → HR
Shifts → HR/Admin
Projects → Project/Management
Items → Warehouse
Suppliers → XNK
```

Không để mọi admin chỉnh mọi master data tùy ý.

---

# 106. DATA QUALITY RULES

Trước migration/go-live:

- no duplicate employee codes
- no duplicate item codes
- no invalid department reference
- no active employee without required basic identity
- no active warehouse without code/name
- no current shipment without supplier/reference
- no project assignment to inactive worker unless intentional

---

# 107. MIGRATION VALIDATION REPORT

Tạo:

```text
docs/migration/validation-report.md
```

Summary:

```text
Source rows
Imported
Skipped
Errors
Duplicates
Warnings
Reconciled
```

---

# 108. RECONCILIATION SIGN-OFF

Business owner sign off:

```text
Employee count
Leave balance
Warehouse opening balance
Active project team
Active shipment receiving
```

Không developer tự xác nhận dữ liệu nghiệp vụ.

---

# 109. PRODUCTION SEED

Chỉ seed:

- roles/permissions
- default config
- required types
- system admin account setup flow
- default templates

Không seed fake transactions.

---

# 110. FIRST ADMIN

Create initial admin securely.

Không hard-code:

```text
admin/admin
```

Require secure password/setup.

---

# 111. USER PROVISIONING BEFORE GO-LIVE

Generate list:

```text
Employee
Has account?
Role
Department
Status
```

Verify no wrong access.

---

# 112. ROLE REVIEW

Before go-live:

```text
Who has admin?
Who can export sensitive?
Who can unlock timesheet?
Who can post warehouse?
Who can view all shipments?
Who can manage API keys?
```

Explicit review.

---

# 113. SENSITIVE EXPORT REVIEW

List all users with:

```text
employee.export_sensitive
```

Business owner confirms.

---

# 114. WAREHOUSE POST REVIEW

List all:

```text
warehouse.*.post
warehouse.*.reverse
```

Only intended users.

---

# 115. APPROVAL WORKFLOW REVIEW

Before go-live, simulate actual employees:

```text
Employee A
→ resolved manager?
→ HR?
```

Test 10–20 representative users.

No missing approver.

---

# 116. ATTENDANCE LOCATION REVIEW

Physically verify coordinates/radius if possible.

Do not rely only on map data entry.

Test at:

- office
- project sites

Avoid too-tight radius causing false rejection.

---

# 117. GPS PILOT

At each critical worksite:

- Android
- iPhone if used
- indoor/outdoor position
- actual GPS accuracy

Adjust policy based on reality.

---

# 118. OFFLINE PILOT

At a real worksite with weak network:

Test worker attendance and personal attendance.

Không chỉ simulate desktop offline.

---

# 119. PHOTO STORAGE ESTIMATE

Before go-live, estimate:

```text
average photo KB
photos/day
days/month
```

Calculate monthly storage.

No need exact if unknown, but use pilot measurements.

---

# 120. EXPORT SIZE ESTIMATE

Test one realistic monthly timesheet export.

Measure:

```text
generation time
file size
memory
```

Ensure no timeout.

---

# 121. DATA RETENTION REVIEW

Business confirms or flags unresolved:

- attendance photos
- employee docs
- project files
- shipment docs
- exports

Nếu chưa quyết định:

```text
OPEN POLICY ITEM
```

Không tự đặt retention legal.

---

# 122. GO-LIVE CHECKLIST FILE

Tạo:

```text
docs/go-live/go-live-checklist.md
```

Categories:

```text
Infrastructure
Security
Data
Users
Permissions
Config
Migration
Training
Monitoring
Backup
Support
Business Sign-off
```

---

# 123. GO/NO-GO MEETING

Trước go-live:

Review:

```text
P0/P1 bugs
Migration validation
Backup
Restore readiness
UAT sign-off
Permissions
Training
Support
Rollback
```

Decision:

```text
GO
NO-GO
GO WITH ACCEPTED RISKS
```

Record decision.

---

# 124. ACCEPTED RISKS

Nếu GO WITH ACCEPTED RISKS:

Mỗi risk:

```text
Description
Impact
Workaround
Owner
Due date
Approved by
```

Không để “known issue” không owner.

---

# 125. GO-LIVE EVIDENCE PACKAGE

Tạo folder:

```text
docs/go-live/evidence/
```

hoặc reference paths.

Bao gồm:

- UAT signoff
- migration report
- permission review
- backup/restore evidence
- smoke test
- critical screenshots/export samples

Không lưu PII không cần.

---

# 126. POST-GO-LIVE REVIEW

Sau 1–2 tuần:

Review:

```text
Bug count
User feedback
Attendance failure rate
Sync failure
Approval delays
Timesheet exceptions
Warehouse mismatch
Shipment issues
Performance
Storage
```

---

# 127. V2 BACKLOG

Sau pilot/go-live, chuyển feature requests thành backlog.

Ví dụ:

```text
Barcode
Lot/Serial
Advanced project tasks
Milestones/Gantt
MISA actual integration
Zalo actual notifications
Biometric/liveness
Advanced custom fields
```

Không thêm ngay trong V1 trừ critical.

---

# 128. FEATURE REQUEST CLASSIFICATION

Classify:

```text
Bug
Business gap
Usability
Automation
Integration
Nice-to-have
```

Không gọi mọi request là bug.

---

# 129. NO SCOPE CREEP

Trong Prompt 16:

Không triển khai module mới.

Chỉ fix:

- bug
- UAT gap
- migration requirement
- missing production operational necessity

Feature mới → backlog.

---

# 130. FINAL SYSTEM DOCUMENTATION

Tạo/update:

```text
README.md
docs/architecture/
docs/user-guide/
docs/operations/
docs/migration/
docs/uat/
docs/go-live/
```

README không cần chứa mọi chi tiết, chỉ index docs.

---

# 131. ARCHITECTURE INDEX

Tạo:

```text
docs/architecture/README.md
```

Map:

- modules
- routes
- business services
- integrations
- storage
- auth
- report engine

Giúp IT maintain sau này.

---

# 132. DATA DICTIONARY

Tạo:

```text
docs/architecture/data-dictionary.md
```

Không cần every DB implementation detail.

Ghi core entities:

```text
Employee
User Account
Attendance Event
Project Assignment
Worker Attendance Session
Leave Request
Leave Ledger
Daily Timesheet
Warehouse Document
Stock Ledger
Shipment
Approval Case
Document
Audit Log
```

---

# 133. BUSINESS RULE INDEX

Tạo:

```text
docs/architecture/business-rules.md
```

Ví dụ:

```text
Posted warehouse document immutable
Locked timesheet immutable
Approved leave affects official leave ledger
Worker attendance photos belong to session
Individual attendance and worker attendance are separate sources
```

---

# 134. PERMISSION CATALOG

Tạo:

```text
docs/security/permissions.md
```

Liệt kê permission keys + meaning.

Không để permission chỉ tồn tại trong code.

---

# 135. CONFIGURATION CATALOG

Tạo:

```text
docs/configuration/settings-catalog.md
```

Ghi:

- config
- default
- effect
- module
- effective date behavior
- dangerous change warning

---

# 136. API DOCS REVIEW

Ensure API/OpenAPI reflects actual deployed endpoints.

Remove endpoints not implemented.

Mark internal/external clearly.

---

# 137. USER GUIDE VERSION

Ghi version/release tương ứng để tránh docs outdated.

---

# 138. CHANGELOG / RELEASE NOTES

Go-live release:

```text
Version
Date
Modules
Known limitations
Migration notes
```

---

# 139. FINAL BUG SWEEP

Search codebase for:

```text
TODO
FIXME
HACK
console.log
debugger
mock
fake data
hard-coded admin
temporary bypass
```

Không xóa TODO có lý do mù quáng.

Review từng item.

---

# 140. FEATURE FLAG SWEEP

Đảm bảo:

- unfinished features disabled
- test flags off
- staging-only tools off

---

# 141. TEST ACCOUNT SWEEP

Production:

- remove/disable test accounts
- keep only approved support/admin accounts

Không để default password.

---

# 142. DATA DEMO SWEEP

Search fake data:

```text
Test
Demo
John Doe
Fake Project
```

Remove if production table.

---

# 143. BROKEN LINK SWEEP

Test major navigation links/routes.

No sidebar dead links.

No settings route 404.

---

# 144. ACCESSIBILITY SWEEP

Check:

- labels
- keyboard
- focus
- contrast
- mobile touch
- error messages

Không cần WCAG certification, nhưng critical workflows phải usable.

---

# 145. VIETNAMESE LANGUAGE SWEEP

Check:

- không lỗi font
- không mojibake
- không mixed English technical text user-facing
- date/time consistent
- terms consistent

Examples:

```text
Chấm vào
Chấm ra
Điểm danh
Ghi sổ
Khóa kỳ
```

Use consistent terminology.

---

# 146. ERROR MESSAGE SWEEP

Không còn:

```text
Internal Server Error
Undefined
Null
GeolocationPositionError
Prisma error
Supabase error
```

user-facing.

---

# 147. LOADING STATE SWEEP

Major actions have:

- loading
- disable repeated submit
- success
- failure

No silent action.

---

# 148. EMPTY STATE SWEEP

No blank white page when no data.

Human-readable empty state.

---

# 149. FORM VALIDATION SWEEP

Required fields:

- consistent
- error near field
- preserve entered data
- server errors map appropriately

---

# 150. MOBILE SAFE AREA

If PWA/mobile:

- bottom nav avoids iPhone safe area
- camera controls usable
- CTA not hidden by browser bar/keyboard

---

# 151. KEYBOARD QA

Desktop HR/Kho:

- tab navigation
- Enter
- Escape
- table actions
- command palette

No keyboard traps.

---

# 152. FINAL PERFORMANCE SWEEP

Check actual production-like data:

- dashboard
- employees
- timesheet
- ledger
- shipment
- global search
- audit
- documents

No obvious multi-second delay without loading state.

---

# 153. GO-LIVE BLOCKER REPORT

Tạo:

```text
docs/go-live/blockers.md
```

Mỗi blocker:

```text
ID
Severity
Description
Owner
Status
Target fix
```

If none:

```text
No open P0/P1 blockers as of [date].
```

Không fake.

---

# 154. FINAL READINESS SCORECARD

Tạo:

```text
docs/go-live/readiness-scorecard.md
```

Areas:

```text
Functionality
Data
Permissions
Security
Backup/Restore
Monitoring
Performance
Mobile
Training
Migration
Support
Documentation
```

Status:

```text
READY
READY WITH RISK
NOT READY
```

Không dùng số điểm đẹp giả.

---

# 155. FINAL GO-LIVE DECISION

Codex không tự quyết định business GO.

Codex chỉ báo:

```text
Technical readiness
Open blockers
Accepted risks needed
```

Business owner/management quyết định GO.

---

# 156. TEST AUTOMATION PRIORITY

Automate high-value repeatable flows:

- login
- permissions
- attendance idempotency
- leave approval
- timesheet lock
- warehouse posting
- XNK receipt integration
- API/webhook security

Không cố automate visual every screen nếu tốn thời gian hơn giá trị.

---

# 157. MANUAL UAT PRIORITY

Manual:

- camera
- GPS
- offline
- PDF print
- Excel usability
- real workflow language
- mobile usability
- business sign-off

---

# 158. DATA MIGRATION TEST ENVIRONMENT

Migration rehearsal phải chạy trên staging.

Không lần đầu chạy script migration trên production.

---

# 159. MIGRATION CHECKSUM / SOURCE VERSION

Record source file hash hoặc metadata nếu practical.

Giúp biết migration dùng file nào.

---

# 160. MIGRATION LOCKDOWN

Sau production migration success:

Archive source files securely.

Không để Excel chứa CCCD nằm public/shared folder không kiểm soát.

---

# 161. FIRST MONTH REVIEW

Sau kỳ công đầu tiên:

Review:

- timesheet calculation
- late/early
- leave integration
- Excel export
- HR manual adjustments
- worker attendance contribution

Đây là milestone quan trọng.

---

# 162. FIRST STOCKTAKE REVIEW

Sau kiểm kê đầu tiên:

Verify:

- expected
- counted
- variance
- adjustment
- ledger
- balance

---

# 163. FIRST SHIPMENT RECEIVING REVIEW

Sau shipment đầu tiên:

Verify:

- partial receipt
- warehouse posting
- received summary
- documents
- customs
- variance

---

# 164. GO-LIVE SUCCESS CRITERIA

Go-live được xem là ổn định khi:

- không có data-loss
- attendance success rate ổn
- no duplicate widespread
- leave/balance correct
- timesheet matches agreed rules
- warehouse reconciles
- critical permissions correct
- backups/monitoring active
- users can complete primary tasks

Không định nghĩa success bằng “không ai than phiền”.

---

# 165. ACCEPTANCE CRITERIA

## QA / UAT

- [ ] QA matrix complete.
- [ ] Critical negative tests complete.
- [ ] Desktop QA complete.
- [ ] Mobile QA complete.
- [ ] Offline QA complete.
- [ ] Role/permission tests complete.
- [ ] Critical E2E flows pass.

## Business Modules

- [ ] HR UAT.
- [ ] Attendance UAT.
- [ ] Worker Attendance UAT.
- [ ] Leave/PDF UAT.
- [ ] Timesheet/Excel UAT.
- [ ] Project UAT.
- [ ] Warehouse UAT.
- [ ] XNK UAT.
- [ ] Approval/Document/Audit UAT.

## Migration

- [ ] Data inventory.
- [ ] Mapping.
- [ ] Dry run.
- [ ] Error report.
- [ ] Migration batch tracking.
- [ ] Employee reconciliation.
- [ ] Leave balance reconciliation.
- [ ] Warehouse reconciliation.
- [ ] Active projects verified.
- [ ] Active shipments verified.
- [ ] No password migration insecurely.

## Training

- [ ] Employee guide.
- [ ] Supervisor guide.
- [ ] HR guide.
- [ ] Warehouse guide.
- [ ] XNK guide.
- [ ] Admin guide.
- [ ] Pilot users trained.

## Go-Live

- [ ] Cutover plan.
- [ ] Data freeze/delta plan.
- [ ] Go-live checklist.
- [ ] Rollback criteria.
- [ ] Support owner.
- [ ] Monitoring plan.
- [ ] Hypercare plan.
- [ ] UAT sign-off.
- [ ] Business reconciliation sign-off.

## Documentation

- [ ] Architecture index.
- [ ] Data dictionary.
- [ ] Business rules.
- [ ] Permission catalog.
- [ ] Configuration catalog.
- [ ] User guides.
- [ ] Migration docs.
- [ ] Go-live docs.
- [ ] Release notes.

## Final Quality

- [ ] No open P0/P1 technical blocker.
- [ ] Security blockers resolved.
- [ ] Backup/restore evidence exists.
- [ ] Production build pass.
- [ ] Smoke test pass.
- [ ] Readiness scorecard completed.

---

# 166. THỨ TỰ TRIỂN KHAI

1. Freeze feature development.
2. Build QA matrix.
3. Build role/permission test matrix.
4. Run full regression.
5. Run mobile/offline QA.
6. Run module UAT preparation.
7. Fix P0/P1.
8. Re-run regression.
9. Build migration inventory.
10. Build mapping.
11. Run staging migration dry-run.
12. Reconcile data.
13. Build training docs.
14. Train pilot group.
15. Run pilot.
16. Capture UAT feedback.
17. Fix critical UAT gaps.
18. Final migration rehearsal.
19. Review permissions/config.
20. Prepare production env.
21. Prepare cutover.
22. GO/NO-GO review.
23. Final production migration.
24. Smoke test.
25. Go-live.
26. Monitor first attendance/workflows.
27. Hypercare.
28. First-period reconciliation.
29. Final project documentation.
30. Final readiness report.

---

# 167. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## QA

- modules tested
- automated tests
- manual tests
- failed scenarios
- remaining issues

## UAT

- business owners
- modules accepted
- modules blocked
- accepted risks

## Migration

- source files
- row counts
- success/errors
- reconciliation results
- rollback strategy

## Permissions

- admin users
- sensitive export users
- warehouse post users
- approvers
- integration managers

Không in secret.

## Go-Live

- cutover date/time
- system-of-record switch
- smoke test
- blockers
- rollback criteria

## Hypercare

- monitoring
- support owner
- known issues

## Documentation

Liệt kê các tài liệu đã tạo.

## Final Technical Readiness

Chỉ dùng:

```text
READY
READY WITH KNOWN RISKS
NOT READY
```

Kèm lý do.

Không tự tuyên bố business acceptance thay người dùng/management.

---

# 168. QUY TẮC CUỐI

Không thêm feature mới trong final QA trừ blocker thật.

Không migration trực tiếp production mà chưa dry-run staging.

Không tự merge duplicate nhân sự theo tên.

Không migrate password plain text.

Không nhập opening stock bằng cách sửa balance trực tiếp.

Không nhập phép năm bằng cách phá Leave Ledger.

Không dùng fake historical events khi source không có.

Không go-live khi còn data-loss/security/stock/timesheet blocker nghiêm trọng.

Không coi developer testing là UAT.

Không coi backup là đủ nếu restore chưa có quy trình.

Không để user chưa training vào workflow critical không có support.

Không kéo parallel run vô thời hạn.

Không rollback app mà bỏ qua business data mới phát sinh.

Không tự sign-off nghiệp vụ thay HR/Kho/XNK/Management.

**Dừng sau khi QA/UAT/Migration/Training/Cutover/Go-Live package hoàn chỉnh, các blocker kỹ thuật critical đã được xử lý, readiness report trung thực và hệ thống sẵn sàng để business owner ra quyết định GO/NO-GO.**
