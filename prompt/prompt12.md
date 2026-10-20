# PROMPT 12 — TRUNG TÂM PHÊ DUYỆT, THÔNG BÁO, TÀI LIỆU DÙNG CHUNG, AUDIT LOG VÀ CẤU HÌNH NGHIỆP VỤ TOÀN HỆ THỐNG

## Bối cảnh

Bạn đang tiếp tục xây dựng **Hệ thống nội bộ Châu Tuấn**.

Các prompt trước đã triển khai hoặc xác lập:

- kiến trúc nền tảng
- routing thật
- enterprise design system
- frontend desktop/mobile
- Nhân sự
- User Account tách Employee Record
- Role / Permission
- Admin Console / Branding
- chấm công cá nhân
- Project / Worksite
- điểm danh công nhân
- nghỉ phép / approval / phép năm / PDF
- bảng công / khóa kỳ / Excel
- cập nhật dự án / issue / dashboard
- quản lý Kho
- quản lý Xuất nhập khẩu
- API-first
- configuration over hard-code
- private file storage
- audit foundation

Prompt này triển khai các **năng lực dùng chung toàn hệ thống**:

1. Trung tâm phê duyệt.
2. Approval inbox thống nhất.
3. Approval workflow engine dùng lại.
4. Notification Center.
5. Notification preferences.
6. Tài liệu dùng chung / Document Center.
7. Liên kết tài liệu với module.
8. Version tài liệu.
9. Quyền truy cập tài liệu.
10. Audit Log toàn hệ thống.
11. Human-readable activity history.
12. Cấu hình nghiệp vụ toàn hệ thống.
13. Danh mục dùng chung.
14. Feature/config governance.
15. Lịch sử thay đổi cấu hình.
16. Approval delegation foundation.
17. System health/user-facing operational notices foundation.
18. Chuẩn bị cho API/Webhook/Integration Prompt tiếp theo.

Không xây DMS enterprise quá phức tạp.

Không xây workflow BPMN drag-drop tùy ý.

Không xây chat nội bộ.

---

# 1. MỤC TIÊU

Hệ thống đã có nhiều module có nhu cầu giống nhau:

```text
Nghỉ phép
Điều chỉnh công
Kho
XNK
Các yêu cầu tương lai
```

Nếu mỗi module tự viết:

```text
approval
notification
document
audit
```

riêng thì codebase sẽ bị duplicate và khó bảo trì.

Prompt này phải chuẩn hóa thành các service dùng chung:

```text
Approval Platform
Notification Platform
Document Platform
Audit Platform
Configuration Platform
```

Nhưng vẫn giữ domain logic của từng module riêng.

---

# 2. NGUYÊN TẮC: GENERIC PLATFORM, DOMAIN-SPECIFIC BUSINESS

Không làm một giant generic table kiểu:

```text
requests
payload JSON
```

rồi mọi nghiệp vụ nhét hết vào đó.

Phải giữ:

```text
Leave Request
Timesheet Adjustment
Warehouse Document
Shipment
...
```

là domain riêng.

Platform dùng chung chỉ quản lý:

```text
Approval Case
Approval Step
Notification
Document Reference
Audit Event
Configuration
```

---

# 3. TRUNG TÂM PHÊ DUYỆT

Route:

```text
/approvals
/approvals/pending
/approvals/completed
/approvals/delegated
/approvals/:approvalCaseId
```

Không chỉ có:

```text
/approvals/leave
```

Mục tiêu là user có một inbox duyệt thống nhất.

---

# 4. APPROVAL INBOX

Trang `/approvals/pending` hiển thị:

```text
Loại yêu cầu
Mã tham chiếu
Người gửi
Phòng ban / đơn vị
Ngày gửi
Nội dung tóm tắt
Bước hiện tại
Thời gian chờ
```

Ví dụ:

```text
Nghỉ phép
LV-2026-00125
Nguyễn Văn A
2 ngày phép năm
Chờ 3 giờ
```

Hoặc:

```text
Điều chỉnh công
ADJ-2026-0042
Trần Văn B
Bổ sung check-out ngày 08/09
Chờ 1 ngày
```

---

# 5. KHÔNG PHÊ DUYỆT TỪ LIST KHI THIẾU CONTEXT

Mặc định:

```text
Click request
↓
Xem detail
↓
Approve / Reject
```

Không đặt 2 nút approve/reject nhỏ ngay trên dense table nếu user chưa xem context.

Có thể cho quick approve ở loại nghiệp vụ cực đơn giản sau này bằng config.

V1 ưu tiên an toàn.

---

# 6. APPROVAL DETAIL

Route:

```text
/approvals/:approvalCaseId
```

Hiển thị:

```text
Loại yêu cầu
Mã tham chiếu
Người tạo
Thời gian tạo
Nội dung chính
Tài liệu đính kèm
Approval timeline
Current step
```

Actions:

```text
Duyệt
Từ chối
Chuyển người duyệt nếu có quyền
```

---

# 7. DOMAIN DETAIL LINK

Approval detail không copy toàn bộ domain UI.

Có:

```text
[Xem chi tiết đơn nghỉ]
[Xem phiếu điều chỉnh]
[Xem phiếu kho]
```

Deep link tới module gốc.

---

# 8. APPROVAL CASE

Concept:

```text
approval_case
```

Fields:

```text
id
domain_type
domain_id
reference_number
requester_user_id
requester_employee_id
workflow_id
workflow_version
status
current_step
created_at
completed_at
metadata_summary
```

Không lưu full business payload vào approval case.

---

# 9. APPROVAL STEP

Fields:

```text
approval_case_id
step_order
step_name
approver_source
resolved_approver_user_id
status
acted_at
comment
delegated_from_user_id optional
created_at
```

---

# 10. APPROVAL STATUS

Case:

```text
PENDING
APPROVED
REJECTED
CANCELLED
WITHDRAWN
```

Step:

```text
PENDING
APPROVED
REJECTED
SKIPPED
CANCELLED
```

Không dùng boolean.

---

# 11. WORKFLOW DEFINITION

Admin route:

```text
/settings/approval-workflows
```

Cho phép cấu hình workflow theo module/request type.

Ví dụ:

```text
Nghỉ phép năm
Step 1: Quản lý trực tiếp
Step 2: HR
```

Hoặc:

```text
Điều chỉnh công
Step 1: Trưởng bộ phận
```

---

# 12. APPROVER SOURCES

Hỗ trợ an toàn:

```text
Direct Manager
Department Manager
Project Manager
Specific Role
Specific User
HR Resolver
Warehouse Manager
Custom domain resolver đã code sẵn
```

Không cho admin viết code resolver.

---

# 13. WORKFLOW VERSIONING

Khi admin sửa workflow:

```text
Version 1
Version 2
```

Request đã submit dùng version đã snapshot.

Không đổi workflow của request đang chạy.

---

# 14. WORKFLOW PREVIEW

Admin phải thấy:

```text
Nhân viên
↓
Quản lý trực tiếp
↓
HR
```

trước khi publish.

Nếu resolver có khả năng fail:

```text
Cảnh báo:
Một số nhân viên chưa có quản lý trực tiếp.
```

---

# 15. WORKFLOW VALIDATION

Không cho publish workflow:

- không có step
- vòng lặp
- duplicate step order
- resolver không tồn tại
- role inactive
- specific user disabled

Nếu specific user bị disable sau khi workflow đã publish, request mới phải detect và cảnh báo.

---

# 16. APPROVER RESOLUTION

Khi request submit:

```text
workflow
↓
resolve approvers
↓
snapshot approver assignments
```

Không resolve lại tùy tiện mỗi lần mở detail.

---

# 17. APPROVAL REASSIGNMENT

Nếu approver nghỉ việc hoặc không xử lý được:

User có permission có thể:

```text
Chuyển người duyệt
```

Fields:

```text
Người duyệt mới *
Lý do *
```

Audit bắt buộc.

---

# 18. APPROVAL DELEGATION — FOUNDATION

Tạo nền tảng:

```text
User A
ủy quyền phê duyệt cho
User B
từ ngày X đến ngày Y
```

Không bắt buộc dùng toàn hệ thống ngay.

Route future/current:

```text
/settings/approval-delegations
```

Hoặc user self-service nếu company cho phép.

---

# 19. DELEGATION RULE

Delegation phải có:

```text
from_user
to_user
start_at
end_at
scope
status
created_by
reason
```

Scope:

```text
ALL_APPROVALS
LEAVE_ONLY
TIMESHEET_ONLY
...
```

Không cho B tự nhận ủy quyền nếu policy cần admin/manager approve.

---

# 20. DELEGATION HISTORY

Approval record phải lưu:

```text
approved_by = User B
delegated_from = User A
```

Không giả như A trực tiếp duyệt.

---

# 21. APPROVAL SLA — OPTIONAL FOUNDATION

Có thể cấu hình:

```text
expected_processing_hours
```

Dashboard hiển thị:

```text
Chờ 3 ngày
```

Không tự reject khi hết hạn nếu business chưa yêu cầu.

---

# 22. APPROVAL REMINDER

Notification system có thể gửi reminder:

```text
Yêu cầu đang chờ bạn duyệt.
```

Không spam.

Threshold config.

---

# 23. NOTIFICATION CENTER

Routes:

```text
/notifications
/notifications/unread
```

Header có bell icon.

Mobile bottom/page có notification area.

---

# 24. NOTIFICATION DATA

Fields:

```text
id
recipient_user_id
type
title
message
entity_type
entity_id
deep_link
priority
read_at
created_at
expires_at optional
```

Không lưu arbitrary HTML.

---

# 25. NOTIFICATION TYPES

Ví dụ:

```text
APPROVAL_REQUIRED
LEAVE_APPROVED
LEAVE_REJECTED
ATTENDANCE_SYNC_FAILED
TIMESHEET_EXCEPTION
PROJECT_ISSUE_HIGH
PROJECT_UPDATE
WAREHOUSE_DOCUMENT_POSTED
SHIPMENT_ETA_CHANGED
SHIPMENT_ATTENTION
SYSTEM_NOTICE
```

Không hard-code UI riêng cho từng type nếu có thể map bằng registry.

---

# 26. DEEP LINK

Mỗi notification nên đưa user đúng context.

Ví dụ:

```text
/approvals/ABC
/projects/123/updates/456
/import-export/shipments/789/overview
```

Không đưa về dashboard chung.

---

# 27. MARK READ

Actions:

```text
Đánh dấu đã đọc
Đánh dấu tất cả đã đọc
```

Không xóa notification khi read.

---

# 28. NOTIFICATION PRIORITY

```text
NORMAL
IMPORTANT
CRITICAL
```

Critical chỉ dùng rất hạn chế.

Không dùng đỏ cho mọi notification.

---

# 29. NOTIFICATION PREFERENCES

Route:

```text
/settings/notifications
```

Có thể cho user chỉnh:

```text
Project updates
Approval reminders
Shipment changes
Warehouse alerts
```

Nhưng không cho tắt notification bắt buộc về security/system nếu business yêu cầu.

---

# 30. DELIVERY CHANNEL FOUNDATION

V1 bắt buộc:

```text
IN_APP
```

Chuẩn bị architecture cho:

```text
EMAIL
ZALO
SLACK
PUSH
```

ở Prompt Integration sau.

Không implement fake email/Zalo nếu chưa có provider.

---

# 31. NOTIFICATION EVENT BUS

Domain module emit:

```text
event
```

Notification service quyết định recipient/template/channel.

Không viết:

```text
sendNotification(...)
```

rải rác 50 chỗ nếu event abstraction đã có.

---

# 32. NOTIFICATION TEMPLATE

Admin có thể quản lý template text trong giới hạn.

Ví dụ:

```text
Đơn nghỉ của bạn đã được duyệt.
```

Cho placeholder whitelist:

```text
{{employee_name}}
{{request_number}}
{{project_name}}
```

Không arbitrary code/template execution.

---

# 33. TEMPLATE VALIDATION

Unknown placeholder:

```text
{{password}}
```

reject nếu không whitelist.

Không cho raw HTML/script.

---

# 34. DOCUMENT CENTER

Route:

```text
/documents
/documents/recent
/documents/shared
/documents/:id
```

Mục tiêu:

- tìm tài liệu nội bộ
- xem metadata
- quản lý version
- link tài liệu với module
- không phải thay Google Drive đầy đủ

---

# 35. DOCUMENT CENTER KHÔNG THAY FILE ATTACHMENT TRONG DOMAIN

Domain vẫn có attachment:

```text
Employee Contract
Shipment B/L
Project Update Photo
```

Document Center có thể index/reference tài liệu đó.

Không copy binary thành file mới chỉ để xuất hiện trong Document Center.

---

# 36. DOCUMENT RECORD

Concept:

```text
document_record
- id
- title
- document_type
- file_id
- owner_entity_type
- owner_entity_id
- visibility_scope
- version
- status
- uploaded_by
- created_at
- updated_at
```

---

# 37. DOCUMENT OWNERSHIP

Ví dụ:

```text
Employee
Project
Shipment
Warehouse Document
System/Company
```

Không bắt mọi document có project.

---

# 38. DOCUMENT TYPES

Admin-configurable:

```text
Hợp đồng lao động
Tài liệu dự án
Bản vẽ
Biên bản
Chứng từ XNK
Phiếu kho
Quy trình nội bộ
Biểu mẫu
Khác
```

Không dùng type text tùy tiện nếu cần filter.

---

# 39. DOCUMENT VISIBILITY

Các mức:

```text
PRIVATE_TO_OWNER
PROJECT_MEMBERS
DEPARTMENT
ROLE_BASED
SPECIFIC_USERS
COMPANY_WIDE
```

Nhưng không bắt buộc implement mọi mode nếu architecture quá lớn.

Ít nhất phải support:

```text
Private/domain permission
Project scope
Company-wide
```

---

# 40. DOCUMENT PERMISSION

Quyền file luôn xét:

```text
document permission
+
domain scope
```

Ví dụ:

- user có `document.view`
- nhưng không có quyền Shipment A
- thì không xem B/L của Shipment A.

Không bypass domain permission bằng Document Center.

---

# 41. DOCUMENT VERSIONING

Nếu thay file:

```text
Version 1
Version 2
Version 3
```

Không overwrite binary không lịch sử cho tài liệu quan trọng.

Fields:

```text
version_number
file_id
uploaded_by
uploaded_at
change_note
```

---

# 42. DOCUMENT STATUS

```text
ACTIVE
ARCHIVED
REPLACED
DELETED_PENDING_RETENTION
```

Không hard delete ngay tài liệu có lịch sử nghiệp vụ.

---

# 43. DOCUMENT PREVIEW

Support:

```text
image
PDF
```

với built-in viewer nếu khả dụng.

Office docs:

- download/open
- không cần render Word/Excel browser phức tạp ở V1

---

# 44. DOCUMENT STABLE LINK

Dùng internal stable route:

```text
/documents/:id
```

hoặc:

```text
/files/:fileId/view
```

Permission check rồi mới temporary signed access.

Không public storage URL.

---

# 45. DOCUMENT SEARCH

Search:

```text
title
document type
reference number
project
shipment
employee if permission
```

Không index sensitive content raw nếu chưa có secure search architecture.

V1 search metadata.

---

# 46. DOCUMENT FILTER

```text
Loại tài liệu
Module
Ngày
Owner
Project
Shipment
```

---

# 47. FAVORITE / STAR — KHÔNG CẦN V1

Không biến Document Center thành Google Drive clone.

Không cần:

- star
- comments
- sharing links public
- collaborative editing

---

# 48. COMPANY DOCUMENTS

Có section:

```text
Tài liệu nội bộ
```

Ví dụ:

```text
Quy trình
Biểu mẫu
Hướng dẫn
Chính sách
```

Admin/authorized user có thể upload.

---

# 49. DOCUMENT EXPIRY

Một số tài liệu có:

```text
expiry_date
```

Ví dụ:

- chứng chỉ
- giấy tờ
- hợp đồng

Notification hook có thể cảnh báo sắp hết hạn.

Không bắt mọi tài liệu có expiry.

---

# 50. DOCUMENT RETENTION — FOUNDATION

Có config:

```text
retention policy
```

nhưng V1 không cần DMS retention pháp lý phức tạp.

Không auto delete nhạy cảm nếu policy chưa rõ.

---

# 51. AUDIT LOG — MỤC TIÊU

Audit Log phải trả lời:

```text
Ai?
Làm gì?
Khi nào?
Trên dữ liệu nào?
Trước là gì?
Sau là gì?
Vì sao?
```

---

# 52. ROUTING AUDIT

```text
/settings/audit-log
```

hoặc:

```text
/system-admin/audit
```

Tận dụng Admin Console Prompt 04.

Không tạo duplicate audit page.

---

# 53. AUDIT EVENT DATA

Concept:

```text
id
actor_user_id
actor_employee_id
action
entity_type
entity_id
entity_reference
timestamp
before_data
after_data
reason
source
ip_address optional
user_agent_summary optional
correlation_id
metadata
```

Không log sensitive secret.

---

# 54. KHÔNG AUDIT MỌI READ

Không audit mọi lần user mở table.

Audit read chỉ cho dữ liệu cực nhạy cảm nếu policy yêu cầu:

```text
CCCD
banking
sensitive employee export
```

Không tạo hàng triệu audit record vô ích.

---

# 55. AUDIT ACTION CATEGORIES

```text
CREATE
UPDATE
DELETE
ARCHIVE
RESTORE
APPROVE
REJECT
POST
REVERSE
LOCK
UNLOCK
EXPORT
LOGIN_SECURITY
PERMISSION_CHANGE
CONFIG_CHANGE
FILE_REPLACE
```

Có action code chi tiết hơn.

---

# 56. AUDIT HUMAN-READABLE

UI không show:

```text
employee.department_id:
a18f → b92c
```

nếu có thể resolve thành:

```text
Phòng ban:
Kỹ thuật → Dự án
```

Audit storage có raw IDs, presentation resolve label snapshot.

---

# 57. AUDIT FILTER

Filter:

```text
Người thực hiện
Module
Action
Entity
Date range
Severity/security category
```

Search:

```text
reference number
employee code
document number
```

---

# 58. AUDIT DETAIL

Drawer/page:

```text
Người thực hiện
Thời gian
Action
Entity
Reason

Thay đổi:
Field A: old → new
Field B: old → new
```

Không show password/token.

---

# 59. AUDIT IMMUTABILITY

Audit record không editable bằng UI.

Không có:

```text
Edit audit
Delete audit
```

trừ retention/maintenance system process có quyền đặc biệt.

---

# 60. AUDIT INTEGRITY

Nếu feasible:

- append-only semantics
- no normal update endpoint
- DB permission hạn chế

Không cần blockchain/hash chain ở V1.

---

# 61. CORRELATION ID

Một business operation có thể sinh nhiều event.

Ví dụ:

```text
Approve leave
↓
approval event
↓
leave ledger usage
↓
notification
```

Dùng:

```text
correlation_id
```

để trace.

---

# 62. CONFIGURATION CENTER

Ngoài Branding, Admin Console phải có **Business Configuration**.

Routes có thể:

```text
/settings/organization
/settings/departments
/settings/positions
/settings/employment-types

/settings/attendance
/settings/attendance/shifts
/settings/attendance/locations
/settings/attendance/calendar

/settings/leave
/settings/leave/types
/settings/approval-workflows

/settings/projects
/settings/warehouse
/settings/import-export

/settings/export-templates
/settings/notifications
/settings/integrations
```

Không hard-code các danh mục nghiệp vụ trong code.

---

# 63. CENTRAL SETTINGS INDEX

Route:

```text
/settings
```

Hiển thị theo nhóm:

```text
Tổ chức
Nhân sự
Chấm công
Nghỉ phép & Phê duyệt
Dự án
Kho
Xuất nhập khẩu
Báo cáo
Thông báo
Tích hợp
Bảo mật
```

Có search settings.

---

# 64. SETTINGS SEARCH

Ví dụ user search:

```text
bán kính GPS
```

→ đưa tới:

```text
Chấm công > Địa điểm
```

Không cần global command palette phức tạp.

---

# 65. CONFIG PUBLISH SAFETY

Config quan trọng phải:

```text
edit
↓
validate
↓
preview impact nếu có
↓
save/publish
↓
audit
```

Không save arbitrary invalid config.

---

# 66. CONFIG DEPENDENCY WARNING

Ví dụ admin disable leave type đang có request pending:

```text
Loại nghỉ này đang được sử dụng bởi 12 đơn.
Vô hiệu hóa chỉ áp dụng cho đơn mới.
```

Không rewrite lịch sử.

---

# 67. DELETE VS INACTIVE CONFIG

Danh mục đã dùng:

- Department
- Position
- Leave Type
- Warehouse
- Document Type

ưu tiên:

```text
Inactive
```

không hard delete.

---

# 68. GLOBAL REFERENCE DATA

Có thể xây reusable pattern:

```text
Code
Name
Status
Sort Order
Effective Date
```

Nhưng không biến mọi master table thành một generic JSON table.

Domain master vẫn typed.

---

# 69. EFFECTIVE-DATED CONFIG

Một số policy cần hiệu lực theo ngày.

Ví dụ:

```text
Ca làm mới từ 01/10
```

Không áp policy mới retroactive lên kỳ cũ.

Tạo extension point:

```text
effective_from
effective_to
```

ở config phù hợp.

---

# 70. CONFIG VERSION

Policy quan trọng có version:

```text
attendance_policy_version
leave_policy_version
workflow_version
export_template_version
```

Không nhất thiết mọi settings nhỏ có version riêng.

---

# 71. SYSTEM NOTICE

Admin có thể tạo thông báo nội bộ:

```text
Bảo trì hệ thống lúc 18:00
```

Route:

```text
/system-admin/notices
```

Fields:

```text
title
message
start_at
end_at
audience
priority
```

Không phải chat.

---

# 72. SYSTEM NOTICE AUDIENCE

```text
All users
Specific roles
Specific departments
```

Không arbitrary targeting query.

---

# 73. SYSTEM NOTICE UI

Hiển thị:

- banner nhẹ
- notification center

Không popup chặn màn hình nếu không critical.

---

# 74. APPROVAL + NOTIFICATION INTEGRATION

Khi request submit:

```text
approval_case created
↓
notification to current approver
```

Khi approve:

```text
if next step
→ notify next approver
else
→ notify requester approved
```

Không duplicate notification nếu retry.

---

# 75. IDEMPOTENT NOTIFICATION

Có unique/event key:

```text
event_id + recipient + template
```

Retry event không spam duplicate.

---

# 76. NOTIFICATION READ MODEL

Không cần websocket bắt buộc.

Có thể:

- polling nhẹ
- refresh on focus
- realtime nếu infra support tốt

Ưu tiên reliability.

---

# 77. UNREAD COUNT

Header bell:

```text
3
```

Query nhẹ.

Không fetch full notifications chỉ để đếm.

---

# 78. DOCUMENT + NOTIFICATION INTEGRATION

Có thể emit:

```text
document.expiring_soon
document.replaced
```

chỉ nếu module cấu hình.

Không spam.

---

# 79. AUDIT + APPROVAL INTEGRATION

Approval action audit phải reference:

```text
approval_case
domain entity
```

Không audit chỉ approval case mà mất link domain.

---

# 80. SECURITY EVENT LOG

Tách hoặc categorize:

```text
login failed
account disabled
role changed
permission changed
admin config changed
```

Không hiển thị security detail cho user thường.

---

# 81. AUTHORIZATION

Permissions gợi ý:

```text
approval.inbox.view
approval.view_assigned
approval.view_all
approval.act
approval.reassign
approval.workflow.manage
approval.delegation.manage

notification.self.view
notification.preference.manage
notification.system_notice.manage

document.view
document.upload
document.replace
document.archive
document.company_manage

audit.view
audit.view_sensitive

settings.view
settings.manage
```

Không hard-code role.

---

# 82. DOCUMENT DOMAIN PERMISSIONS VẪN PHẢI TÔN TRỌNG

Có:

```text
document.view
```

không có nghĩa xem mọi document.

Ví dụ B/L vẫn cần:

```text
shipment_document.view
+
shipment scope
```

Document Center là index, không phải bypass.

---

# 83. APPROVAL SCOPE

Có:

```text
approval.act
```

chỉ cho action với case assigned/scope.

All-scope phải permission riêng.

---

# 84. NOTIFICATION SECURITY

Notification deep link không được leak title sensitive quá mức.

Ví dụ với user không còn permission:

- notification vẫn có thể tồn tại
- click route → Permission Denied
- không trả domain payload trái phép

Có thể redact/expire notification nếu permission revoked.

---

# 85. DOCUMENT THUMBNAIL SECURITY

Thumbnail cũng là protected resource.

Không public thumbnail bucket cho tài liệu nhạy cảm.

---

# 86. FILE DOWNLOAD AUDIT

Audit download cho:

- CCCD
- bank docs
- shipment critical docs
- employee sensitive export

Không bắt audit download cho mọi company-wide policy PDF nếu không cần.

---

# 87. API GỢI Ý — APPROVAL

```text
GET  /api/v1/approvals
GET  /api/v1/approvals/:id
POST /api/v1/approvals/:id/approve
POST /api/v1/approvals/:id/reject
POST /api/v1/approvals/:id/reassign

GET/POST/PATCH /api/v1/approval-workflows
```

---

# 88. API GỢI Ý — NOTIFICATION

```text
GET  /api/v1/notifications
GET  /api/v1/notifications/unread-count
POST /api/v1/notifications/:id/read
POST /api/v1/notifications/read-all

GET/PATCH /api/v1/notification-preferences
```

---

# 89. API GỢI Ý — DOCUMENTS

```text
GET  /api/v1/documents
POST /api/v1/documents

GET  /api/v1/documents/:id
POST /api/v1/documents/:id/versions
POST /api/v1/documents/:id/archive

GET  /api/v1/documents/:id/view
GET  /api/v1/documents/:id/download
```

---

# 90. API GỢI Ý — AUDIT

```text
GET /api/v1/audit-logs
GET /api/v1/audit-logs/:id
```

Read-only.

Không POST/PATCH normal audit API.

---

# 91. API GỢI Ý — CONFIG

Tách typed config endpoints.

Không generic arbitrary endpoint nếu chưa validation.

Ví dụ:

```text
GET/PATCH /api/v1/settings/attendance
GET/PATCH /api/v1/settings/notifications
GET/PATCH /api/v1/settings/projects
```

---

# 92. DATABASE MODEL GỢI Ý

Không bắt buộc tên chính xác.

```text
approval_cases
approval_steps
approval_workflows
approval_workflow_versions
approval_delegations

notifications
notification_preferences
notification_templates

documents
document_versions
document_links

audit_logs

system_notices
```

Business settings có thể dùng typed tables + validated JSON settings tùy module.

---

# 93. DOCUMENT LINK TABLE

Có thể có:

```text
document_links
- document_id
- entity_type
- entity_id
- relation_type
```

Ví dụ:

```text
Document A
→ Project 123
→ Relation: PROJECT_DOCUMENT
```

Không duplicate file.

---

# 94. EVENT REGISTRY

Tạo event key registry:

```text
leave.submitted
leave.approved

timesheet.adjustment.submitted

project.issue.created

warehouse.receipt.posted

shipment.eta.changed

document.expiring_soon
```

Không dùng string typo rải rác.

---

# 95. TEMPLATE REGISTRY

Notification template map theo event.

Không hard-code subject/message trong domain service.

---

# 96. BACKGROUND JOBS

Một số task:

```text
approval reminder
document expiry notification
stale project notice
shipment attention
```

có thể chạy background/scheduled job.

Không chạy heavy scan mỗi page load.

---

# 97. DUPLICATE JOB PROTECTION

Scheduled job phải idempotent.

Ví dụ mỗi ngày không gửi 10 reminder giống nhau.

Lưu notification event key/date bucket phù hợp.

---

# 98. PERFORMANCE

Approval inbox:

- pagination
- indexed assigned user/status

Notification:

- unread index
- pagination

Documents:

- metadata search index
- không load binary khi list

Audit:

- pagination
- date partition/index if volume grows

---

# 99. AUDIT RETENTION

Có thể define retention config sau.

V1 không auto delete audit quan trọng.

Không cho admin UI xóa audit tùy ý.

---

# 100. MOBILE APPROVAL CENTER

Mobile:

```text
Cần tôi duyệt

Nghỉ phép
Nguyễn Văn A
2 ngày
[Tap]

Điều chỉnh công
Trần Văn B
08/09
[Tap]
```

Detail:

```text
Context
Timeline
Approve / Reject
```

Touch-friendly.

---

# 101. MOBILE NOTIFICATION CENTER

Simple list:

```text
Chưa đọc
Hôm nay
Trước đó
```

Tap → deep link.

Không dense table.

---

# 102. DOCUMENT CENTER DESKTOP

Layout:

```text
Tài liệu

[Tìm kiếm]
[Loại] [Module] [Ngày]

Tên tài liệu | Loại | Thuộc | Phiên bản | Cập nhật
```

Không card-grid mặc định nếu data-oriented.

---

# 103. DOCUMENT CENTER MOBILE

List:

```text
Packing List
Shipment SHP-001
PDF
09/09/2026
```

Tap → detail/view.

---

# 104. AUDIT UI DESKTOP

Table:

```text
Thời gian
Người thực hiện
Module
Hành động
Đối tượng
Tham chiếu
```

Drawer detail.

Không cố support mobile sâu.

---

# 105. SETTINGS UX

Settings index:

```text
Search settings
```

Groups rõ.

Không một trang 500 field.

Subroute per business area.

---

# 106. TEST CASES — APPROVAL

- leave approval appears in central inbox
- timesheet adjustment appears in inbox
- assigned user only
- all-scope user
- approve
- reject
- reassign
- workflow version snapshot
- missing approver
- delegation
- duplicate approve prevented

---

# 107. TEST CASES — NOTIFICATION

- create on event
- correct recipient
- deep link
- mark read
- unread count
- idempotent duplicate event
- preference respected
- mandatory notification not disabled
- permission revoked deep link denied

---

# 108. TEST CASES — DOCUMENTS

- upload company document
- link to project
- link to shipment
- replace creates new version
- old version retained
- private access denied
- project member access
- direct file URL protected
- archive
- stable document route

---

# 109. TEST CASES — AUDIT

- config change
- role change
- approval
- warehouse post
- XNK ETA change
- document replace
- export sensitive data
- immutable UI
- no password/token in before/after

---

# 110. TEST CASES — CONFIG

- valid config save
- invalid config rejected
- used master data inactive
- historical data unaffected
- workflow versioning
- effective date policy
- config audit

---

# 111. ACCEPTANCE CRITERIA

## Approval

- [ ] Central approval inbox.
- [ ] Domain requests link correctly.
- [ ] Workflow reusable.
- [ ] Version snapshot.
- [ ] Reassign.
- [ ] Delegation foundation.
- [ ] No double approval.
- [ ] Server-side scope.

## Notifications

- [ ] In-app notification center.
- [ ] Unread count.
- [ ] Deep links.
- [ ] Preferences.
- [ ] Event-driven.
- [ ] Idempotent.
- [ ] Future channels ready.

## Documents

- [ ] Document Center.
- [ ] Domain linking.
- [ ] Private access.
- [ ] Versioning.
- [ ] Stable links.
- [ ] No bypass of domain permission.
- [ ] No binary duplication when linking.

## Audit

- [ ] Central audit log.
- [ ] Human-readable change view.
- [ ] Read-only.
- [ ] Sensitive secrets excluded.
- [ ] Filter/search.
- [ ] Correlation ID.

## Configuration

- [ ] Settings index.
- [ ] Business config grouped.
- [ ] No giant settings page.
- [ ] Inactive instead of destructive delete.
- [ ] Version/effective date where necessary.
- [ ] Audit config changes.

## Quality

- [ ] Lint pass.
- [ ] Typecheck pass.
- [ ] Tests pass.
- [ ] Production build pass.
- [ ] Mobile approval/notification review pass.
- [ ] Security review pass.

---

# 112. THỨ TỰ TRIỂN KHAI

1. Inspect approval primitives hiện tại.
2. Chuẩn hóa Approval Case / Step.
3. Xây central Approval Inbox.
4. Workflow configuration/versioning.
5. Reassignment/delegation foundation.
6. Thiết kế Notification event model.
7. Notification Center.
8. Preferences/templates.
9. Thiết kế Document Center metadata.
10. Document linking/versioning.
11. Stable/private viewer.
12. Chuẩn hóa Audit model.
13. Audit UI.
14. Settings index/business configuration navigation.
15. System Notice.
16. Integrate Leave.
17. Integrate Timesheet Adjustments.
18. Integrate Project/Warehouse/XNK events.
19. Background reminders/expiry hooks.
20. Permissions/security review.
21. Tests.
22. Responsive/accessibility.
23. Lint/typecheck/build.
24. Báo cáo.

---

# 113. DELIVERABLE REPORT

Sau khi hoàn thành, báo cáo:

## Approval Platform

- model
- workflow
- inbox
- delegation/reassignment

## Notification Platform

- events
- templates
- preferences
- delivery foundation

## Document Platform

- metadata
- versions
- links
- access control

## Audit Platform

- schema
- human-readable rendering
- correlation

## Configuration

- settings routes
- typed config groups
- versioning/effective dates

## Integrations completed

- Leave
- Timesheet
- Project
- Warehouse
- XNK

## Tests

- cases
- results

## Known limitations

Chỉ ghi limitation thật.

---

# 114. QUY TẮC CUỐI

Không biến Approval Platform thành generic JSON business engine.

Không biến Document Center thành Google Drive clone.

Không tạo public share link cho tài liệu nội bộ.

Không bypass permission module gốc qua Document Center.

Không spam notification.

Không gửi duplicate notification do retry.

Không sửa workflow của request cũ khi admin đổi config mới.

Không cho audit log editable.

Không log password/token/secret.

Không hard delete master data đã có lịch sử.

Không nhét tất cả settings vào một giant arbitrary JSON không validation.

**Dừng sau khi Approval Center + Notification Center + Document Center + Audit Log + Business Configuration Center hoàn chỉnh, test/build pass và báo cáo kết quả.**
